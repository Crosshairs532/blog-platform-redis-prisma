import express from "express";
import authRoutes from "../app/modules/auth/auth.route.js";
import followRoutes from "../app/modules/follow/follow.routes.js";
import postRoutes from "../app/modules/Post/post.routes.js";
import userRoutes from "../app/modules/user/user.route.js";
import notificationRoutes from "../app/modules/notification/notification.route.js";

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
  {
    path: "/notifications",
    route: notificationRoutes,
  },
];

for (const route of allRoutes) {
  router.use(route.path, route.route);
}

export default router;
