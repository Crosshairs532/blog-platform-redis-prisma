import { createClient } from "redis";
import type { RedisClientType } from "redis";

// let client: any;

export class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType;
  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL as string,
    });
    this.client.on("error", (err: any) => console.error("Redis Error:", err));
    this.client.on("connect", () => console.log("Redis Connected"));
  }
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
      console.log("Redis Connected");
    }
  }
  public getClient(): RedisClientType {
    return this.client;
  }
}

// const connectRedis = async () => {
//   try {
//     client = createClient({
//       url: process.env.REDIS_URL as string,
//     });
//     client.on("error", (err: any) => console.error("Redis Error:", err));
//     client.on("connect", () => console.log("Redis Connected"));

//     await client.connect();
//     console.log("Connected to Redis");
//   } catch (error) {
//     console.error("Error connecting to Redis:", error);
//   }
// };

// const getRedisClient = () => {
//   return client;
// };

// export { connectRedis, getRedisClient };
export const getRedis = async () => {
  const redis = RedisClient.getInstance();
  await redis.connect();
  return redis;
};
