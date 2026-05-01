import { prisma } from "../../../config/db";
import { getRedisClient } from "../../../config/redis";

declare global {
  var io: any;
}

export const createNotification = async ({ userId, type, data }: any) => {
  const redisClient = await getRedisClient();
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      data,
    },
  });

  try {
    const key = `notification:${userId}`;
    await redisClient.lPush(
      `notification:${userId}`,
      JSON.stringify(notification),
    );
    await redisClient.lTrim(key, 0, 49);
    await redisClient.expire(key, 60 * 60 * 24 * 7);
    global?.io?.to(`user:${userId}`).emit("notification", notification);
  } catch (error) {
    console.error("Notification side-effect failed:", error);
  }

  return notification;
};

export const getNotifications = async (
  userId: string,
  page = 0,
  limit = 20,
) => {
  const redisClient = await getRedisClient();
  const key = `notification:${userId}`;
  try {
    const cached = await redisClient.lRange(
      key,
      page * limit,
      page * limit + limit - 1,
    );
    if (cached && cached.length > 0) {
      return cached.map((item: any) => JSON.parse(item));
    }
  } catch (error) {
    console.error("Redis notification read failed:", error);
  }
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
};
