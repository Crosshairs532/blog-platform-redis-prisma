import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { userId: string; sessionId: string; email: string };
      sessionId?: string;
      session?: any;
    }
  }
}

export {};
