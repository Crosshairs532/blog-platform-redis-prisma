import bcrypt from "bcrypt";
import { prisma } from "../../../config/db";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { generateToken } from "../../../utils/jwt";
import type { Request } from "express";
// import { getRedisClient } from "../../../config/redis";
import { UAParser } from "ua-parser-js";
import { handlePrismaError } from "../../../utils/PrismaError";
import { AppError } from "../../../utils/ AppError";
import { getRedis } from "../../../config/redis";
import { LOGIN_LUA } from "../../../constants/lua/lua.scripts";

export const registerUser = async ({ username, email, password }: any) => {
  console.log({ username, email, password });

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
  console.time("LoginTime");
  const redisClient: any = (await getRedis()).getClient();
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) throw new Error("User not found");
  //* Hash Password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new Error("Invalid password");
  //* generate token & session Id
  const sessionId = `${user?.id}-${Date.now()}`;
  const JwtPayload = {
    userId: user.id,
    sessionId,
    email: user.email,
    username: user.username,
  };

  //* Generate Token

  const accessToken = generateToken(JwtPayload, "1h");
  const refreshToken = generateToken(JwtPayload, "7d");

  //* device info
  const ua = new UAParser(req.headers["user-agent"]).getResult();
  const deviceName = `${ua.browser.name || "Unknown"} on ${ua.os.name || "Unknown"}`;

  //* Run Lua Script
  const result = await redisClient.eval(LOGIN_LUA, {
    keys: [`user:${user.id}:sessions`, `session:${sessionId}`],
    arguments: [user?.id, sessionId, deviceName, req.ip, user.email, "2"],
  });
  if (result.err === "MAX_SESSIONS") {
    throw new Error("Maximum login sessions exceeded");
  }
  console.timeEnd("LoginTime");

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
  const redis = (await getRedis()).getClient();
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
  const redis = (await getRedis()).getClient();
  const userId = req?.user?.userId;

  console.log("logout userId: ", userId);
  const sessionIds = await redis.sMembers(`user:${userId}:sessions`);
  console.log("Logout: ", sessionIds);

  for (const sessionId of sessionIds) {
    const sessionData = await redis.hGetAll(`session:${sessionId}`);
    console.log("sessionData-Logout: ", sessionIds);
    await blacklistToken(redis, sessionData?.accessToken as string);
    await redis.del(`session:${sessionId}`);
  }

  await redis.del(`user:${userId}:sessions`);

  return {
    success: true,
    message: `Logged out from ${sessionIds.length} devices`,
  };
};

export const refreshAccessToken = async (refreshToken: string) => {
  const redis = (await getRedis()).getClient();
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
    {
      userId: decoded.userId,
      sessionId: sessionId,
      email: decoded.email,
      username: decoded.username,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );

  const newRefreshToken = jwt.sign(
    {
      userId: decoded.userId,
      sessionId: sessionId,
      email: decoded.email,
      username: decoded.username,
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
  const redis = (await getRedis()).getClient();
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
