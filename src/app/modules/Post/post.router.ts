import express from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { fetchFeed } from "./post.controller";

const router = express.Router();

router.get("/", authMiddleware, fetchFeed);

export default router;
