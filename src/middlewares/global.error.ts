import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { handlePrismaError } from "../utils/PrismaError";
import { AppError } from "../utils/ AppError";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = "Something went wrong";

  const prismaError = handlePrismaError(err);
  if (prismaError) {
    statusCode = prismaError?.statusCode;
    message = prismaError?.message;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = "Invalid input data";
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};
