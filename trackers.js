// A small, hand-picked list of well-known tracking (and consent) cookies.
// Not exhaustive: it's meant to label the usual suspects, not to be a blocklist.

export const CATEGORIES = {
  ads: { label: 'Advertising', tracker: true },
  analytics: { label: 'Analytics', tracker: true },
  social: { label: 'Social', tracker: false },
  consent: { label: 'Your consent choice', tracker: false },
  security: { label: 'Bot protection', tracker: false },
};

// [cookie-name pattern, who, category]
const NAME_RULES = [
  [/^_ga(_[A-Z0-9]+)?$/, 'Google Analytics', 'analytics'],
  [/^_gid$/, 'Google Analytics', 'analytics'],
  [/^_gat/, 'Google Analytics', 'analytics'],
  [/^__utm[a-z]$/, 'Google Analytics', 'analytics'],
  [/^_dc_gtm_/, 'Google Tag Manager', 'analytics'],
  [/^_gcl_/, 'Google Ads', 'ads'],
  [/^(__gads|__gpi|__eoi)$/, 'Google Ad Manager', 'ads'],
  [/^(IDE|test_cookie|DSID|ANID)$/, 'Google Ads', 'ads'],
  [/^_fb[pc]$/, 'Meta Pixel', 'ads'],
  [/^_uet(sid|vid)$/, 'Microsoft Ads', 'ads'],
  [/^MUID$/, 'Microsoft Ads', 'ads'],
  [/^(_clck|_clsk|CLID)$/, 'Microsoft Clarity', 'analytics'],
  [/^_hj/, 'Hotjar', 'analytics'],
  [/^ajs_(anonymous_id|user_id)$/, 'Segment', 'analytics'],
  [/^mp_.*_mixpanel$/, 'Mixpanel', 'analytics'],
  [/^(AMP_|amplitude_id)/, 'Amplitude', 'analytics'],
  [/^(_pin_unauth|_pinterest_ct_ua|_epik)$/, 'Pinterest', 'ads'],
  [/^(_ttp|_tt_enable_cookie)$/, 'TikTok Pixel', 'ads'],
  [/^_scid/, 'Snap Pixel', 'ads'],
  [/^_rdt_uuid$/, 'Reddit Pixel', 'ads'],
  [/^(li_fat_id|li_sugr|_li_dcdm_c)$/, 'LinkedIn Insight', 'ads'],
  [/^__qca$/, 'Quantcast', 'ads'],
  [/^(cto_bundle|cto_bidid)$/, 'Criteo', 'ads'],
  [/^(t_gid|taboola_.*)$/, 'Taboola', 'ads'],
  [/^(_cb|_cb_svref|_chartbeat\d*)$/, 'Chartbeat', 'analytics'],
  [/^(s_cc|s_sq|s_vi|s_fid|s_ecid|s_ppv)$|^AMCVS?_/, 'Adobe Analytics', 'analytics'],
  [/^optimizely/, 'Optimizely', 'analytics'],
  [/^(hubspotutk|__hstc|__hssc|__hssrc)$/, 'HubSpot', 'analytics'],
  [/^_parsely_/, 'Parse.ly', 'analytics'],
  [/^_pk_(id|ses|ref)/, 'Matomo', 'analytics'],
  [/^_ym_/, 'Yandex Metrica', 'analytics'],
  [/^(OptanonConsent|OptanonAlertBoxClosed)$/, 'OneTrust', 'consent'],
  [/^(euconsent|euconsent-v2|addtl_consent)$/, 'IAB consent', 'consent'],
  [/^(CookieConsent|CookieConsentBulkSetting.*)$/, 'Cookiebot', 'consent'],
  [/^didomi_token$/, 'Didomi', 'consent'],
  [/^cookieyes-consent$/, 'CookieYes', 'consent'],
  [/^cmplz_/, 'Complianz', 'consent'],
  [/^(consentUUID|_sp_su|_sp_v1_.*)$/, 'Sourcepoint', 'consent'],
  [/^(usprivacy|gpp|__gpp)$/, 'Privacy signal', 'consent'],
  [/^(__cf_bm|cf_clearance|_cfuvid)$/, 'Cloudflare', 'security'],
  [/^datadome$/, 'DataDome', 'security'],
];

// [cookie domain (or parent domain), who, category]
const DOMAIN_RULES = [
  ['doubleclick.net', 'Google Ads', 'ads'],
  ['googleadservices.com', 'Google Ads', 'ads'],
  ['googlesyndication.com', 'Google Ads', 'ads'],
  ['google-analytics.com', 'Google Analytics', 'analytics'],
  ['adnxs.com', 'Xandr', 'ads'],
  ['criteo.com', 'Criteo', 'ads'],
  ['criteo.net', 'Criteo', 'ads'],
  ['taboola.com', 'Taboola', 'ads'],
  ['outbrain.com', 'Outbrain', 'ads'],
  ['zemanta.com', 'Outbrain', 'ads'],
  ['scorecardresearch.com', 'Comscore', 'analytics'],
  ['quantserve.com', 'Quantcast', 'ads'],
  ['quantcount.com', 'Quantcast', 'ads'],
  ['hotjar.com', 'Hotjar', 'analytics'],
  ['clarity.ms', 'Microsoft Clarity', 'analytics'],
  ['amazon-adsystem.com', 'Amazon Ads', 'ads'],
  ['rubiconproject.com', 'Magnite', 'ads'],
  ['spotxchange.com', 'Magnite', 'ads'],
  ['pubmatic.com', 'PubMatic', 'ads'],
  ['openx.net', 'OpenX', 'ads'],
  ['casalemedia.com', 'Index Exchange', 'ads'],
  ['demdex.net', 'Adobe Audience Manager', 'ads'],
  ['everesttech.net', 'Adobe Advertising', 'ads'],
  ['omtrdc.net', 'Adobe Analytics', 'analytics'],
  ['bluekai.com', 'Oracle BlueKai', 'ads'],
  ['rlcdn.com', 'LiveRamp', 'ads'],
  ['adsrvr.org', 'The Trade Desk', 'ads'],
  ['smartadserver.com', 'Equativ', 'ads'],
  ['teads.tv', 'Teads', 'ads'],
  ['mathtag.com', 'MediaMath', 'ads'],
  ['3lift.com', 'TripleLift', 'ads'],
  ['sharethrough.com', 'Sharethrough', 'ads'],
  ['bidswitch.net', 'BidSwitch', 'ads'],
  ['agkn.com', 'Neustar', 'ads'],
  ['krxd.net', 'Salesforce DMP', 'ads'],
  ['id5-sync.com', 'ID5', 'ads'],
  ['crwdcntrl.net', 'Lotame', 'ads'],
  ['adform.net', 'Adform', 'ads'],
  ['tapad.com', 'Tapad', 'ads'],
  ['media.net', 'Media.net', 'ads'],
  ['contextweb.com', 'PulsePoint', 'ads'],
  ['yieldmo.com', 'Yieldmo', 'ads'],
  ['adroll.com', 'AdRoll', 'ads'],
  ['dotomi.com', 'Conversant', 'ads'],
  ['gumgum.com', 'GumGum', 'ads'],
  ['lijit.com', 'Sovrn', 'ads'],
  ['33across.com', '33Across', 'ads'],
  ['eyeota.net', 'Eyeota', 'ads'],
  ['exelator.com', 'Nielsen', 'ads'],
  ['imrworldwide.com', 'Nielsen', 'analytics'],
  ['serving-sys.com', 'Amazon Ads', 'ads'],
  ['ads-twitter.com', 'X Ads', 'ads'],
  ['analytics.twitter.com', 'X Ads', 'ads'],
  ['ads.linkedin.com', 'LinkedIn Ads', 'ads'],
  ['px.ads.linkedin.com', 'LinkedIn Ads', 'ads'],
  ['mc.yandex.ru', 'Yandex Metrica', 'analytics'],
  ['chartbeat.com', 'Chartbeat', 'analytics'],
  ['mixpanel.com', 'Mixpanel', 'analytics'],
  ['facebook.com', 'Meta', 'social'],
  ['instagram.com', 'Meta', 'social'],
  ['linkedin.com', 'LinkedIn', 'social'],
  ['twitter.com', 'X', 'social'],
  ['x.com', 'X', 'social'],
  ['tiktok.com', 'TikTok', 'social'],
];

const cache = new Map();

function lookup(name, domain) {
  for (const [re, who, category] of NAME_RULES) {
    if (re.test(name)) return { who, category };
  }
  const host = domain.replace(/^\./, '').toLowerCase();
  for (const [d, who, category] of DOMAIN_RULES) {
    if (host === d || host.endsWith('.' + d)) return { who, category };
  }
  return null;
}

// Returns { who, category, label, tracker } or null if we don't know it.
export function classify(cookie) {
  const key = `${cookie.name}\n${cookie.domain}`;
  if (!cache.has(key)) {
    const hit = lookup(cookie.name, cookie.domain);
    cache.set(key, hit && { ...hit, ...CATEGORIES[hit.category] });
  }
  return cache.get(key);
}

export const isTracker = (cookie) => Boolean(classify(cookie)?.tracker);
