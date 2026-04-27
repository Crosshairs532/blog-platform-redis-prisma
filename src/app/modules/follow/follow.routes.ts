import express from "express";
import { follow, unfollow } from "./follow.controller.js";
import { authMiddleware } from "../../../middlewares/auth.middleware.js";
import { getFollowers, getFollowing } from "./follow.service.js";

const router = express.Router();

router.post("/:userId/follow", authMiddleware, follow);
router.post("/:userId/unfollow", authMiddleware, unfollow);
router.get("/:userId/followers", authMiddleware, getFollowers);
router.get("/:userId/following", authMiddleware, getFollowing);

export default router;
