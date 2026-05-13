import jwt from "jsonwebtoken";
// import { getRedisClient } from "../config/redis";
import type { Request, Response, NextFunction } from "express";
import { getRedis } from "../config/redis";
import { RedisKeys } from "../utils/redisKeys";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const redis = (await getRedis()).getClient();
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ error: "Unauthorized ! User Must Login First" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const sessionKey = RedisKeys.session(decoded.sessionId);
    const [sessionExists, isActive] = await Promise.all([
      redis.exists(sessionKey),
      redis.hGet(sessionKey, "isActive"),
    ]);

    if (!sessionExists || isActive === "false") {
      return res.status(401).json({ error: "Session expired or deactivated" });
    }
    await redis.hSet(sessionKey, "lastActivity", Date.now().toString());
    req.user = decoded;
    req.sessionId = decoded.sessionId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
