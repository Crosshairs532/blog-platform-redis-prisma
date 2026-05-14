import { prisma } from "../../../config/db";
import { rabbitMQ } from "../../../config/rabbitmq";
import { getRedis } from "../../../config/redis";
declare global {
  var io: any;
}

//* New notification logic - using rabbitMq
export const createNotification = async ({ userId, type, data }: any) => {
  const channel = rabbitMQ.getChannel();
  const payload = Buffer.from(
    JSON.stringify({ userId, type, data, timestamp: Date.now() }),
  );
  channel?.sendToQueue("notification_queue", payload, { persistent: true });
};
export const getNotifications = async (
  userId: string,
  page = 0,
  limit = 20,
) => {
  const redisClient = (await getRedis()).getClient();
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
