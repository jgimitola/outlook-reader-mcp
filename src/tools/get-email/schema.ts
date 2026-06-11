import { z } from 'zod';

export const schema = z.object({
  id: z
    .string()
    .describe(
      'The email message ID (obtained from list_emails or search_emails)',
    ),
});

export type Input = z.infer<typeof schema>;
