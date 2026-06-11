import { z } from 'zod';

export const schema = z.object({
  messageId: z.string().describe('The email message ID'),
  attachmentId: z
    .string()
    .describe('The attachment ID (from list_attachments)'),
  saveTo: z
    .string()
    .optional()
    .describe(
      'Directory path to save the file. Defaults to user Downloads folder (e.g. C:\\Users\\username\\Downloads)',
    ),
});

export type Input = z.infer<typeof schema>;
