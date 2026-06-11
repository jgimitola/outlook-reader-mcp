import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { wrapHandler } from '../wrap.js';
import { description, handler } from './definition.js';
import { KEY } from './key.js';
import { schema } from './schema.js';

export function register(server: McpServer): void {
  server.registerTool(
    KEY,
    { description, inputSchema: schema },
    wrapHandler(handler),
  );
}
