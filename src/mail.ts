import { Client } from '@microsoft/microsoft-graph-client';
import { MailFolder, Message } from '@microsoft/microsoft-graph-types';

import { getAccessToken } from './auth';

let client: Client | null = null;

function buildClient(): Client {
  if (client) return client;
  client = Client.initWithMiddleware({
    authProvider: { getAccessToken },
  });
  return client;
}

const LIST_FIELDS =
  'id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview';
const DETAIL_FIELDS =
  'id,subject,from,toRecipients,receivedDateTime,hasAttachments,body';
const PREFER_TEXT_BODY = 'outlook.body-content-type="text"';

export interface ListEmailsOptions {
  top?: number;
  skip?: number;
  filter?: string;
  folder?: string;
  orderby?: string;
}

export async function listEmails(
  options: ListEmailsOptions = {},
): Promise<Message[]> {
  const {
    top = 10,
    skip,
    filter,
    folder = 'inbox',
    orderby = 'receivedDateTime desc',
  } = options;
  const client = buildClient();

  let req = client
    .api(`/me/mailFolders/${encodeURIComponent(folder)}/messages`)
    .top(top)
    .orderby(orderby)
    .select(LIST_FIELDS);

  if (skip) req = req.skip(skip);
  if (filter) req = req.filter(filter);

  const res = await req.get();
  return res.value as Message[];
}

export async function listFolders(): Promise<MailFolder[]> {
  const client = buildClient();
  const res = await client
    .api('/me/mailFolders')
    .select('id,displayName,unreadItemCount,totalItemCount')
    .top(50)
    .get();
  return res.value as MailFolder[];
}

export async function getEmail(id: string): Promise<Message> {
  const client = buildClient();
  return client
    .api(`/me/messages/${encodeURIComponent(id)}`)
    .header('Prefer', PREFER_TEXT_BODY)
    .select(DETAIL_FIELDS)
    .get();
}

export type BatchEmailResult =
  | { ok: true; message: Message }
  | { ok: false; id: string; error: string };

export async function getEmails(ids: string[]): Promise<BatchEmailResult[]> {
  const client = buildClient();
  const results: BatchEmailResult[] = [];

  // Graph JSON batching allows max 20 sub-requests per call.
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const batch = {
      requests: chunk.map((id, idx) => ({
        id: String(idx),
        method: 'GET',
        url: `/me/messages/${encodeURIComponent(id)}?$select=${DETAIL_FIELDS}`,
        headers: { Prefer: PREFER_TEXT_BODY },
      })),
    };

    const res = await client.api('/$batch').post(batch);

    // Responses come back in arbitrary order; re-align to input order via id.
    const byId = new Map<string, { status: number; body: unknown }>(
      (res.responses as { id: string; status: number; body: unknown }[]).map(
        (r) => [r.id, r],
      ),
    );
    chunk.forEach((id, idx) => {
      const r = byId.get(String(idx));
      if (r && r.status >= 200 && r.status < 300) {
        results.push({ ok: true, message: r.body as Message });
      } else {
        const errBody = r?.body as { error?: { message?: string } } | undefined;
        results.push({
          ok: false,
          id,
          error: `HTTP ${r?.status ?? '?'}: ${errBody?.error?.message ?? 'request failed'}`,
        });
      }
    });
  }

  return results;
}

export async function searchEmails(
  query: string,
  top = 10,
): Promise<Message[]> {
  const client = buildClient();
  // Escape embedded quotes so user input can't break the $search phrase syntax.
  const safeQuery = query.replace(/"/g, '\\"');
  const res = await client
    .api('/me/messages')
    .search(`"${safeQuery}"`)
    .top(top)
    .select(LIST_FIELDS)
    .get();
  return res.value as Message[];
}

export interface AttachmentInfo {
  id: string;
  name: string;
  size: number;
  contentType: string;
  isInline: boolean;
}

export async function listAttachments(
  messageId: string,
): Promise<AttachmentInfo[]> {
  const client = buildClient();
  const res = await client
    .api(`/me/messages/${encodeURIComponent(messageId)}/attachments`)
    .select('id,name,size,contentType,isInline')
    .get();
  return res.value as AttachmentInfo[];
}

export async function downloadAttachment(
  messageId: string,
  attachmentId: string,
): Promise<{ name: string; contentBytes: string; contentType: string }> {
  const client = buildClient();
  const att = await client
    .api(
      `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    )
    .get();
  return {
    name: att.name,
    contentBytes: att.contentBytes,
    contentType: att.contentType,
  };
}
