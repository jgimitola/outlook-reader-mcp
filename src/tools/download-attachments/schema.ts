import { z } from 'zod';

export const schema = z.object({
  messageId: z.string().describe('The email message ID'),
  attachmentIds: z
    .array(z.string())
    .optional()
    .describe(
      'Specific attachment IDs to download (from list_attachments). Omit to download ALL file attachments of the message.',
    ),
  saveTo: z
    .string()
    .optional()
    .describe(
      'Directory path to save the files. Defaults to user Downloads folder (e.g. C:\\Users\\username\\Downloads)',
    ),
  includeInline: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'When downloading all attachments, also include inline ones (embedded images, signatures). Default false.',
    ),
});

export type Input = z.infer<typeof schema>;
