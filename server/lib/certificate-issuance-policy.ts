import { z } from 'zod';

export const certificateCreationRequestSchema = z.object({
  examAttemptId: z.coerce.number().int().positive(),
}).strict();
