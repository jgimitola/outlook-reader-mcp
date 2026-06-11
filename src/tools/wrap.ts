import { AuthRequiredError } from '../auth.js';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

/**
 * Wraps a tool handler so Graph/network errors come back as readable tool
 * output instead of a raw stack trace.
 */
export function wrapHandler<I>(
  fn: (input: I) => Promise<ToolResult>,
): (input: I) => Promise<ToolResult> {
  return async (input: I) => {
    try {
      return await fn(input);
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: friendlyError(err) }],
        isError: true,
      };
    }
  };
}

function friendlyError(err: unknown): string {
  if (err instanceof AuthRequiredError) return err.message;
  const e = err as { statusCode?: number; message?: string };
  // statusCode -1 = client-side failure: the Graph middleware wraps errors
  // thrown by the auth provider (e.g. AuthRequiredError), losing the class
  // but keeping the message — pass it through untouched.
  if (e?.statusCode === -1 && e?.message) return e.message;
  switch (e?.statusCode) {
    case 400:
      return `Bad request — likely invalid OData filter/orderby syntax. Details: ${e.message ?? ''}`;
    case 401:
      return 'Authentication failed or token expired. Restart the server to re-authenticate.';
    case 403:
      return 'Permission denied. The app registration may be missing the Mail.Read scope.';
    case 404:
      return 'Not found. The message or attachment ID may be stale — re-run list_emails or list_attachments to get fresh IDs.';
    case 429:
      return 'Microsoft Graph throttled the request (429). Wait a moment and retry.';
    default:
      return `Request failed${e?.statusCode ? ` (HTTP ${e.statusCode})` : ''}: ${e?.message ?? String(err)}`;
  }
}
