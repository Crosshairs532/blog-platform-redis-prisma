import type { Request, Response } from "express";
import { getNotifications } from "./notification.service";

export const fetchNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req?.user?.userId;
    const { page = 0, limit = 20 } = req.query;

    const notifications = await getNotifications(
      userId as string,
      Number(page),
      Number(limit)
    );

    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
};
