// src/workers/notification.worker.ts

import { prisma } from "../config/db";
import { rabbitMQ } from "../config/rabbitmq";
import { getRedis } from "../config/redis";

export const startNotificationWorker = async () => {
  const channel = rabbitMQ.getChannel();
  const redisClient = (await getRedis()).getClient();

  channel?.consume("notification_queue", async (msg: any) => {
    if (!msg) return;
    const { userId, type, data } = JSON.parse(msg.content.toString());

    const actor = await prisma.user.findUnique({
      where: { id: data.actorId },
    });

    const notification = await prisma.notification.create({
      data: { userId, type, data },
      include: {},
    });
    const notificationData = {
      ...notification,
      ...actor,
    };

    try {
      const key = `notification:${userId}`;
      await redisClient.lPush(key, JSON.stringify(notification));
      await redisClient.lTrim(key, 0, 49);

      const roomName = `user:${userId}`;

      console.log(`📡 Emitting notification to room: ${roomName}`);

      global.io.to(roomName).emit("notification", notificationData);
      channel.ack(msg);
    } catch (error) {
      console.error("Notification emission failed:", error);
    }
  });
};
