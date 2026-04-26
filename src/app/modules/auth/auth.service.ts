import bcrypt from "bcrypt";
import { prisma } from "../../../config/db";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { generateToken } from "../../../utils/jwt";
import type { Request } from "express";
import { getRedisClient } from "../../../config/redis";

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

  const JwtPayload = {
    userId: user.id,
    sessionId: sessionId,
    email: user.email,
  };
  const accessToken = generateToken(JwtPayload, "15m");
  const refreshToken = generateToken(JwtPayload, "7d");

  const sessionData = {
    sessionId: sessionId,
    userId: user.id,
    email: user.email,
    accessToken: accessToken,
    refreshToken: refreshToken,
    deviceInfo: req.headers["user-agent"],
    ipAddress: req.ip,
    createdAt: Date.now(),
    lastActivity: Date.now(),
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
  const redisClient: any = getRedisClient();
  const accessToken = req.headers.authorization?.split(" ")[1];
  const decoded = jwt.decode(accessToken as string) as JwtPayload;

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = decoded?.exp! - now;
  const user = req?.user;
  if (timeLeft > 0) {
    await redisClient.set(`blacklist:${accessToken}`, "true", { EX: timeLeft });
  }
  console.log("Session Daa -1 ");
  const { refreshToken } = req.body;
  if (refreshToken) {
    const key = `user:refresh_token:${refreshToken}`;
    await redisClient.del(key);
  } else {
    console.log("No token provided for logout.");
  }
};
