import { z } from "zod";

export const profileBodySchema = z
  .object({
    age: z.number().int().positive(),
    sex: z.enum(["male", "female"]),
    heightCm: z.number().positive(),
    weightKg: z.number().positive(),
    activityLevel: z.enum(["sedentary", "light", "moderate", "very_active"]),
    jobType: z.enum(["desk", "mixed", "physical"]),
    workoutsPerWeek: z.number().int().nonnegative(),
    goal: z.enum(["weight_loss", "maintain", "muscle_gain"]),
  })
  .strict();

export type ProfileInput = z.infer<typeof profileBodySchema>;
