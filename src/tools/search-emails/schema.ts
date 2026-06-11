import { z } from 'zod';

export const schema = z.object({
  query: z
    .string()
    .describe("Search terms, e.g. 'invoice from acme', 'meeting next week'"),
  top: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .default(10)
    .describe('Number of results to return (max 25)'),
});

export type Input = z.infer<typeof schema>;
