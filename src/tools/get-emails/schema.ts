import { z } from 'zod';

export const schema = z.object({
  ids: z
    .array(z.string())
    .min(1)
    .max(50)
    .describe(
      'Email message IDs to fetch (from list_emails or search_emails). Max 50.',
    ),
});

export type Input = z.infer<typeof schema>;
