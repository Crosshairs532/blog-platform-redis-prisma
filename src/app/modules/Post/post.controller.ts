import type { Request, Response } from "express";
import { getFeed, createPost, createRepost } from "./post.service";

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

export const postCreate = async (req: Request, res: Response) => {
  try {
    const userId = req?.user?.userId;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }
    const post = await createPost(userId as string, content);
    res.status(201).json(post);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
};

export const rePost = async (req: Request, res: Response) => {
  try {
    const userId = req?.user?.userId;
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }
    const post = await createRepost(userId as string, postId);
    res.status(201).json(post);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
};
