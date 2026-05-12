import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedis } from "./redis";

export const setupSockets = async (httpServer: any) => {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  const pubClient = (await getRedis()).getClient();
  const subClient = pubClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined room`);
    }
  });

  return io;
};
