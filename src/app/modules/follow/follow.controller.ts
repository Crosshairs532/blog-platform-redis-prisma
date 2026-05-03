import type { Request, Response } from "express";
import {
  followUser,
  getFollowers,
  getFollowing,
  unfollowUser,
} from "./follow.service.js";

export const follow = async (req: Request, res: Response) => {
  try {
    // the userId who is Logged in
    const followerId = req?.user?.userId;

    // the userId who is going to be followed
    const { userId } = req.params;
    console.log({ userId });

    const result = await followUser(followerId as string, userId as string);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const unfollow = async (req: Request, res: Response) => {
  try {
    const followerId = req?.user?.userId;
    const { userId } = req.params;

    const result = await unfollowUser(followerId as string, userId as string);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const fetchFollower = async (req: Request, res: Response) => {
  console.log("fetchFollower");
  try {
    const result = await getFollowers(req?.user?.userId as string);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {}
};
export const fetchFollowing = async (req: Request, res: Response) => {
  console.log("fetchFollowing");
  try {
    const result = await getFollowing(req?.user?.userId as string);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {}
};
