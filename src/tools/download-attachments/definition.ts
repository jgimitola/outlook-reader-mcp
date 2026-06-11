import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { sanitizeFilename, uniquePath } from '../../files.js';
import { downloadAttachment, listAttachments } from '../../mail.js';
import type { Input } from './schema.js';

export const description =
  'Download multiple attachments from an email in a single call and save them to disk. Omit attachmentIds to download all file attachments. Returns the saved path for each file.';

export async function handler({
  messageId,
  attachmentIds,
  saveTo,
  includeInline,
}: Input) {
  const all = await listAttachments(messageId);

  const lines: string[] = [];
  let targets;
  if (attachmentIds?.length) {
    const known = new Set(all.map((a) => a.id));
    for (const id of attachmentIds) {
      if (!known.has(id)) lines.push(`Not found: attachment ID ${id}`);
    }
    targets = all.filter((a) => attachmentIds.includes(a.id));
  } else {
    targets = all.filter((a) => includeInline || !a.isInline);
  }

  if (targets.length === 0) {
    lines.push('No attachments to download.');
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  }

  const dir = saveTo ?? join(homedir(), 'Downloads');
  mkdirSync(dir, { recursive: true });

  // Sequential on purpose: uniquePath checks disk, so parallel downloads of
  // same-named attachments could race into the same target path.
  for (const a of targets) {
    try {
      const att = await downloadAttachment(messageId, a.id);
      if (!att.contentBytes) {
        lines.push(
          `Skipped: ${a.name} (no downloadable content — item attachment, not a file)`,
        );
        continue;
      }
      const buf = Buffer.from(att.contentBytes, 'base64');
      const filePath = uniquePath(dir, sanitizeFilename(att.name ?? a.name));
      writeFileSync(filePath, buf);
      lines.push(`Saved: ${filePath} (${(buf.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      lines.push(
        `Failed: ${a.name} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
