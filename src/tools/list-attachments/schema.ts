import { z } from 'zod';

export const schema = z.object({
  messageId: z
    .string()
    .describe('The email message ID (from list_emails or search_emails)'),
});

export type Input = z.infer<typeof schema>;
