import { rabbitMQ } from "../config/rabbitmq";
import { getRedis } from "../config/redis";
import { RedisKeys } from "../utils/redisKeys";

export const startFanoutWorker = async () => {
  console.log("Fanout worker running....");
  const channel = rabbitMQ.getChannel();
  const redis = (await getRedis()).getClient();

  channel?.consume("post_fanout_queue", async (msg: any) => {
    if (!msg) return;
    const { postId, authorId, timestamp } = JSON.parse(msg.content.toString());
    console.log("Message from RabbitMQ:", postId, authorId, timestamp);

    try {
      let cursor = 0;
      do {
        const reply = await redis.sScan(
          RedisKeys.followers(authorId),
          cursor as any,
          {
            COUNT: 1000,
          },
        );
        cursor = Number(reply.cursor);
        const followers = reply.members;
        const pipeline = redis.multi();
        for (const followerId of followers) {
          const feedKey = RedisKeys.feed(followerId);
          pipeline.zAdd(feedKey, { score: timestamp, value: postId });
          pipeline.zRemRangeByRank(feedKey, 0, -1001);
        }
        await pipeline.exec();
      } while (cursor !== 0);
      channel.ack(msg);
    } catch (error) {
      console.error("Error in fanout worker:", error);
      channel.nack(msg, false, true);
    }
  });
};
