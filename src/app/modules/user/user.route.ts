import { userController } from "./user.controller";
// routes/profile.routes.ts
import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/:username", userController.getProfile);
router.get("/id/:userId", userController.getProfile);
router.get("/:userId/posts", userController.getUserPostsController);
// Protected routes
router.put("/profile/me", authMiddleware, userController.updateProfileService);

export default router;
