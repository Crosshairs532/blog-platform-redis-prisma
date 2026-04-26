import type { Request, Response } from "express";
import { generateToken } from "../../../utils/jwt.js";
import { registerUser, loginUser, logoutUser } from "./auth.service.js";
// import { Request, Response } from "express";

export const register = async (req: Request, res: Response) => {
  try {
    const user = await registerUser(req.body);

    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const user = await loginUser(req, req.body);

    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    await logoutUser(req);
    res.json({ message: "Logout Successful" });
  } catch (error) {
    res.status(400).json({ error: error?.message });
  }
};
