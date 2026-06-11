# outlook-reader-mcp

MCP (Model Context Protocol) server for reading Outlook / Microsoft 365 mail through Microsoft Graph. Read-only by design: list, search, and fetch emails — single or batched — and download attachments safely to disk.

## Tools

| Tool                   | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `authenticate`         | Sign in with a device code shown directly in the chat; reports current account      |
| `sign_out`             | Remove the cached session from this machine; cancels any pending sign-in            |
| `list_emails`          | List emails from any folder with OData filters, ordering, and paging (`top`/`skip`) |
| `search_emails`        | Keyword search across subject, body, sender, and recipients                         |
| `get_email`            | Full content of one email (plain-text body)                                         |
| `get_emails`           | Full content of up to 50 emails in one batched Graph request                        |
| `list_folders`         | Mail folders with unread/total counts                                               |
| `list_attachments`     | Attachment IDs, names, sizes, and types for an email                                |
| `download_attachment`  | Save one attachment to disk                                                         |
| `download_attachments` | Save several (or all) attachments of an email in one call                           |

## Setup

### 1. Create an Azure app registration

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → **New registration**.
2. Supported account types: pick what fits — "Personal Microsoft accounts only" for outlook.com/hotmail mailboxes, or an org option for Microsoft 365.
3. No redirect URI needed. After creating, under **Authentication** enable **Allow public client flows**.
4. Under **API permissions** add delegated Microsoft Graph permissions: `Mail.Read`, `User.Read`.
5. Copy the **Application (client) ID**.

### 2. Configure your MCP client

```json
{
  "mcpServers": {
    "outlook-reader": {
      "command": "npx",
      "args": ["-y", "outlook-reader-mcp"],
      "env": {
        "CLIENT_ID": "your-application-client-id",
        "TENANT_ID": "consumers"
      }
    }
  }
}
```

`TENANT_ID`: `consumers` for personal accounts, `organizations` or your tenant GUID for work accounts, `common` (default) for both.

Optional: `OUTLOOK_ACCOUNT=you@example.com` pins which cached account to use if several have signed in.

### 3. First run

Ask your assistant to run the `authenticate` tool (or just ask it to read your mail — any tool that needs auth will tell it to). The chat shows a URL and a one-time code: open the URL, enter the code, sign in. Sessions are cached, so this only happens once per machine.

## Token cache & security

- Tokens are cached per user in the OS application-data directory (`%LOCALAPPDATA%\outlook-reader-mcp` on Windows, `~/Library/Application Support/outlook-reader-mcp` on macOS, `$XDG_CONFIG_HOME/outlook-reader-mcp` on Linux).
- The cache is encrypted at rest with the OS credential store (DPAPI / Keychain / libsecret). If no store is available it falls back to a permission-restricted plaintext file and warns on stderr.
- Scopes are read-only (`Mail.Read`); this server cannot send, modify, or delete mail.
- Attachment filenames are sanitized (path traversal, reserved characters) before writing to disk, and existing files are never overwritten.
- To revoke access: remove the app under [account.live.com/consent/Manage](https://account.live.com/consent/Manage) (personal) or have your admin revoke sessions, then delete the cache directory.

## Development

```bash
npm install
npm run mcp      # run from source (tsx)
npm run build    # compile to dist/
npm run format   # prettier
```

## License

GPL-3.0
