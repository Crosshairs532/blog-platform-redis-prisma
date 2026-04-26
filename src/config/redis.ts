import { createClient } from "redis";

let client: any;
const connectRedis = async () => {
  try {
    client = createClient({
      url: process.env.REDIS_URL as string,
    });
    client.on("error", (err) => console.log("Redis Client Error", err));

    await client.connect();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Error connecting to Redis:", error);
  }
};

const getRedisClient = () => {
  return client;
};

export { connectRedis, getRedisClient };
