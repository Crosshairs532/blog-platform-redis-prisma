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
    return res
      .status(401)
      .json({ error: "Unauthorized ! User Must Login First" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const sessionExists = await redis.exists(`session:${decoded.sessionId}`);
    // console.log(decoded, "authMiddleware");
    // console.log({ sessionExists }, "lol");
    if (!sessionExists) {
      return res
        .status(401)
        .json({ error: "Session expired. Please login again." });
    }

    //! check if token has been compromised
    // console.log("decoded.sessionId - ", decoded?.sessionId);
    const isActive = await redis.hGet(
      `session:${decoded?.sessionId}`,
      "isActive",
    );
    // console.log({ isActive }, "kire");
    if (isActive === "false") {
      return res.status(401).json({ error: "Session deactivated" });
    }

    await redis.hSet(
      `session:${decoded.sessionId}`,
      "lastActivity",
      Date.now(),
    );

    // console.log({ decoded });
    req.user = decoded;
    req.sessionId = decoded.sessionId;

    // console.log("Auth Middleware");
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
