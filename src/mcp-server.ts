#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import 'dotenv/config';

import { getConfig } from './auth.js';
import { registerAllTools } from './tools/index.js';

async function main() {
  // Fail fast with a readable message instead of a confusing MSAL error on
  // the first tool call.
  getConfig();

  const server = new McpServer({
    name: 'outlook-reader',
    version: '1.0.0',
  });
  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
