import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { sanitizeFilename, uniquePath } from '../../files.js';
import { downloadAttachment } from '../../mail.js';
import type { Input } from './schema.js';

export const description =
  'Download a specific email attachment and save it to disk. Use list_attachments first to get the attachment ID. To save several (or all) attachments from an email in one call, use download_attachments instead. Returns the full path where the file was saved.';

export async function handler({ messageId, attachmentId, saveTo }: Input) {
  const att = await downloadAttachment(messageId, attachmentId);

  if (!att.contentBytes) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Attachment has no downloadable content (may be an item attachment, not a file).',
        },
      ],
    };
  }

  const dir = saveTo ?? join(homedir(), 'Downloads');
  mkdirSync(dir, { recursive: true });

  const buf = Buffer.from(att.contentBytes, 'base64');
  const filePath = uniquePath(dir, sanitizeFilename(att.name));
  writeFileSync(filePath, buf);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Saved: ${filePath}\nSize: ${(buf.length / 1024).toFixed(1)} KB\nType: ${att.contentType}`,
      },
    ],
  };
}
