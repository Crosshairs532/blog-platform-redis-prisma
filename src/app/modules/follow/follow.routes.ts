import express from "express";
import {
  fetchFollower,
  fetchFollowing,
  follow,
  unfollow,
} from "./follow.controller.js";
import { authMiddleware } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/:userId/follow", authMiddleware, follow);
router.post("/:userId/unfollow", authMiddleware, unfollow);
router.get("/followers", authMiddleware, fetchFollower);
router.get("/following", authMiddleware, fetchFollowing);

export default router;
