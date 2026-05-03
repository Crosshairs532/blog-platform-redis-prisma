import { userService } from "./user.service";
import type { NextFunction, Request, Response } from "express";
const getAllUsersController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const users = await userService.getAllUsers(req.user?.userId as string);
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    
    const loggedInUserId = req.user?.userId;

    console.log({ userId }, {loggedInUserId});
    const profile = await userService.getUserProfile(
      userId as string,
      loggedInUserId as string,
    );

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};
const getUserPostsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;

    const posts = await userService.getUserPosts(
      userId as string,
      currentUserId as string,
    );

    res.status(200).json({
      success: true,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
};

const updateProfileService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;
    const userData = req.body;
    const updatedUser = await userService.updateUserService(
      userId as string,
      userData,
    );
    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const userController = {
  getAllUsersController,
  getProfile,
  getUserPostsController,
  updateProfileService,
};
