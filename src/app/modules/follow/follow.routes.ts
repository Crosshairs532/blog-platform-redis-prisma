import express from "express";
import { follow, unfollow } from "./follow.controller.js";
import { authMiddleware } from "../../../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/:userId/follow", authMiddleware, follow);
router.post("/:userId/unfollow", authMiddleware, unfollow);

export default router;
