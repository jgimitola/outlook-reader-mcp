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

/**
 * Thrown when a request needs the user to sign in. Tool handlers surface the
 * message as tool output so the model can tell the user exactly what to do —
 * auth must never silently block inside a tool call.
 */
export class AuthRequiredError extends Error {}

let pendingAuth: {
  verification: string;
  expiresAt: number;
} | null = null;

// Held so sign_out can abort an in-flight device code flow: MSAL checks
// request.cancel between polls.
let pendingRequest: DeviceCodeRequest | null = null;

function rememberToken(result: {
  accessToken: string;
  expiresOn?: Date | null;
}) {
  cachedToken = {
    token: result.accessToken,
    expiresOn: result.expiresOn?.getTime() ?? Date.now() + 5 * 60_000,
  };
}

/**
 * Kicks off the device code flow and resolves as soon as the verification
 * URL + code are available, while MSAL keeps polling in the background.
 * Calling again while a code is still valid returns the same code.
 */
export async function startDeviceCodeAuth(): Promise<string> {
  if (pendingAuth && Date.now() < pendingAuth.expiresAt) {
    return pendingAuth.verification;
  }

  const app = await buildMsalApp();
  return new Promise<string>((resolve, reject) => {
    const request: DeviceCodeRequest = {
      scopes: SCOPES,
      deviceCodeCallback: (response) => {
        pendingAuth = {
          verification: response.message,
          expiresAt: Date.now() + response.expiresIn * 1000,
        };
        // Also mirror to the server log.
        console.error(response.message);
        resolve(response.message);
      },
    };
    pendingRequest = request;

    app
      .acquireTokenByDeviceCode(request)
      .then((result) => {
        if (result) {
          rememberToken(result);
          console.error(
            `Signed in as ${result.account?.username ?? 'unknown account'}.`,
          );
        }
      })
      .catch((err) => {
        // Reaches the tool only if the flow failed before the code was
        // issued; after resolve() this is a no-op and the error is logged.
        reject(err);
        console.error(
          `Device code sign-in did not complete: ${err instanceof Error ? err.message : err}`,
        );
      })
      .finally(() => {
        pendingAuth = null;
        pendingRequest = null;
      });
  });
}

/**
 * Signs out: cancels any in-flight device code flow, drops the in-memory
 * token, and removes all accounts from the persistent cache. Returns the
 * usernames that were removed.
 */
export async function clearAuth(): Promise<string[]> {
  cachedToken = null;
  if (pendingRequest) {
    pendingRequest.cancel = true;
    pendingRequest = null;
  }
  pendingAuth = null;

  const app = await buildMsalApp();
  const cache = app.getTokenCache();
  const accounts = await cache.getAllAccounts();
  for (const account of accounts) {
    await cache.removeAccount(account);
  }
  return accounts.map((a) => a.username);
}

/** Username of the signed-in account, or null when not authenticated. */
export async function getSignedInAccount(): Promise<string | null> {
  const app = await buildMsalApp();
  const accounts = await app.getTokenCache().getAllAccounts();
  return accounts.length > 0 ? pickAccount(accounts).username : null;
}

export async function getAccessToken(): Promise<string> {
  // Reuse the in-memory token until shortly before expiry to avoid
  // hitting the MSAL cache (and the OS credential store) on every request.
  if (cachedToken && Date.now() < cachedToken.expiresOn - 60_000) {
    return cachedToken.token;
  }

  const app = await buildMsalApp();
  const accounts = await app.getTokenCache().getAllAccounts();

  if (accounts.length === 0) {
    if (pendingAuth && Date.now() < pendingAuth.expiresAt) {
      throw new AuthRequiredError(
        `Sign-in is still pending. ${pendingAuth.verification} Retry this request after signing in.`,
      );
    }
    throw new AuthRequiredError(
      'Not signed in to a Microsoft account. Run the authenticate tool first, ' +
        'then retry this request.',
    );
  }

  const account = pickAccount(accounts);
  let result;
  try {
    result = await app.acquireTokenSilent({ account, scopes: SCOPES });
  } catch (err) {
    if (!(err instanceof InteractionRequiredAuthError)) throw err;
    // Refresh token expired or revoked: drop the stale account so the next
    // authenticate run starts clean instead of looping on silent failures.
    await app.getTokenCache().removeAccount(account);
    throw new AuthRequiredError(
      `The cached session for ${account.username} has expired or was revoked. ` +
        'Run the authenticate tool to sign in again, then retry this request.',
    );
  }

  if (!result) throw new Error('Token acquisition returned no result.');
  rememberToken(result);
  return cachedToken!.token;
}
