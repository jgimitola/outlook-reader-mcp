import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { register as registerAuthenticate } from './authenticate/index.js';
import { register as registerDownloadAttachment } from './download-attachment/index.js';
import { register as registerDownloadAttachments } from './download-attachments/index.js';
import { register as registerGetEmail } from './get-email/index.js';
import { register as registerGetEmails } from './get-emails/index.js';
import { register as registerListAttachments } from './list-attachments/index.js';
import { register as registerListEmails } from './list-emails/index.js';
import { register as registerListFolders } from './list-folders/index.js';
import { register as registerSearchEmails } from './search-emails/index.js';
import { register as registerSignOut } from './sign-out/index.js';

export function registerAllTools(server: McpServer): void {
  registerAuthenticate(server);
  registerSignOut(server);
  registerListEmails(server);
  registerGetEmail(server);
  registerGetEmails(server);
  registerSearchEmails(server);
  registerListFolders(server);
  registerListAttachments(server);
  registerDownloadAttachment(server);
  registerDownloadAttachments(server);
}
