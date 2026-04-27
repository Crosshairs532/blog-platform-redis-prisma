import bcrypt from "bcrypt";
import { prisma } from "../../../config/db";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { generateToken } from "../../../utils/jwt";
import type { Request } from "express";
import { getRedisClient } from "../../../config/redis";
import { UAParser } from "ua-parser-js";

export const registerUser = async ({ username, email, password }: any) => {
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: hashed,
    },
  });

  return user;
};

export const loginUser = async (req: any, { email, password }: any) => {
  const redisClient: any = getRedisClient();

  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) throw new Error("User not found");

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new Error("Invalid password");

  // generate session Id
  const sessionId = `${user.id}-${Date.now()}`;
  console.info(sessionId);
  const ua = new UAParser(req.headers["user-agent"]).getResult();
  const deviceName = `${ua.browser.name || "Unknown"} on ${ua.os.name || "Unknown"}`;
  const JwtPayload = {
    userId: user.id,
    sessionId: sessionId,
    email: user.email,
  };

  console.log({ JwtPayload });
  const accessToken = generateToken(JwtPayload, "15m");
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
  await redisClient.hSet(SESSION_KEY, sessionData, {
    EX: 60 * 60 * 24 * 7,
  });

  return {
    success: true,
    accessToken,
    refreshToken,
    sessionId,
    user: { id: user.id, email: user.email, username: user.username },
  };
};

export const logoutUser = async (req: Request) => {
  const redis = getRedisClient();
  const sessionId = req.sessionId;
  const userId = req.user?.id;

  if (!sessionId) {
    throw new Error("No active session found");
  }
  await redis.del(`session:${sessionId}`);
  await redis.sRem(`user:${userId}:sessions`, sessionId);

  const accessToken = req.headers.authorization?.split(" ")[1];
  console.log(`user:${userId}:sessions`, sessionId);
  console.log("logout user -", accessToken);
  if (accessToken) {
    const decoded = jwt.decode(accessToken) as any;
    if (decoded && decoded.exp) {
      const timeLeft = decoded.exp - Math.floor(Date.now() / 1000);
      if (timeLeft > 0) {
        await redis.set(`blacklist:${accessToken}`, timeLeft);
      }
    }
  }
  return { success: true, message: "Logged out successfully" };
};

export const logoutAllDevices = async (req: Request) => {
  const redis = getRedisClient();
  const userId = req.user?.id;

  const sessionIds = await redis.smembers(`user:${userId}:sessions`);

  for (const sessionId of sessionIds) {
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
      version: decoded.version + 1,
    },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: "7d" },
  );

  await redis.hset(`session:${sessionId}`, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    refreshTokenVersion: decoded.version + 1,
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
