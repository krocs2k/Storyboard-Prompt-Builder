import { prisma } from '@/lib/db';

/**
 * BunnyCDN Storage + CDN integration.
 *
 * Config is stored in the SystemConfig table (DB-first, env fallback) so it works
 * consistently across managed and self-hosted deployments:
 *   BUNNY_API_KEY          – bunny.net Account API key (used only to provision zones)
 *   BUNNY_STORAGE_ZONE     – provisioned Storage Zone name
 *   BUNNY_STORAGE_PASSWORD – Storage Zone read/write access key
 *   BUNNY_STORAGE_HOST     – Storage hostname (e.g. storage.bunnycdn.com)
 *   BUNNY_PULL_ZONE        – provisioned Pull Zone name
 *   BUNNY_CDN_URL          – public CDN base url (e.g. https://spb-xxxx.b-cdn.net)
 *   BUNNY_STORAGE_REGION   – primary storage region code
 */

export interface BunnyConfig {
  apiKey: string | null;
  storageZone: string | null;
  storagePassword: string | null;
  storageHost: string | null;
  pullZone: string | null;
  cdnUrl: string | null;
  region: string | null;
}

export const BUNNY_CONFIG_KEYS = [
  'BUNNY_API_KEY',
  'BUNNY_STORAGE_ZONE',
  'BUNNY_STORAGE_PASSWORD',
  'BUNNY_STORAGE_HOST',
  'BUNNY_PULL_ZONE',
  'BUNNY_CDN_URL',
  'BUNNY_STORAGE_REGION',
];

const DEFAULT_STORAGE_HOST = 'storage.bunnycdn.com';
const CACHE_TTL = 60_000;
let cache: { cfg: BunnyConfig; at: number } | null = null;

export function invalidateBunnyCache() {
  cache = null;
}

/** Map a bunny storage region code to its storage hostname. */
function regionToHost(region?: string | null): string {
  switch ((region || 'DE').toUpperCase()) {
    case 'NY': return 'ny.storage.bunnycdn.com';
    case 'LA': return 'la.storage.bunnycdn.com';
    case 'SG': return 'sg.storage.bunnycdn.com';
    case 'SYD': return 'syd.storage.bunnycdn.com';
    case 'UK': return 'uk.storage.bunnycdn.com';
    case 'SE': return 'se.storage.bunnycdn.com';
    case 'BR': return 'br.storage.bunnycdn.com';
    case 'JH': return 'jh.storage.bunnycdn.com';
    case 'DE':
    default: return DEFAULT_STORAGE_HOST;
  }
}

export async function getBunnyConfig(): Promise<BunnyConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.cfg;
  let cfg: BunnyConfig = {
    apiKey: null, storageZone: null, storagePassword: null,
    storageHost: null, pullZone: null, cdnUrl: null, region: null,
  };
  try {
    const rows = await prisma.systemConfig.findMany({ where: { key: { in: BUNNY_CONFIG_KEYS } } });
    const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
    cfg = {
      apiKey: m['BUNNY_API_KEY'] || process.env.BUNNY_API_KEY || null,
      storageZone: m['BUNNY_STORAGE_ZONE'] || null,
      storagePassword: m['BUNNY_STORAGE_PASSWORD'] || null,
      storageHost: m['BUNNY_STORAGE_HOST'] || null,
      pullZone: m['BUNNY_PULL_ZONE'] || null,
      cdnUrl: m['BUNNY_CDN_URL'] || null,
      region: m['BUNNY_STORAGE_REGION'] || null,
    };
  } catch (e) {
    console.warn('[bunny] Failed to load config from DB:', e);
  }
  cache = { cfg, at: Date.now() };
  return cfg;
}

/** True when the app can upload to / serve from BunnyCDN. */
export async function isBunnyStorageReady(): Promise<boolean> {
  const c = await getBunnyConfig();
  return !!(c.storageZone && c.storagePassword && c.storageHost && c.cdnUrl);
}

/** Build the public CDN url for a stored object key. */
export async function bunnyCdnUrl(objectKey: string): Promise<string | null> {
  const c = await getBunnyConfig();
  if (!c.cdnUrl) return null;
  const clean = objectKey.replace(/^\/+/, '');
  return `${c.cdnUrl.replace(/\/+$/, '')}/${clean}`;
}

/**
 * Upload a buffer to BunnyCDN storage. Returns the public CDN url.
 * Throws if storage is not configured or the upload fails.
 */
export async function uploadToBunny(objectKey: string, data: Buffer, contentType?: string): Promise<string> {
  const c = await getBunnyConfig();
  if (!c.storageZone || !c.storagePassword || !c.storageHost || !c.cdnUrl) {
    throw new Error('BunnyCDN storage is not configured');
  }
  const clean = objectKey.replace(/^\/+/, '');
  const putUrl = `https://${c.storageHost}/${c.storageZone}/${clean}`;
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      AccessKey: c.storagePassword,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: data,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Bunny upload failed (${res.status}): ${t.slice(0, 200)}`);
  }
  return `${c.cdnUrl.replace(/\/+$/, '')}/${clean}`;
}

/**
 * Best-effort mirror of a file to BunnyCDN using an app serving path as the key.
 * e.g. apiPath "/api/category-images/pool/p1/x.png" -> object key "category-images/pool/p1/x.png".
 * Silently no-ops when storage is not configured.
 */
export async function mirrorToBunnyFromApiPath(apiPath: string, data: Buffer, contentType?: string): Promise<void> {
  try {
    if (!(await isBunnyStorageReady())) return;
    const key = apiPath.replace(/^\/+/, '').replace(/^api\//, '').split('?')[0];
    if (!key) return;
    await uploadToBunny(key, data, contentType);
  } catch (e) {
    console.warn('[bunny] mirror failed for', apiPath, e);
  }
}

/** Fetch an object's bytes back from the CDN. Returns null on failure. */
export async function readFromBunny(objectKey: string): Promise<Buffer | null> {
  const url = await bunnyCdnUrl(objectKey);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Delete an object from BunnyCDN storage. Best-effort. */
export async function deleteFromBunny(objectKey: string): Promise<boolean> {
  const c = await getBunnyConfig();
  if (!c.storageZone || !c.storagePassword || !c.storageHost) return false;
  const clean = objectKey.replace(/^\/+/, '');
  const delUrl = `https://${c.storageHost}/${c.storageZone}/${clean}`;
  try {
    const res = await fetch(delUrl, { method: 'DELETE', headers: { AccessKey: c.storagePassword } });
    return res.ok;
  } catch {
    return false;
  }
}

export interface BunnyObject {
  objectName: string; // file/folder name
  path: string;       // full path key including trailing part
  isDirectory: boolean;
  length: number;     // size in bytes
}

/**
 * List objects under a storage path (non-recursive, one level).
 * `prefix` is the folder path e.g. "documents/" or "images/{projectId}/".
 * Returns [] when storage is not configured or on error.
 */
export async function listBunnyObjects(prefix: string): Promise<BunnyObject[]> {
  const c = await getBunnyConfig();
  if (!c.storageZone || !c.storagePassword || !c.storageHost) return [];
  let clean = prefix.replace(/^\/+/, '');
  if (clean && !clean.endsWith('/')) clean += '/';
  const url = `https://${c.storageHost}/${c.storageZone}/${clean}`;
  try {
    const res = await fetch(url, { headers: { AccessKey: c.storagePassword }, cache: 'no-store' });
    if (!res.ok) return [];
    const arr = await res.json().catch(() => []);
    if (!Array.isArray(arr)) return [];
    return arr.map((o: any) => ({
      objectName: String(o.ObjectName || ''),
      path: `${clean}${o.ObjectName || ''}`,
      isDirectory: !!o.IsDirectory,
      length: Number(o.Length || 0),
    }));
  } catch (e) {
    console.warn('[bunny] list failed for', prefix, e);
    return [];
  }
}

export interface ProvisionResult {
  storageZone: string;
  storagePassword: string;
  storageHost: string;
  pullZone: string;
  cdnUrl: string;
  region: string;
}

/**
 * Provision a BunnyCDN Storage Zone + linked Pull Zone using the Account API key.
 * Returns the credentials to persist. Throws with a descriptive message on failure.
 */
export async function provisionBunny(apiKey: string, region = 'DE'): Promise<ProvisionResult> {
  const key = apiKey.trim();
  if (!key) throw new Error('A BunnyCDN Account API key is required');

  // Globally-unique, lowercase, <= 20 chars: spb- + 8 hex
  const suffix = Math.random().toString(16).slice(2, 10);
  const zoneName = `spb-${suffix}`;

  // 1. Create the Storage Zone
  const szRes = await fetch('https://api.bunny.net/storagezone', {
    method: 'POST',
    headers: { AccessKey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Name: zoneName, Region: region.toUpperCase(), ZoneTier: 0 }),
  });
  if (!szRes.ok) {
    const t = await szRes.text().catch(() => '');
    if (szRes.status === 401) throw new Error('BunnyCDN rejected the API key (401). Use your Account API key from bunny.net → Account Settings → API.');
    throw new Error(`Storage Zone creation failed (${szRes.status}): ${t.slice(0, 250)}`);
  }
  const sz = await szRes.json();
  const storagePassword: string = sz.Password;
  const storageZoneId: number = sz.Id;
  const storageHost: string = sz.StorageHostname || regionToHost(region);
  if (!storagePassword || !storageZoneId) {
    throw new Error('BunnyCDN did not return storage credentials for the new zone.');
  }

  // 2. Create a Pull Zone linked to the Storage Zone (OriginType 2 = Storage Zone)
  const pzBody = (originType: number) => JSON.stringify({
    Name: zoneName,
    OriginType: originType,
    StorageZoneId: storageZoneId,
    Type: 0,
  });
  let pzRes = await fetch('https://api.bunny.net/pullzone', {
    method: 'POST',
    headers: { AccessKey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: pzBody(2),
  });
  if (!pzRes.ok) {
    // Some accounts expect OriginType 0 for storage-backed pull zones — retry once.
    pzRes = await fetch('https://api.bunny.net/pullzone', {
      method: 'POST',
      headers: { AccessKey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: pzBody(0),
    });
  }
  if (!pzRes.ok) {
    const t = await pzRes.text().catch(() => '');
    throw new Error(`Storage Zone created, but Pull Zone creation failed (${pzRes.status}): ${t.slice(0, 250)}`);
  }
  const pz = await pzRes.json();
  const pullZone: string = pz.Name || zoneName;
  const cdnUrl = `https://${pullZone}.b-cdn.net`;

  return { storageZone: zoneName, storagePassword, storageHost, pullZone, cdnUrl, region: region.toUpperCase() };
}
