import { z } from "zod";
export const CarSchema = z.object({
marca: z.string().nullable().optional(),
modelo: z.string().nullable().optional(),
version: z.string().nullable().optional(),
precio_lista: z.string().nullable().optional(),
bono_marca: z.string().nullable().optional(),
bono_financiamiento: z.string().nullable().optional(),
});
export type Car = z.infer<typeof CarSchema>;
