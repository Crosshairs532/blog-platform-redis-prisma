import { Prisma } from "@prisma/client";
import { AppError } from "./ AppError";

type PrismaErrorResponse = {
  message: string;
  statusCode: number;
};

export const handlePrismaError = (err: unknown): PrismaErrorResponse | null => {
  // Known Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const field = (err.meta?.target as string[])?.join(", ");
        throw new AppError(`${field} already exists`, 409);
      }

      case "P2025":
        throw new AppError("Requested resource not found", 404);

      case "P2003":
        throw new AppError(
          "Invalid relation reference (foreign key failed)",
          400,
        );

      case "P2014":
        throw new AppError("Invalid relation operation", 400);

      case "P2016":
        throw new AppError("Query interpretation error", 400);

      default:
        throw new AppError("Database error", 500);
    }
  }

  // Validation error
  if (err instanceof Prisma.PrismaClientValidationError) {
    throw new AppError("Invalid input data", 400);
  }

  // Unknown Prisma error
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    throw new AppError("Unknown database error", 500);
  }

  // Fallback
  throw new AppError("Internal server error", 500);
};
