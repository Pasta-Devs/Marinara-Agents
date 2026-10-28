import { z } from "zod";

export const personaQuerySchema = z.object({ personaId: z.string().trim().min(1) });
