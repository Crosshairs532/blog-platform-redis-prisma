import jwt, { type JwtPayload } from "jsonwebtoken";

export const generateToken = (user: any, expire: string): string => {
  return jwt.sign(user, process.env.JWT_SECRET as string, {
    expiresIn: expire,
  });
};
