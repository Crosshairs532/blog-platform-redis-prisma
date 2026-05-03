import express from "express";
import authRoutes from "../app/modules/auth/auth.route.js";
import followRoutes from "../app/modules/follow/follow.routes.js";
import postRoutes from "../app/modules/Post/post.routes.js";
import userRoutes from "../app/modules/user/user.route.js";

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
  {
    path: "/posts",
    route: postRoutes,
  },
  {
    path: "/users",
    route: userRoutes,
  },
];

for (const route of allRoutes) {
  router.use(route.path, route.route);
}

export default router;
