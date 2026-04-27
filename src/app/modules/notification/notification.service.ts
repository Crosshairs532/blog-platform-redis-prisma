import { prisma } from "../../../config/db";
import { getRedisClient } from "../../../config/redis";

export const createNotification = async ({ userId, type, data }) => {
  const redisClient = await getRedisClient();
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      data,
    },
  });

  await redisClient.lPush(
    `notification:${userId}`,
    JSON.stringify(notification),
  );
  global.io.to(`user:${userId}`).emit("notification", notification);

  return notification;
};

export const getNotifications = async (userId) => {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
};
