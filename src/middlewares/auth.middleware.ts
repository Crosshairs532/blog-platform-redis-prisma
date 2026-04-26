import jwt from "jsonwebtoken";
import { getRedisClient } from "../config/redis";
import type { Request, Response, NextFunction } from "express";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const redis = getRedisClient();
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const sessionExists = await redis.exists(`session:${decoded.sessionId}`);
    if (!sessionExists) {
      return res
        .status(401)
        .json({ error: "Session expired. Please login again." });
    }

    //! check if token has been compromised

    const isActive = await redis.hget(
      `session:${decoded.sessionId}`,
      "isActive",
    );
    if (isActive === "false") {
      return res.status(401).json({ error: "Session deactivated" });
    }

    await redis.hset(
      `session:${decoded.sessionId}`,
      "lastActivity",
      Date.now(),
    );
    req.user = decoded;
    req.sessionId = decoded.sessionId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
