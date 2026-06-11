import { listFolders } from '../../mail.js';

export const description =
  'List all mail folders in the mailbox, including custom folders.';

export async function handler(_input: Record<string, never>) {
  const folders = await listFolders();
  const text = folders
    .map(
      (f) =>
        `${f.displayName} (id: ${f.id}, unread: ${f.unreadItemCount ?? 0}, total: ${f.totalItemCount ?? 0})`,
    )
    .join('\n');
  return {
    content: [{ type: 'text' as const, text: text || 'No folders found.' }],
  };
}
