import express from "express";
import router from "./router/route";
import { connectRedis } from "./config/redis";
import cors from "cors";
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "*",
  }),
);

app.use("/api", router);

app.use((err, req, res) => {
  console.error(err?.stack);
});

connectRedis();

app.listen(5000, (port) => {
  console.log(`Server is running on port ${5000 | process.env.PORT}`);
});
