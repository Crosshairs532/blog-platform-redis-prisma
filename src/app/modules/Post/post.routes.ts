import express from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { fetchFeed, postCreate, rePost } from "./post.controller";

const router = express.Router();

router.get("/fetch-post", authMiddleware, fetchFeed);
router.post("/create-post", authMiddleware, postCreate);
router.post("/repost", authMiddleware, rePost);

export default router;
