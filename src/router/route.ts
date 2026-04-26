import express from "express";
import authRoutes from "../app/modules/auth/auth.route.js";
import followRoutes from "../app/modules/follow/follow.routes.js";
const router = express.Router();

const allRoutes = [
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/follow",
    route: followRoutes,
  },
];

for (const route of allRoutes) {
  router.use(route.path, route.route);
}

export default router;
