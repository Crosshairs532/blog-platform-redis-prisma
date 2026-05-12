import express from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";
import { fetchNotifications } from "./notification.controller";

const router = express.Router();

router.get("/", authMiddleware, fetchNotifications);

export default router;
