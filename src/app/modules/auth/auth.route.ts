import { Router } from "express";
import {
  register,
  login,
  logout,
  logoutAll,
  refresh,
  getSessions,
} from "./auth.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

//! Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

//! protected Routes
router.post("/logout", authMiddleware, logout);
router.post("/logout-all", authMiddleware, logoutAll);
router.get("/sessions", authMiddleware, getSessions);

export default router;
