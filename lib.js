// Shared helpers for the background worker and the popup.

export const LOG_KEY = 'cookieLog';
export const PROTECTED_KEY = 'protectedSites';
export const STATS_KEY = 'crushedCount';
export const SETTINGS_KEY = 'settings';
export const LAST_AUTO_KEY = 'lastAutoCrush';

export const DEFAULT_SETTINGS = {
  autoCrush: false,
  autoDelay: 1, // minutes
  deepCrush: false,
  badge: 'cookies', // 'cookies' | 'trackers' | 'off'
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored[SETTINGS_KEY] };
}

export async function getProtectedSites() {
  return (await chrome.storage.sync.get(PROTECTED_KEY))[PROTECTED_KEY] ?? [];
}

export async function addToCrushedCount(n) {
  const current = (await chrome.storage.local.get(STATS_KEY))[STATS_KEY] ?? 0;
  const next = Math.max(0, current + n);
  await chrome.storage.local.set({ [STATS_KEY]: next });
  return next;
}

// Second-level labels that act like a TLD, e.g. "co.uk", "com.au".
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go']);

export function cleanDomain(domain) {
  return domain.replace(/^\./, '').replace(/^www\./, '').toLowerCase();
}

// Rough "registrable domain": good enough for grouping without shipping the
// full public suffix list.
export function siteOf(domain) {
  const host = cleanDomain(domain);
  if (/^[\d.]+$/.test(host) || host.includes(':')) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const take = tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
  return parts.slice(-take).join('.');
}

// Hostname of an http(s) URL, or null for chrome://, file://, new tab, etc.
export function hostOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
}

export function cookieKey(c) {
  const partition = c.partitionKey?.topLevelSite ?? '';
  return [c.storeId, c.domain, c.path, c.name, partition].join('|');
}

export function cookieUrl(c) {
  return `http${c.secure ? 's' : ''}://${c.domain.replace(/^\./, '')}${c.path}`;
}

export function isProtected(domain, protectedSites) {
  const host = cleanDomain(domain);
  return protectedSites.some((p) => host === p || host.endsWith('.' + p));
}

export async function removeCookie(c) {
  const details = { url: cookieUrl(c), name: c.name, storeId: c.storeId };
  if (c.partitionKey) details.partitionKey = c.partitionKey;
  try {
    return (await chrome.cookies.remove(details)) !== null;
  } catch {
    return false;
  }
}

// Removes cookies and returns the ones that were actually removed.
export async function removeCookies(cookies) {
  const results = await Promise.all(cookies.map(removeCookie));
  return cookies.filter((_, i) => results[i]);
}

// Puts a removed cookie back exactly as it was (used by undo).
export async function restoreCookie(c) {
  const details = {
    url: cookieUrl(c),
    name: c.name,
    value: c.value,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    storeId: c.storeId,
  };
  if (!c.hostOnly) details.domain = c.domain;
  if (c.sameSite && c.sameSite !== 'unspecified') details.sameSite = c.sameSite;
  if (!c.session && c.expirationDate) details.expirationDate = c.expirationDate;
  if (c.partitionKey) details.partitionKey = c.partitionKey;
  try {
    return (await chrome.cookies.set(details)) !== null;
  } catch {
    return false;
  }
}

// Clears localStorage, IndexedDB, cache storage, service workers and file
// systems for every origin the given cookies belonged to.
export async function deepClean(cookies, extraHosts = []) {
  const hosts = new Set(extraHosts);
  for (const c of cookies) {
    const host = c.domain.replace(/^\./, '');
    hosts.add(host);
    if (!c.hostOnly && !host.startsWith('www.')) hosts.add(`www.${host}`);
  }
  const origins = [...hosts].flatMap((h) => [`https://${h}`, `http://${h}`]);
  if (!origins.length) return false;
  try {
    await chrome.browsingData.remove(
      { origins },
      { cacheStorage: true, fileSystems: true, indexedDB: true, localStorage: true, serviceWorkers: true },
    );
    return true;
  } catch {
    return false;
  }
}

// Every cookie, including partitioned (CHIPS) ones where Chrome supports it.
export async function getAllCookies() {
  try {
    const all = await chrome.cookies.getAll({ partitionKey: {} });
    const seen = new Map(all.map((c) => [cookieKey(c), c]));
    for (const c of await chrome.cookies.getAll({})) seen.set(cookieKey(c), c);
    return [...seen.values()];
  } catch {
    return chrome.cookies.getAll({});
  }
}
