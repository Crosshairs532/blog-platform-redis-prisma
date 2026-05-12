import { rabbitMQ } from "../config/rabbitmq";
import { getRedis } from "../config/redis";

export const invaldidataCacheWorker = async () => {
  const channel = rabbitMQ.getChannel();
  const redis = (await getRedis()).getClient();
  channel.consume("cache_invalidation", async (msg: any) => {
    const { type, id } = JSON.parse(msg.content.toString());
    if (type === "USER_PROFILE") {
      await redis.del(`user:${id}:profile`);
      // Also increment version for list invalidation
      await redis.incr("global:user_list_version");
    }
    channel.ack(msg);
  });
};
