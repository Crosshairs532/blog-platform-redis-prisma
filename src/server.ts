import express from "express";
import router from "./router/route";
import {
  // connectRedis,
  getRedis,
  // getRedisClient,
  RedisClient,
} from "./config/redis";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { globalErrorHandler } from "./middlewares/global.error";
import { startEmailWorker } from "./workers/email.worker";
import { startFanoutWorker } from "./workers/fanout.worker";
import { startNotificationWorker } from "./workers/notification.worker";
import { rabbitMQ } from "./config/rabbitmq";
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
global.io = io;

app.use(express.json());
app.use(
  cors({
    origin: "*",
  }),
);

app.use("/api", router);
app.use(globalErrorHandler);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    const roomName = userId.startsWith("user:") ? userId : `user:${userId}`;
    socket.join(roomName);
    console.log(`✅ Socket ${socket.id} joined room: ${roomName}`);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});
async function bootstrap() {
  try {
    await RedisClient.getInstance();
    console.log("✅ Redis Ready");

    await rabbitMQ.init();
    console.log("✅ RabbitMQ Ready");
    startEmailWorker();
    startFanoutWorker();
    startNotificationWorker();

    server.listen(5000, () => {
      console.log("🚀 Server running on http://localhost:5000");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
  }
}

bootstrap();
