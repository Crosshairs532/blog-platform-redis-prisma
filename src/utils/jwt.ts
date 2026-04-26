import jwt, { type JwtPayload } from "jsonwebtoken";

export const generateToken = (user: any, expire: string): JwtPayload => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET as string,
    {
      expiresIn: expire,
    },
  ) as JwtPayload;
};
