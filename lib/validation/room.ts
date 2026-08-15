import { z } from "zod";

export const roomOperationalStatusSchema = z.enum(["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE"]);

export const createRoomTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  capacity: z.coerce.number().int().min(1).max(20),
  basePriceCents: z.coerce.number().int().min(0),
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial().extend({
  isActive: z.coerce.boolean().optional(),
});

export const createRoomSchema = z.object({
  roomTypeId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(1).max(20).optional(),
  priceOverrideCents: z.coerce.number().int().min(0).optional(),
});

export const updateRoomSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  capacity: z.coerce.number().int().min(1).max(20).optional(),
  priceOverrideCents: z.coerce.number().int().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});
