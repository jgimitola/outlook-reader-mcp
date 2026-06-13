#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import 'dotenv/config';

import { getConfig } from './auth.js';
import { registerAllTools } from './tools/index.js';

// Pull version from package.json so it stays in sync with published releases.
// Resolves to the project root from both dist/ (build) and src/ (tsx dev).
const { version } = require('../package.json') as { version: string };

async function main() {
  // Fail fast with a readable message instead of a confusing MSAL error on
  // the first tool call.
  getConfig();

  const server = new McpServer({
    name: 'outlook-reader',
    version,
  });
  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // When the client disconnects, stdin ends — but background MSAL device-code
  // polling can keep the event loop alive for up to 15 minutes, leaving an
  // orphaned process. Give in-flight responses a moment to flush, then exit.
  // unref() lets the process exit sooner naturally if the loop drains.
  process.stdin.on('end', () => {
    setTimeout(() => process.exit(0), 5_000).unref();
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
