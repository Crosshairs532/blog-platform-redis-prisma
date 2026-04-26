import express from "express";

const router = express.Router();

const authRoutes = await import("../app/modules/auth/auth.route.js");

const allRoutes = [
  {
    path: "/auth",
    route: authRoutes,
  },
];

for (const route of allRoutes) {
  router.use(route.path, route.route.default);
}

export default router;
