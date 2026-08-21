import { z } from "zod";

export const periodSchema = z.object({
  periodStart: z
    .string()
    .describe("ISO date string for period start, e.g. 2025-01-01"),
  periodEnd: z
    .string()
    .describe("ISO date string for period end, e.g. 2025-01-31"),
});

export const paginationSchema = z.object({
  limit: z.number().optional().default(10),
});

export const granularitySchema = z.object({
  granularity: z
    .enum(["daily", "weekly", "monthly"])
    .optional()
    .default("daily"),
});
