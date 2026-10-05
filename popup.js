import {
  LAST_AUTO_KEY,
  LOG_KEY,
  PROTECTED_KEY,
  SETTINGS_KEY,
  STATS_KEY,
  addToCrushedCount,
  cleanDomain,
  cookieKey,
  deepClean,
  getAllCookies,
  getSettings,
  hostOf,
  isProtected,
  removeCookies,
  restoreCookie,
  siteOf,
} from './lib.js';
import { classify, isTracker } from './trackers.js';

const RECENT_WINDOWS = [
  { label: '5m', ms: 5 * 60e3 },
  { label: '1h', ms: 60 * 60e3 },
  { label: '24h', ms: 24 * 60 * 60e3 },
  { label: '7d', ms: 7 * 24 * 60 * 60e3 },
];
const AUTO_DELAYS = [
  { label: '30s', min: 0.5 },
  { label: '1m', min: 1 },
  { label: '5m', min: 5 },
  { label: '15m', min: 15 },
];
const BADGE_MODES = [
  { label: 'Cookies', value: 'cookies' },
  { label: 'Trackers', value: 'trackers' },
  { label: 'Off', value: 'off' },
];
const POPS = ['Crunch!', 'Crumbs!', 'Om nom!', 'Smash!', 'Yoink!', 'Gone!', 'Nom!', 'Kaboom!'];
const CRUMB_COLORS = ['var(--dough)', 'var(--crust)', 'var(--chip)', 'var(--dough)'];
const MAX_ANIMATED_ROWS = 24;
const UNDO_MS = 6000;

const state = {
  view: 'site',
  cookies: [],
  protectedSites: [],
  settings: {},
  log: {},
  lastAuto: null,
  crushed: 0,
  host: null,
  recentWindow: RECENT_WINDOWS[1].ms,
  query: '',
  trackersOnly: false,
  openSites: new Set(),
};

const $view = document.getElementById('view');
const $fx = document.getElementById('fx');
const $tally = document.getElementById('tally');
const $toast = document.getElementById('toast');

// ---------- DOM helpers ----------

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'checked') el.checked = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return el;
}

function icon(id, cls = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', id === 'cookie' ? '0 0 64 64' : '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
const crushable = (cookies) => cookies.filter((c) => !isProtected(c.domain, state.protectedSites));

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function expiry(c) {
  if (c.session || !c.expirationDate) return 'session';
  const s = c.expirationDate - Date.now() / 1000;
  if (s < 3600) return 'expires soon';
  if (s < 86400) return `expires in ${Math.round(s / 3600)}h`;
  if (s < 86400 * 365) return `expires in ${Math.round(s / 86400)}d`;
  return `expires in ${Math.round(s / (86400 * 365))}y`;
}

function delayLabel(min) {
  return min < 1 ? `${min * 60} seconds` : plural(min, 'minute');
}

// ---------- Effects ----------

function burst(rect, count) {
  for (let i = 0; i < count; i++) {
    const size = 3 + Math.random() * 6;
    const crumb = h('div', { class: 'crumb' });
    Object.assign(crumb.style, {
      width: `${size}px`,
      height: `${size * (0.7 + Math.random() * 0.5)}px`,
      left: `${rect.left + Math.random() * rect.width}px`,
      top: `${rect.top + Math.random() * rect.height}px`,
      background: pick(CRUMB_COLORS),
    });
    $fx.append(crumb);

    const vx = (Math.random() - 0.5) * 160;
    const vy = -40 - Math.random() * 120;
    const spin = (Math.random() - 0.5) * 720;
    const frames = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => ({
      transform: `translate(${vx * t}px, ${vy * t + 420 * t * t}px) rotate(${spin * t}deg)`,
      opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
    }));
    crumb.animate(frames, { duration: 650 + Math.random() * 350, easing: 'linear' }).onfinish = () =>
      crumb.remove();
  }
}

function pop(rect, text) {
  const el = h('div', { class: 'pop' }, text);
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + rect.height / 2}px`;
  $fx.append(el);
  setTimeout(() => el.remove(), 850);
}

async function crumble(el, delay = 0) {
  await sleep(delay);
  burst(el.getBoundingClientRect(), 10);
  el.classList.add('crumbling');
  await sleep(280);
  await el.animate(
    [{ height: `${el.offsetHeight}px` }, { height: '0px', paddingTop: '0px', paddingBottom: '0px' }],
    { duration: 160, easing: 'ease-in', fill: 'forwards' },
  ).finished;
}

async function changeTally(n) {
  state.crushed = await addToCrushedCount(n);
  renderTally();
  if (n > 0) {
    $tally.classList.remove('bump');
    void $tally.offsetWidth;
    $tally.classList.add('bump');
  }
}

function renderTally() {
  $tally.textContent = `${state.crushed.toLocaleString()} crushed`;
}

// ---------- Toast + undo ----------

let toastTimer;

function showToast(text, action) {
  clearTimeout(toastTimer);
  $toast.replaceChildren(
    ...[
      h('span', { class: 'toast-text' }, text),
      action && h('button', { class: 'toast-btn', onclick: action.run }, action.label),
      action && h('div', { class: 'toast-bar', style: `animation-duration:${UNDO_MS}ms` }),
    ].filter(Boolean),
  );
  $toast.classList.remove('show');
  void $toast.offsetWidth;
  $toast.classList.add('show');
  toastTimer = setTimeout(hideToast, action ? UNDO_MS : 2500);
}

function hideToast() {
  clearTimeout(toastTimer);
  $toast.classList.remove('show');
}

async function undo(removed, logEntries, storageCleared) {
  hideToast();
  const results = await Promise.all(removed.map(restoreCookie));
  const restored = removed.filter((_, i) => results[i]);
  Object.assign(state.log, logEntries);
  state.cookies = await getAllCookies();
  await changeTally(-restored.length);
  render();

  const failed = removed.length - restored.length;
  let msg = `Restored ${plural(restored.length, 'cookie')}`;
  if (failed) msg += ` (${failed} couldn't be restored)`;
  if (storageCleared) msg += '. Site storage stays cleared.';
  showToast(msg);
}

// ---------- Crushing ----------

// Removes cookies (protected ones are skipped), animates the given elements
// away, offers undo, then re-renders. `deep` clears site storage too when the
// Deep crush setting is on.
async function crush(cookies, { rows = [], origin = null, deep = false, extraHosts = [] } = {}) {
  const targets = crushable(cookies);
  if (!targets.length) return;

  const removed = await removeCookies(targets);
  if (!removed.length) {
    showToast("Couldn't crush those. Chrome said no.");
    return;
  }
  const storageCleared = deep && state.settings.deepCrush && (await deepClean(removed, extraHosts));

  const gone = new Set(removed.map(cookieKey));
  const logEntries = {};
  for (const key of gone) {
    if (state.log[key]) logEntries[key] = state.log[key];
    delete state.log[key];
  }
  state.cookies = state.cookies.filter((c) => !gone.has(cookieKey(c)));

  if (origin) {
    origin.classList.remove('shake');
    void origin.offsetWidth;
    origin.classList.add('shake');
    burst(origin.getBoundingClientRect(), 26);
  }
  const popAt = (origin ?? rows[0])?.getBoundingClientRect();
  if (popAt) pop(popAt, removed.length > 1 ? `${pick(POPS)} ×${removed.length}` : pick(POPS));
  changeTally(removed.length);

  let msg = `Crushed ${plural(removed.length, 'cookie')}`;
  if (storageCleared) msg += ' + site storage';
  showToast(msg, { label: 'Undo', run: () => undo(removed, logEntries, storageCleared) });

  await Promise.all(rows.slice(0, MAX_ANIMATED_ROWS).map((el, i) => crumble(el, i * 35)));
  render();
}

function rowsFor(cookies) {
  const keys = new Set(cookies.map(cookieKey));
  return [...$view.querySelectorAll('.cookie[data-key]')].filter((el) => keys.has(el.dataset.key));
}

// A two-click button for destructive bulk actions; no browser dialogs.
function armedButton(label, armedLabel, onConfirm) {
  let timer;
  const btn = h('button', { class: 'crush-btn wide' }, icon('cookie'), label);
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed');
      btn.lastChild.textContent = armedLabel;
      timer = setTimeout(() => {
        btn.classList.remove('armed');
        btn.lastChild.textContent = label;
      }, 3000);
      return;
    }
    clearTimeout(timer);
    btn.classList.remove('armed');
    btn.lastChild.textContent = label;
    onConfirm(btn);
  });
  return btn;
}

// ---------- Settings + protection ----------

async function setProtected(site, on) {
  const list = new Set(state.protectedSites);
  on ? list.add(site) : list.delete(site);
  state.protectedSites = [...list].sort();
  await chrome.storage.sync.set({ [PROTECTED_KEY]: state.protectedSites });
  render();
}

async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: state.settings });
  render();
}

// ---------- Shared pieces ----------

function trackerTag(c) {
  const info = classify(c);
  return info && h('span', { class: `tag cat-${info.category}`, title: info.label }, info.who);
}

function cookieRow(c, meta) {
  const locked = isProtected(c.domain, state.protectedSites);
  return h(
    'div',
    { class: 'cookie', 'data-key': cookieKey(c) },
    h(
      'div',
      { class: 'cookie-main' },
      h('div', { class: 'cookie-name', title: c.name }, c.name || '(unnamed)', trackerTag(c)),
      h(
        'div',
        { class: 'cookie-meta', title: `${c.domain}${c.path}` },
        meta ?? `${c.domain}${c.path === '/' ? '' : c.path} · ${expiry(c)}`,
        c.partitionKey && h('span', { class: 'tag' }, 'partitioned'),
      ),
    ),
    locked
      ? h('span', { title: 'Protected' }, icon('shield-on', 'lock'))
      : h(
          'button',
          {
            class: 'x-btn',
            title: 'Crush this cookie',
            'aria-label': `Crush ${c.name}`,
            onclick: (e) => crush([c], { rows: [e.currentTarget.closest('.cookie')] }),
          },
          icon('x'),
        ),
  );
}

function empty(title, text) {
  return h('div', { class: 'empty' }, icon('cookie'), h('b', {}, title), text);
}

function groupBySite(cookies) {
  const groups = new Map();
  for (const c of cookies) {
    const site = siteOf(c.domain);
    if (!groups.has(site)) groups.set(site, []);
    groups.get(site).push(c);
  }
  return groups;
}

function trackerNote(n) {
  return n ? h('span', { class: 'tracker-note' }, ` · ${plural(n, 'tracker')}`) : null;
}

// ---------- Views ----------

function renderSite() {
  if (!state.host) {
    return [empty('Nothing to crush here', 'Open a regular website to see its cookies.')];
  }

  const site = siteOf(state.host);
  const cookies = state.cookies
    .filter((c) => siteOf(c.domain) === site)
    .sort((a, b) => Number(isTracker(b)) - Number(isTracker(a)) || a.name.localeCompare(b.name));
  const targets = crushable(cookies);
  const trackers = targets.filter(isTracker);
  const siteProtected = state.protectedSites.includes(site);

  const crushBtn = h('button', { class: 'crush-btn', disabled: !targets.length }, icon('cookie'), "Crush 'em");
  crushBtn.addEventListener('click', () =>
    crush(targets, { rows: rowsFor(targets), origin: crushBtn, deep: true, extraHosts: [state.host] }),
  );

  const trackerBtn =
    trackers.length > 0 &&
    h(
      'button',
      {
        class: 'ghost-btn danger',
        title: 'Crush only advertising and analytics cookies. Logins and your consent choice stay.',
        onclick: (e) => crush(trackers, { rows: rowsFor(trackers), origin: e.currentTarget }),
      },
      icon('target'),
      `Crush ${plural(trackers.length, 'tracker')}`,
    );

  return [
    h(
      'div',
      { class: 'hero' },
      h(
        'div',
        { class: 'hero-text' },
        h('div', { class: 'hero-site', title: state.host }, site),
        h(
          'div',
          { class: 'hero-count' },
          h('b', {}, String(cookies.length)),
          cookies.length === 1 ? ' cookie' : ' cookies',
          trackerNote(cookies.filter(isTracker).length),
        ),
      ),
      crushBtn,
    ),
    h(
      'div',
      { class: 'row-between' },
      h('span', { class: 'label' }, 'Cookies'),
      h(
        'div',
        { class: 'btn-row' },
        trackerBtn,
        h(
          'button',
          {
            class: `ghost-btn${siteProtected ? ' on' : ''}`,
            title: siteProtected ? 'Stop protecting this site' : 'Never bulk-crush or auto-crush this site',
            onclick: () => setProtected(site, !siteProtected),
          },
          icon(siteProtected ? 'shield-on' : 'shield'),
          siteProtected ? 'Protected' : 'Protect',
        ),
      ),
    ),
    cookies.length
      ? h('div', { class: 'list' }, cookies.map((c) => cookieRow(c)))
      : empty('Spotless!', 'This site has no cookies. Yet.'),
    state.settings.autoCrush &&
      !siteProtected &&
      cookies.length > 0 &&
      h('p', { class: 'hint center' }, `Auto-crush is on: these go ${delayLabel(state.settings.autoDelay)} after you leave.`),
  ];
}

function renderRecent() {
  const since = Date.now() - state.recentWindow;
  const live = new Map(state.cookies.map((c) => [cookieKey(c), c]));
  const items = Object.entries(state.log)
    .filter(([key, e]) => e.firstSeen >= since && live.has(key))
    .map(([key, e]) => ({ cookie: live.get(key), firstSeen: e.firstSeen }))
    .sort((a, b) => b.firstSeen - a.firstSeen);

  const groups = new Map();
  for (const item of items) {
    const site = siteOf(item.cookie.domain);
    if (!groups.has(site)) groups.set(site, []);
    groups.get(site).push(item);
  }

  const chips = h(
    'div',
    { class: 'chips' },
    RECENT_WINDOWS.map((w) =>
      h(
        'button',
        {
          class: 'chip',
          'aria-pressed': String(w.ms === state.recentWindow),
          onclick: () => {
            state.recentWindow = w.ms;
            render();
          },
        },
        w.label,
      ),
    ),
  );

  const out = [h('div', { class: 'row-between', style: 'margin-top:2px' }, h('span', { class: 'label' }, 'New in last'), chips)];

  if (!items.length) {
    out.push(
      empty('No new cookies', 'Cookies that show up while you browse land here. Go accept some banners.'),
      h('p', { class: 'hint' }, 'Chrome doesn’t record when a cookie was created, so only cookies set after installing Cookie Crusher show up here.'),
    );
    return out;
  }

  const cookies = items.map((i) => i.cookie);
  const trackers = crushable(cookies).filter(isTracker);
  out.push(
    h(
      'div',
      { class: 'summary' },
      h('b', {}, plural(items.length, 'new cookie')),
      ' from ',
      h('b', {}, plural(groups.size, 'site')),
      trackerNote(cookies.filter(isTracker).length),
    ),
    h(
      'div',
      { class: 'list' },
      [...groups].map(([site, group]) => [
        h('div', { class: 'group-label' }, site),
        group.map(({ cookie, firstSeen }) => cookieRow(cookie, `${cookie.domain} · ${timeAgo(firstSeen)}`)),
      ]),
    ),
  );

  const btn = h('button', { class: 'crush-btn wide' }, icon('cookie'), `Crush all ${plural(items.length, 'new cookie')}`);
  btn.addEventListener('click', () => crush(cookies, { rows: rowsFor(cookies), origin: btn, deep: true }));
  out.push(btn);

  if (trackers.length) {
    out.push(
      h(
        'div',
        { class: 'center' },
        h(
          'button',
          {
            class: 'ghost-btn danger',
            style: 'margin-top:8px',
            onclick: (e) => crush(trackers, { rows: rowsFor(trackers), origin: e.currentTarget }),
          },
          icon('target'),
          `Only crush the ${plural(trackers.length, 'tracker')}`,
        ),
      ),
    );
  }
  return out;
}

function siteGroup(site, cookies) {
  const open = state.openSites.has(site) || state.query !== '';
  const siteProtected = state.protectedSites.includes(site);
  const targets = crushable(cookies);
  const trackerCount = cookies.filter(isTracker).length;
  const el = h('div', {
    class: `site${open ? ' open' : ''}`,
    'data-clear': String(targets.length === cookies.length),
  });

  const crushBtn =
    targets.length > 0 &&
    h(
      'button',
      {
        class: 'crush-btn small',
        title: `Crush ${plural(targets.length, 'cookie')}`,
        onclick: (e) => {
          e.stopPropagation();
          const wholeSite = targets.length === cookies.length;
          crush(targets, { rows: wholeSite ? [el] : rowsFor(targets), origin: e.currentTarget, deep: true });
        },
      },
      'Crush',
    );

  const head = h(
    'div',
    {
      class: 'site-head',
      onclick: () => {
        state.openSites.has(site) ? state.openSites.delete(site) : state.openSites.add(site);
        el.classList.toggle('open');
        if (!body.childElementCount) body.append(...cookies.map((c) => cookieRow(c)));
      },
    },
    icon('chev', 'chev'),
    h('span', { class: 'site-name', title: site }, site),
    trackerCount > 0 && h('span', { class: 'count trackers', title: plural(trackerCount, 'tracker') }, String(trackerCount)),
    h('span', { class: 'count', title: plural(cookies.length, 'cookie') }, String(cookies.length)),
    h(
      'button',
      {
        class: `icon-btn${siteProtected ? ' on' : ''}`,
        title: siteProtected ? 'Protected. Click to unprotect.' : 'Protect this site',
        onclick: (e) => {
          e.stopPropagation();
          setProtected(site, !siteProtected);
        },
      },
      icon(siteProtected ? 'shield-on' : 'shield'),
    ),
    crushBtn,
  );

  // Rows are only built once a group is opened; there can be thousands.
  const body = h('div', { class: 'site-body' }, open ? cookies.map((c) => cookieRow(c)) : []);
  el.append(head, body);
  return el;
}

function renderAllList(container) {
  const q = state.query.trim().toLowerCase();
  let matching = q
    ? state.cookies.filter(
        (c) =>
          c.domain.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          classify(c)?.who.toLowerCase().includes(q),
      )
    : state.cookies;
  if (state.trackersOnly) matching = matching.filter(isTracker);

  const groups = [...groupBySite(matching)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [, list] of groups) list.sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));

  const filtered = q || state.trackersOnly;
  container.replaceChildren(
    h(
      'div',
      { class: 'row-between' },
      h(
        'span',
        { class: 'summary' },
        h('b', {}, plural(matching.length, state.trackersOnly ? 'tracker' : 'cookie')),
        ' across ',
        h('b', {}, plural(groups.length, 'site')),
      ),
      h(
        'button',
        {
          class: 'chip',
          'aria-pressed': String(state.trackersOnly),
          onclick: () => {
            state.trackersOnly = !state.trackersOnly;
            renderAllList(container);
          },
        },
        'Trackers only',
      ),
    ),
    groups.length
      ? h('div', { class: 'list' }, groups.map(([site, list]) => siteGroup(site, list)))
      : empty(filtered ? 'No matches' : 'Cookie jar is empty', filtered ? 'Nothing fits that filter.' : 'Not a single crumb left.'),
  );
}

function renderAll() {
  const results = h('div');
  const search = h('input', {
    class: 'search',
    type: 'search',
    placeholder: 'Search sites, cookies or companies…',
    value: state.query,
    oninput: (e) => {
      state.query = e.target.value;
      renderAllList(results);
    },
  });
  renderAllList(results);

  const out = [search, results];
  if (crushable(state.cookies).length) {
    out.push(
      armedButton('Crush everything', 'Really? Click again!', (btn) => {
        const rows = [...$view.querySelectorAll('.site[data-clear="true"]')];
        crush(state.cookies, { rows, origin: btn, deep: true });
      }),
      h(
        'p',
        { class: 'hint' },
        state.protectedSites.length
          ? 'Protected sites are skipped. Expect to be logged out of everything else.'
          : 'This logs you out of every site. Protect the ones you care about first.',
      ),
    );
  }
  return out;
}

function toggle(checked, onChange, label) {
  return h(
    'label',
    { class: 'switch', title: label },
    h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }),
    h('span', { class: 'slider' }),
  );
}

function segmented(options, value, onPick) {
  return h(
    'div',
    { class: 'chips' },
    options.map((o) =>
      h('button', { class: 'chip', 'aria-pressed': String(o.value === value), onclick: () => onPick(o.value) }, o.label),
    ),
  );
}

function setting(title, desc, control, extra) {
  return h(
    'div',
    { class: 'setting' },
    h('div', { class: 'setting-row' }, h('div', { class: 'setting-text' }, h('b', {}, title), h('span', {}, desc)), control),
    extra,
  );
}

function renderSettings() {
  const s = state.settings;
  const counts = new Map();
  for (const c of state.cookies) {
    for (const p of state.protectedSites) {
      if (isProtected(c.domain, [p])) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
  }

  const input = h('input', { class: 'search', type: 'text', placeholder: 'example.com', spellcheck: 'false' });
  const add = () => {
    const raw = input.value.trim().toLowerCase();
    const domain = cleanDomain(raw.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0]);
    if (domain) setProtected(domain, true);
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && add());

  const currentSite = state.host && siteOf(state.host);
  const lastAuto = state.lastAuto;

  return [
    h(
      'div',
      { class: 'list settings' },
      setting(
        'Auto-crush',
        'When a site has no open tabs left, crush its cookies, along with trackers from sites you never opened.',
        toggle(s.autoCrush, (v) => saveSettings({ autoCrush: v }), 'Auto-crush'),
        s.autoCrush && [
          h(
            'div',
            { class: 'setting-sub' },
            h('span', {}, 'Wait after leaving'),
            segmented(
              AUTO_DELAYS.map((d) => ({ label: d.label, value: d.min })),
              s.autoDelay,
              (v) => saveSettings({ autoDelay: v }),
            ),
          ),
          h(
            'p',
            { class: 'setting-note' },
            lastAuto
              ? `Last sweep: ${plural(lastAuto.count, 'cookie')} from ${plural(lastAuto.sites, 'site')}, ${timeAgo(lastAuto.at)}.`
              : 'Heads up: the first sweep crushes cookies of every site that isn’t open or protected. Protect your logins first.',
          ),
        ],
      ),
      setting(
        'Deep crush',
        'Also clear localStorage, IndexedDB, caches and service workers when crushing a whole site. Storage can’t be undone.',
        toggle(s.deepCrush, (v) => saveSettings({ deepCrush: v }), 'Deep crush'),
      ),
      setting(
        'Toolbar badge',
        'The number on the toolbar icon for the current site.',
        null,
        h('div', { class: 'setting-sub' }, h('span', {}, 'Show'), segmented(BADGE_MODES, s.badge, (v) => saveSettings({ badge: v }))),
      ),
    ),

    h('div', { class: 'row-between' }, h('span', { class: 'label' }, `Protected sites (${state.protectedSites.length})`)),
    h('p', { class: 'hint', style: 'margin-top:0' }, 'Never bulk-crushed or auto-crushed, subdomains included. Keep your logins here.'),
    h('div', { class: 'add-row' }, input, h('button', { class: 'add-btn', onclick: add }, 'Protect')),
    currentSite &&
      !state.protectedSites.includes(currentSite) &&
      h(
        'div',
        { class: 'center', style: 'margin-top:10px' },
        h('button', { class: 'ghost-btn', onclick: () => setProtected(currentSite, true) }, icon('shield'), `Protect ${currentSite}`),
      ),
    h('div', { style: 'height:10px' }),
    state.protectedSites.length
      ? h(
          'div',
          { class: 'list' },
          state.protectedSites.map((p) =>
            h(
              'div',
              { class: 'cookie' },
              icon('shield-on', 'lock'),
              h(
                'div',
                { class: 'cookie-main' },
                h('div', { class: 'site-name' }, p),
                h('div', { class: 'cookie-meta' }, plural(counts.get(p) ?? 0, 'cookie')),
              ),
              h(
                'button',
                { class: 'x-btn', title: 'Unprotect', 'aria-label': `Unprotect ${p}`, onclick: () => setProtected(p, false) },
                icon('x'),
              ),
            ),
          ),
        )
      : empty('Nothing protected', 'Every cookie is fair game.'),
  ];
}

const VIEWS = { site: renderSite, recent: renderRecent, all: renderAll, settings: renderSettings };

function render() {
  const scroll = $view.scrollTop;
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.view === state.view));
  }
  $view.replaceChildren(...VIEWS[state.view]().flat(Infinity).filter(Boolean));
  $view.scrollTop = scroll;
}

// ---------- Boot ----------

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    if (state.view === tab.dataset.view) return;
    state.view = tab.dataset.view;
    $view.scrollTop = 0;
    render();
  });
}

async function init() {
  const [cookies, settings, sync, local, [tab]] = await Promise.all([
    getAllCookies(),
    getSettings(),
    chrome.storage.sync.get(PROTECTED_KEY),
    chrome.storage.local.get([LOG_KEY, STATS_KEY, LAST_AUTO_KEY]),
    chrome.tabs.query({ active: true, currentWindow: true }),
  ]);

  state.cookies = cookies;
  state.settings = settings;
  state.protectedSites = sync[PROTECTED_KEY] ?? [];
  state.log = local[LOG_KEY] ?? {};
  state.crushed = local[STATS_KEY] ?? 0;
  state.lastAuto = local[LAST_AUTO_KEY] ?? null;
  state.host = hostOf(tab?.url ?? '');

  renderTally();
  render();
}

init();
