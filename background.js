import {
  LAST_AUTO_KEY,
  LOG_KEY,
  SETTINGS_KEY,
  addToCrushedCount,
  cookieKey,
  deepClean,
  getAllCookies,
  getProtectedSites,
  getSettings,
  hostOf,
  isProtected,
  removeCookies,
  siteOf,
} from './lib.js';
import { isTracker } from './trackers.js';

// ---------- Cookie log ----------
// Chrome doesn't record when a cookie was created, so we watch cookie changes
// and keep our own timestamped log. That log powers the "Recent" view.

const MAX_ENTRIES = 3000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FLUSH_DELAY_MS = 400;

let log = null;
let flushTimer = null;

async function loadLog() {
  if (!log) {
    const stored = await chrome.storage.local.get(LOG_KEY);
    log = stored[LOG_KEY] ?? {};
  }
  return log;
}

function prune() {
  const cutoff = Date.now() - MAX_AGE_MS;
  let entries = Object.entries(log).filter(([, e]) => e.lastSet >= cutoff);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b[1].lastSet - a[1].lastSet);
    entries = entries.slice(0, MAX_ENTRIES);
  }
  log = Object.fromEntries(entries);
}

function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    prune();
    chrome.storage.local.set({ [LOG_KEY]: log });
  }, FLUSH_DELAY_MS);
}

chrome.cookies.onChanged.addListener(async ({ cookie, removed, cause }) => {
  scheduleBadgeRefresh();
  await loadLog();
  const key = cookieKey(cookie);

  if (removed) {
    // An overwrite is immediately followed by the new value being set.
    if (cause !== 'overwrite') {
      delete log[key];
      scheduleFlush();
    }
    return;
  }

  const now = Date.now();
  const { name, domain, path, storeId, secure, partitionKey } = cookie;
  log[key] = {
    name,
    domain,
    path,
    storeId,
    secure,
    partitionKey: partitionKey ?? null,
    firstSeen: log[key]?.firstSeen ?? now,
    lastSet: now,
  };
  scheduleFlush();
});

// ---------- Toolbar badge ----------

let badgeTimer = null;

chrome.action.setBadgeBackgroundColor({ color: '#ff6b4a' });
chrome.action.setBadgeTextColor?.({ color: '#ffffff' });

async function updateBadge(tab, settings) {
  const host = hostOf(tab.url ?? '');
  let text = '';
  if (host && settings.badge !== 'off') {
    let cookies = await chrome.cookies.getAll({ domain: siteOf(host) });
    if (settings.badge === 'trackers') cookies = cookies.filter(isTracker);
    if (cookies.length) text = cookies.length > 999 ? '999+' : String(cookies.length);
  }
  await chrome.action.setBadgeText({ tabId: tab.id, text }).catch(() => {});
}

async function refreshBadges() {
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({ active: true });
  await Promise.all(tabs.map((tab) => updateBadge(tab, settings)));
}

function scheduleBadgeRefresh() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(refreshBadges, 300);
}

chrome.tabs.onActivated.addListener(scheduleBadgeRefresh);

// ---------- Auto-crush ----------
// We remember when each site lost its last open tab. A sweep alarm then
// crushes cookies of every site that isn't open, isn't protected, and has
// been closed for longer than the chosen delay. Sites that were never open
// in a tab (third-party trackers) are crushed on the first sweep.

const SWEEP_ALARM = 'auto-crush-sweep';
const MIN_ALARM_MINUTES = 0.5;

// Tab events can arrive in bursts; run session bookkeeping one at a time.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn).catch((e) => console.error(e)));

async function openSites() {
  const tabs = await chrome.tabs.query({});
  return new Set(
    tabs
      .map((t) => hostOf(t.pendingUrl || t.url || ''))
      .filter(Boolean)
      .map(siteOf),
  );
}

async function ensureSweepScheduled(delayMinutes) {
  if (await chrome.alarms.get(SWEEP_ALARM)) return;
  await chrome.alarms.create(SWEEP_ALARM, { delayInMinutes: Math.max(MIN_ALARM_MINUTES, delayMinutes) });
}

async function trackOpenSites() {
  const open = await openSites();
  const { openSet = [], closedAt = {} } = await chrome.storage.session.get(['openSet', 'closedAt']);
  const now = Date.now();
  let somethingClosed = false;

  for (const site of openSet) {
    if (!open.has(site)) {
      closedAt[site] = now;
      somethingClosed = true;
    }
  }
  for (const site of open) delete closedAt[site];
  await chrome.storage.session.set({ openSet: [...open], closedAt });

  const settings = await getSettings();
  if (somethingClosed && settings.autoCrush) await ensureSweepScheduled(settings.autoDelay);
}

async function sweep() {
  const settings = await getSettings();
  if (!settings.autoCrush) return;

  const [protectedSites, open, cookies, session] = await Promise.all([
    getProtectedSites(),
    openSites(),
    getAllCookies(),
    chrome.storage.session.get('closedAt'),
  ]);
  const closedAt = session.closedAt ?? {};
  const graceMs = settings.autoDelay * 60_000;
  const now = Date.now();
  let nextDue = Infinity;

  const targets = cookies.filter((c) => {
    const site = siteOf(c.domain);
    if (open.has(site) || isProtected(c.domain, protectedSites)) return false;
    const closed = closedAt[site];
    // A couple of seconds of slack so an alarm firing on time isn't "early".
    if (closed && now - closed < graceMs - 2000) {
      nextDue = Math.min(nextDue, closed + graceMs);
      return false;
    }
    return true;
  });

  const removed = await removeCookies(targets);
  if (removed.length) {
    if (settings.deepCrush) await deepClean(removed);
    await addToCrushedCount(removed.length);
    await chrome.storage.local.set({
      [LAST_AUTO_KEY]: { at: now, count: removed.length, sites: new Set(removed.map((c) => siteOf(c.domain))).size },
    });
  }

  for (const [site, t] of Object.entries(closedAt)) {
    if (now - t >= graceMs) delete closedAt[site];
  }
  await chrome.storage.session.set({ closedAt });

  if (nextDue !== Infinity) {
    await chrome.alarms.create(SWEEP_ALARM, { when: Math.max(nextDue, now + MIN_ALARM_MINUTES * 60_000) });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SWEEP_ALARM) serial(sweep);
});

chrome.tabs.onRemoved.addListener(() => serial(trackOpenSites));
chrome.tabs.onReplaced.addListener(() => serial(trackOpenSites));
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url) serial(trackOpenSites);
  if (tab.active && (change.url || change.status === 'complete')) scheduleBadgeRefresh();
});

// Leftovers from the last browsing session get swept shortly after startup.
chrome.runtime.onStartup.addListener(() =>
  serial(async () => {
    await trackOpenSites();
    const settings = await getSettings();
    if (settings.autoCrush) await ensureSweepScheduled(settings.autoDelay);
  }),
);

chrome.runtime.onInstalled.addListener(() => {
  serial(trackOpenSites);
  scheduleBadgeRefresh();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
  const before = { ...changes[SETTINGS_KEY].oldValue };
  const after = { ...changes[SETTINGS_KEY].newValue };
  if (before.badge !== after.badge) scheduleBadgeRefresh();
  if (after.autoCrush && !before.autoCrush) {
    serial(async () => {
      await trackOpenSites();
      await ensureSweepScheduled(after.autoDelay ?? 1);
    });
  }
  if (!after.autoCrush && before.autoCrush) chrome.alarms.clear(SWEEP_ALARM);
});
