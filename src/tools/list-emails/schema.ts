import { z } from 'zod';

export const schema = z.object({
  folder: z
    .string()
    .optional()
    .default('inbox')
    .describe(
      'Folder name or well-known folder: inbox, sentitems, drafts, deleteditems',
    ),
  top: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Number of emails to return (max 50)'),
  skip: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Number of emails to skip, for paging through results (e.g. skip=50 for page 2 with top=50)',
    ),
  filter: z
    .string()
    .optional()
    .describe(
      'OData filter expression. Examples: "isRead eq false", "from/emailAddress/address eq \'someone@example.com\'", "receivedDateTime ge 2024-01-01T00:00:00Z"',
    ),
  orderby: z
    .string()
    .optional()
    .default('receivedDateTime desc')
    .describe('OData orderBy clause. Default: receivedDateTime desc'),
});

export type Input = z.infer<typeof schema>;
