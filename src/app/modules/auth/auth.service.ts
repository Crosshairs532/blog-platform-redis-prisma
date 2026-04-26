import bcrypt from "bcrypt";
import { prisma } from "../../../config/db";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { generateToken } from "../../../utils/jwt";
import type { Request } from "express";
import { getRedisClient } from "../../../config/redis";

const authKey = (key: string, value: any) => `user:${key}:${value}`;

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

export const loginUser = async ({ email, password }: any) => {
  const redisClient: any = getRedisClient();
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) throw new Error("User not found");

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new Error("Invalid password");

  const accessToken = generateToken(user, "15m");
  const refreshToken = generateToken(user, "7d");
  console.log(refreshToken);
  //! redis
  redisClient.set(
    authKey("refresh_token", refreshToken),
    JSON.stringify(user),
    {
      EX: 60 * 60 * 24 * 7,
    },
  );

  return {
    message: "Login Successful",
    accessToken,
    refreshToken,
  };
};

export const logoutUser = async (req: Request) => {
  const redisClient: any = getRedisClient();
  const token = req.headers.authorization?.split(" ")[1] as string;
  const decoded = jwt.decode(token) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = decoded.exp! - now;
  if (timeLeft > 0) {
    await redisClient.set(`blacklist:${token}`, "true", { EX: timeLeft });
  }
  console.log("Session Daa -1 ");
  if (token) {
    const sessionData = await redisClient.get(`user:refresh_token:${token}`);
    console.log(sessionData);
    if (sessionData) {
      console.log("Session Daa -2");
      await redisClient.del(
        `user:refresh_token:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoic2Ftc3VsQG1haWwuY29tIiwiaWF0IjoxNzc3MTkxNzYwLCJleHAiOjE3Nzc3OTY1NjB9.mXErJYHAxx5OZobJXa9cX1QlnRnITcjOjJ53RHR2bl8`,
      );
    }
  }
};
