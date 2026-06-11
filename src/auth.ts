import fs from 'fs';
import { homedir } from 'os';
import path from 'path';

import {
  AccountInfo,
  DeviceCodeRequest,
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-node';
import {
  DataProtectionScope,
  FilePersistence,
  IPersistence,
  PersistenceCachePlugin,
  PersistenceCreator,
} from '@azure/msal-node-extensions';

const SCOPES = ['Mail.Read', 'User.Read'];
const APP_DIR_NAME = 'outlook-reader-mcp';

export function getConfig(): { clientId: string; tenantId: string } {
  const clientId = process.env.CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'CLIENT_ID environment variable is required. Create an Azure app registration ' +
        '(public client, device code flow, Mail.Read + User.Read delegated permissions) ' +
        'and set CLIENT_ID to its application ID.',
    );
  }
  return { clientId, tenantId: process.env.TENANT_ID ?? 'common' };
}

/**
 * Per-user OS data directory. The token cache must never live inside the
 * package or a project folder: it would be world-shared on global installs
 * and one `git add -f` away from being published.
 */
function cacheDir(): string {
  if (process.platform === 'win32') {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'),
      APP_DIR_NAME,
    );
  }
  if (process.platform === 'darwin') {
    return path.join(homedir(), 'Library', 'Application Support', APP_DIR_NAME);
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'),
    APP_DIR_NAME,
  );
}

/**
 * Encrypted-at-rest persistence: DPAPI on Windows, Keychain on macOS,
 * libsecret on Linux. Falls back to a plaintext file (chmod 600 where
 * supported) only if the platform store is unavailable.
 */
async function createPersistence(cachePath: string): Promise<IPersistence> {
  try {
    return await PersistenceCreator.createPersistence({
      cachePath,
      dataProtectionScope: DataProtectionScope.CurrentUser,
      serviceName: APP_DIR_NAME,
      accountName: 'msal-token-cache',
      usePlaintextFileOnLinux: false,
    });
  } catch (err) {
    console.error(
      `Warning: OS-level token encryption unavailable (${err instanceof Error ? err.message : err}). ` +
        `Falling back to a plaintext token cache at ${cachePath} — protect this file.`,
    );
    const persistence = await FilePersistence.create(cachePath);
    if (process.platform !== 'win32') {
      fs.chmodSync(cachePath, 0o600);
    }
    return persistence;
  }
}

let msalAppPromise: Promise<PublicClientApplication> | null = null;
let cachedToken: { token: string; expiresOn: number } | null = null;

function buildMsalApp(): Promise<PublicClientApplication> {
  if (msalAppPromise) return msalAppPromise;

  msalAppPromise = (async () => {
    const { clientId, tenantId } = getConfig();
    const dir = cacheDir();
    fs.mkdirSync(dir, { recursive: true });
    const persistence = await createPersistence(
      path.join(dir, 'token_cache.bin'),
    );

    return new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
      cache: { cachePlugin: new PersistenceCachePlugin(persistence) },
    });
  })();
  return msalAppPromise;
}

function pickAccount(accounts: AccountInfo[]): AccountInfo {
  const hint = process.env.OUTLOOK_ACCOUNT?.toLowerCase();
  const account = hint
    ? (accounts.find((a) => a.username.toLowerCase() === hint) ?? accounts[0])
    : accounts[0];
  if (
    accounts.length > 1 ||
    (hint && account.username.toLowerCase() !== hint)
  ) {
    console.error(`Using cached account: ${account.username}`);
  }
  return account;
}

async function acquireByDeviceCode(app: PublicClientApplication) {
  const request: DeviceCodeRequest = {
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      // stdout is the MCP transport — writing there corrupts JSON-RPC framing.
      console.error(response.message);
    },
  };
  const result = await app.acquireTokenByDeviceCode(request);
  if (!result)
    throw new Error('Device code authentication returned no result.');
  return result;
}

export async function getAccessToken(): Promise<string> {
  // Reuse the in-memory token until shortly before expiry to avoid
  // hitting the MSAL cache (and the OS credential store) on every request.
  if (cachedToken && Date.now() < cachedToken.expiresOn - 60_000) {
    return cachedToken.token;
  }

  const app = await buildMsalApp();
  const accounts = await app.getTokenCache().getAllAccounts();

  let result;
  if (accounts.length > 0) {
    const account = pickAccount(accounts);
    try {
      result = await app.acquireTokenSilent({ account, scopes: SCOPES });
    } catch (err) {
      if (!(err instanceof InteractionRequiredAuthError)) throw err;
      // Refresh token expired or revoked: drop the stale account so we don't
      // get stuck in a silent-failure loop, then re-run device code.
      console.error(
        `Cached credentials for ${account.username} expired or were revoked; re-authenticating.`,
      );
      await app.getTokenCache().removeAccount(account);
      result = await acquireByDeviceCode(app);
    }
  } else {
    result = await acquireByDeviceCode(app);
  }

  if (!result) throw new Error('Token acquisition returned no result.');
  cachedToken = {
    token: result.accessToken,
    expiresOn: result.expiresOn?.getTime() ?? Date.now() + 5 * 60_000,
  };
  return cachedToken.token;
}
