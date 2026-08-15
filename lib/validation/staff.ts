import { z } from "zod";

export const staffRoleSchema = z.enum(["OWNER", "MANAGER", "RECEPTION", "HOUSEKEEPING", "READ_ONLY"]);

export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  role: staffRoleSchema,
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});
