// src/workers/fanout.worker.ts
import { newPostTemplate } from "../app/modules/notification/emailTemplate";
import { createNotification } from "../app/modules/notification/notification.service";
import { rabbitMQ } from "../config/rabbitmq";
import { getRedis } from "../config/redis";
import { RedisKeys } from "../utils/redisKeys";
import { prisma } from "../config/db"; 

export const startFanoutWorker = async () => {
  console.log(" Fanout worker running....");
  const channel = rabbitMQ.getChannel();
  const redis = (await getRedis()).getClient();

  channel?.consume("post_fanout_queue", async (msg: any) => {
    if (!msg) return;
    const { postId, authorId, timestamp } = JSON.parse(msg.content.toString());

    try {
      const author = await prisma.user.findUnique({
        where: { id: authorId },
        select: { username: true },
      });
      const authorName = author?.username || "Someone you follow";

      let cursor = "0";
      do {
        const reply = await redis.sScan(
          RedisKeys.followers(authorId),
          cursor as any,
          { COUNT: 1000 },
        );
        cursor = reply.cursor;
        const followerIds = reply.members;

        if (followerIds.length > 0) {
          const followersData = await prisma.user.findMany({
            where: { id: { in: followerIds } },
            select: { id: true, email: true },
          });

          const pipeline = redis.multi();

          for (const f of followersData) {
            const feedKey = RedisKeys.feed(f.id);

            pipeline.zAdd(feedKey, {
              score: Number(timestamp),
              value: String(postId),
            });
            pipeline.zRemRangeByRank(feedKey, 0, -1001);

            const template = newPostTemplate({ username: authorName, postId });
            const emailJob = JSON.stringify({
              to: f.email,
              subject: template.subject,
              html: template.html,
              name: authorName,
            });
            channel.sendToQueue("email_queue", Buffer.from(emailJob), {
              persistent: true,
            });

            await createNotification({
              userId: f.id,
              type: "POST_CREATED",
              data: { actorId: authorId, postId: postId },
            });
          }
          await pipeline.exec();
        }
      } while (cursor !== "0");

      channel.ack(msg);
    } catch (error) {
      channel.nack(msg, false, true);
    }
  });
};
