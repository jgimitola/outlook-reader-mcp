import fs from 'fs';
import path from 'path';

import {
  AccountInfo,
  DeviceCodeRequest,
  PublicClientApplication,
  SilentFlowRequest,
} from '@azure/msal-node';

const CACHE_FILE = path.join(__dirname, '..', 'token_cache.json');
const SCOPES = ['Mail.Read', 'User.Read'];

let msalApp: PublicClientApplication | null = null;
let cachedToken: { token: string; expiresOn: number } | null = null;

function buildMsalApp(): PublicClientApplication {
  if (msalApp) return msalApp;

  const cachePlugin = {
    beforeCacheAccess: async (ctx: {
      tokenCache: { deserialize: (s: string) => void };
    }) => {
      if (fs.existsSync(CACHE_FILE)) {
        ctx.tokenCache.deserialize(fs.readFileSync(CACHE_FILE, 'utf-8'));
      }
    },
    afterCacheAccess: async (ctx: {
      cacheHasChanged: boolean;
      tokenCache: { serialize: () => string };
    }) => {
      if (ctx.cacheHasChanged) {
        fs.writeFileSync(CACHE_FILE, ctx.tokenCache.serialize());
      }
    },
  };

  msalApp = new PublicClientApplication({
    auth: {
      clientId: process.env.CLIENT_ID!,
      authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    },
    cache: { cachePlugin },
  });
  return msalApp;
}

export async function getAccessToken(): Promise<string> {
  // Reuse the in-memory token until shortly before expiry to avoid
  // hitting the MSAL cache (and disk) on every Graph request.
  if (cachedToken && Date.now() < cachedToken.expiresOn - 60_000) {
    return cachedToken.token;
  }

  const app = buildMsalApp();
  const accounts: AccountInfo[] = await app.getTokenCache().getAllAccounts();

  let result;
  if (accounts.length > 0) {
    const request: SilentFlowRequest = { account: accounts[0], scopes: SCOPES };
    result = await app.acquireTokenSilent(request);
  } else {
    const request: DeviceCodeRequest = {
      scopes: SCOPES,
      deviceCodeCallback: (response) => {
        // stdout is the MCP transport — writing there corrupts JSON-RPC framing.
        console.error(response.message);
      },
    };
    result = await app.acquireTokenByDeviceCode(request);
  }

  cachedToken = {
    token: result!.accessToken,
    expiresOn: result!.expiresOn?.getTime() ?? Date.now() + 5 * 60_000,
  };
  return cachedToken.token;
}
