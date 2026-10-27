import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";
export { hashPassword, verifyPassword } from "./password.js";
export const prisma = new PrismaClient();
