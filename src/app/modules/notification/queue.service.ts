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

export const sendEmail = async ({ name, to, subject, html, text }: any) => {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"${name} via YourApp" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text,
    });
  } catch (err: any) {
    console.error(`Email failed to ${to}:`, err);
    switch (err.code) {
      case "ECONNECTION":
      case "ETIMEDOUT":
        console.error("Network error - retry later:", err.message);
        break;
      case "EAUTH":
        console.error("Authentication failed:", err.message);
        break;
      case "EENVELOPE":
        console.error("Invalid recipients:", err.rejected);
        break;
      default:
        console.error("Send failed:", err.message);
    }
  }
};
