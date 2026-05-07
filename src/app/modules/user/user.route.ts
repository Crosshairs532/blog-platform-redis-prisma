import { userController } from "./user.controller";

import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

router.get("/:userId/posts", userController.getUserPostsController);
router.get("/", authMiddleware, userController.getAllUsersController);
router.get("/:userId", authMiddleware, userController.getProfile);

router.put("/profile/me", authMiddleware, userController.updateProfileService);

export default router;
