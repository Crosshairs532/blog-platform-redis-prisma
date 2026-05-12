import { prisma } from "../config/db";
import { rabbitMQ } from "../config/rabbitmq";
import { getRedis } from "../config/redis";

export const startNotificationWorker = async () => {
  console.log("Notification worker running....");
  const channel = rabbitMQ.getChannel();
  const redisClient = (await getRedis()).getClient();

  channel?.consume("notification_queue", async (msg: any) => {
    if (!msg) return;
    const { userId, type, data } = JSON.parse(msg.content.toString());

    // db write
    const notification = await prisma.notification.create({
      data: { userId, type, data },
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
      channel.ack(msg);
    } catch (error) {
      console.error("Notification side-effect failed:", error);
    }
  });
};
