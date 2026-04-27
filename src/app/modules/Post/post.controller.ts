import type { Request, Response } from "express";
import { getFeed } from "./post.service";

export const fetchFeed = async (req: Request, res: Response) => {
  try {
    const userId = req?.user?.userId;
    const { page = 0 } = req.query;

    const feed = await getFeed(userId as string, Number(page));

    res.json(feed);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
};
