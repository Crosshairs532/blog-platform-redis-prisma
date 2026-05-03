import { userController } from "./user.controller";

import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, userController.getAllUsersController);

// router.get("/id/:userId", userController.getProfile);
router.get("/:userId/posts", userController.getUserPostsController);
// Protected routes
router.get("/:userId", authMiddleware, userController.getProfile);
router.put("/profile/me", authMiddleware, userController.updateProfileService);

export default router;
