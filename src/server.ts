import express from "express";
import router from "./router/route";
import { connectRedis } from "./config/redis";
const app = express();

app.use(express.json());
// app.use(cors());

app.use("/api", router);

app.use((err, req, res) => {
  console.error(err?.stack);
});

connectRedis();

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
