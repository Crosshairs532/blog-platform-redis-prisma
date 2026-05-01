import bcrypt from "bcrypt";
import { prisma } from "../../../config/db";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { generateToken } from "../../../utils/jwt";
import type { Request } from "express";
import { getRedisClient } from "../../../config/redis";
import { UAParser } from "ua-parser-js";
import { handlePrismaError } from "../../../utils/PrismaError";
import { AppError } from "../../../utils/ AppError";

export const registerUser = async ({ username, email, password }: any) => {
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashed,
      },
    });

    return user;
  } catch (error) {
    handlePrismaError(error);
  }
};

export const loginUser = async (req: any, { email, password }: any) => {
  /*
     1. Check if user exists
     2. Get all the sessions
     3. Check of same device login 
     4. Remove the old login infos and update the session
     5. Check for Max login Exceed
     6. generate a session ID 
  */

  const redisClient: any = getRedisClient();

  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) throw new Error("User not found");

  //* Hash Password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new Error("Invalid password");

  //* generate session Id
  const sessionId = `${user.id}-${Date.now()}`;
  console.info(sessionId);
  const JwtPayload = {
    userId: user.id,
    sessionId: sessionId,
    email: user.email,
  };

  console.log({ JwtPayload });

  //* maximum Session Exceed Logic
  const sessionIds = await redisClient.sMembers(`user:${user.id}:sessions`);

  const ua = new UAParser(req.headers["user-agent"]).getResult();
  const deviceName = `${ua.browser.name || "Unknown"} on ${ua.os.name || "Unknown"}`;

  // check if logged in from same device and save browser
  let existingSessionId = null;
  for (const sid of sessionIds) {
    const sessionData = await redisClient.hGetAll(`session:${sid}`);
    if (
      sessionData.deviceInfo === deviceName &&
      sessionData.ipAddress === req.ip
    ) {
      existingSessionId = sid;
      break;
    }
  }
  if (existingSessionId) {
    // Same device - remove old session, allow new one
    await redisClient.del(`session:${existingSessionId}`);
    await redisClient.sRem(`user:${user.id}:sessions`, existingSessionId);
    // Remove from sessionIds array for limit check
    const index = sessionIds.indexOf(existingSessionId);
    if (index > -1) sessionIds.splice(index, 1);
  }

  //! check if user login session limit exceeded
  if (sessionIds.length >= 2) {
    throw new Error("Maximum login sessions exceeded");
  }

  const accessToken = generateToken(JwtPayload, "20m");
  const refreshToken = generateToken(JwtPayload, "7d");

  const sessionData = {
    sessionId: sessionId,
    userId: user.id,
    email: user.email,
    accessToken: accessToken,
    refreshToken: refreshToken,
    deviceInfo: deviceName,
    ipAddress: req.ip,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    isActive: "true",
  };
  console.info("session Data: ", sessionData);

  // user:userId:sessions: {} ---> key
  // session:sessionId: {userId, email, deviceInfo, ipAddress, createdAt, lastActivity}

  //! redis
  const USER_SESSIONS_KEY = `user:${user.id}:sessions`;
  const SESSION_KEY = `session:${sessionId}`;

  await redisClient.sAdd(USER_SESSIONS_KEY, sessionId);
  await redisClient.hSet(SESSION_KEY, sessionData);
  await redisClient.expire(SESSION_KEY, 60 * 60 * 24 * 7);

  return {
    success: true,
    accessToken,
    refreshToken,
    sessionId,
    user: { id: user.id, email: user.email, username: user.username },
  };
};

const blacklistToken = async (redis: any, token: string) => {
  if (!token) return;

  const decoded = jwt.decode(token) as any;
  if (decoded && decoded.exp) {
    const timeLeft = decoded.exp - Math.floor(Date.now() / 1000);
    if (timeLeft > 0) {
      await redis.set(`blacklist:${token}`, timeLeft);
    }
  }
};

export const logoutUser = async (req: Request) => {
  const redis = getRedisClient();
  try {
    const sessionId = req?.sessionId;
    const userId = req?.user?.userId;

    console.log(userId, "logoutUser");

    if (!sessionId) throw new Error("No active session found");
    if (!userId) throw new Error("Unauthorized");
    await redis.del(`session:${sessionId}`);
    const allSessionIDs = await redis.sMembers(`user:${userId}:sessions`);
    console.log({ allSessionIDs }, { sessionId });
    await redis.sRem(`user:${userId}:sessions`, sessionId);
    const accessToken = req.headers.authorization?.split(" ")[1];
    await blacklistToken(redis, accessToken as string);
    return { success: true, message: "Logged out successfully" };
  } catch (error: any) {
    throw new AppError(error?.message, 500);
  }
};

export const logoutAllDevices = async (req: Request) => {
  const redis = getRedisClient();
  const userId = req?.user?.userId;

  console.log("logout userId: ", userId);
  const sessionIds = await redis.sMembers(`user:${userId}:sessions`);
  console.log("Logout: ", sessionIds);

  for (const sessionId of sessionIds) {
    const sessionData = await redis.hGetAll(`session:${sessionId}`);
    console.log("sessionData-Logout: ", sessionIds);
    await blacklistToken(redis, sessionData.accessToken);
    await redis.del(`session:${sessionId}`);
  }

  await redis.del(`user:${userId}:sessions`);

  return {
    success: true,
    message: `Logged out from ${sessionIds.length} devices`,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  const redis = getRedisClient();
  let decoded;
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string,
    ) as any;
  } catch (err) {
    throw new Error("Invalid refresh token");
  }
  const sessionId = decoded.sessionId;
  const sessionExists = await redis.exists(`session:${sessionId}`);
  if (!sessionExists) {
    throw new Error("Session not found");
  }

  const newAccessToken = jwt.sign(
    { userId: decoded.userId, sessionId: sessionId, email: decoded.email },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );

  const newRefreshToken = jwt.sign(
    {
      userId: decoded.userId,
      sessionId: sessionId,
      email: decoded.email,
    },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: "7d" },
  );

  await redis.hSet(`session:${sessionId}`, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    lastActivity: Date.now(),
  });
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const getUserSessions = async (userId: string) => {
  const redis = getRedisClient();
  console.log("All sessionIds - ", `user:${userId}:sessions`);
  const sessionIds = await redis.sMembers(`user:${userId}:sessions`);
  console.log("All sessionIds - ", sessionIds);
  const sessions = [];

  for (const sessionId of sessionIds) {
    const sessionData = await redis.hGetAll(`session:${sessionId}`);
    if (sessionData && Object.keys(sessionData).length > 0) {
      sessions.push({
        sessionId: sessionData.sessionId,
        deviceInfo: sessionData.deviceInfo,
        ipAddress: sessionData.ipAddress,
        createdAt: new Date(parseInt(sessionData.createdAt)),
        lastActivity: new Date(parseInt(sessionData.lastActivity)),
      });
    }
  }
  console.log("All user session - ", sessions);
  return sessions;
};
