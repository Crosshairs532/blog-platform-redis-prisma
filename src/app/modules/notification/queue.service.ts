import { getRedisClient } from "../../../config/redis";
import nodemailer from "nodemailer";

let transporter: any;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }: any) => {
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error(`Email failed to ${to}:`, err);
    throw err;
  }
};

export const pushEmailJob = async (job: any) => {
  if (!job.toUserId || !job.type || !job.postId) {
    throw new Error("Invalid email job payload");
  }
  const redisClient = await getRedisClient();
  await redisClient.lPush("queue:email", JSON.stringify(job));
};
