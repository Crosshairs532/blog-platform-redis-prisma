import type { Request, Response } from "express";
import {
  getUserSessions,
  loginUser,
  logoutAllDevices,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "./auth.service";

export const register = async (req: Request, res: Response) => {
  console.log(req.body);
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const result = await loginUser(req, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const result = await logoutUser(req);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const logoutAll = async (req: Request, res: Response) => {
  try {
    const result = await logoutAllDevices(req);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  console.log("GetSession. ROute");
  try {
    const sessions = await getUserSessions(req.user!.userId);
    console.log("getSessions -- ", sessions);
    res.json({ sessions });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
