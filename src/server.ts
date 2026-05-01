import express from "express";
import router from "./router/route";
import { connectRedis } from "./config/redis";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { globalErrorHandler } from "./middlewares/global.error";
import { startWorker } from "./workers/email.worker";
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

connectRedis();
startWorker();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
