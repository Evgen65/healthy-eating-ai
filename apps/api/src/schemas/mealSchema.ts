import { z } from "zod";

export const mealIdParamsSchema = z.object({
  mealId: z.string().uuid(),
});

const mealItemInputSchema = z
  .object({
    name: z.string().trim().min(1),
    quantityG: z.number().positive().optional(),
    calories: z.number().int().nonnegative(),
    proteinG: z.number().nonnegative(),
    fatG: z.number().nonnegative(),
    carbsG: z.number().nonnegative(),
  })
  .strict();

export const mealBodySchema = z
  .object({
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    eatenAt: z.coerce.date(),
    items: z.array(mealItemInputSchema).min(1),
  })
  .strict();

export type MealItemInput = z.infer<typeof mealItemInputSchema>;
export type MealInput = z.infer<typeof mealBodySchema>;
