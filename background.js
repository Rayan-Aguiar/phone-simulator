importScripts('sim/devices.js');

const { findDevice, defaultDeviceId, userAgentFor } = globalThis.PHONESIM;

// Esconde o HTML original da página enquanto a UI do simulador não é montada.
const HIDE_PAGE_CSS = 'html{background:#0f1115!important}body:not(.phonesim-body){display:none!important}';

const SUBRESOURCE_TYPES = [
  'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping',
  'csp_report', 'media', 'websocket', 'webtransport', 'webbundle', 'other',
];

const HIGH_ENTROPY_HINTS = [
  'sec-ch-ua-arch', 'sec-ch-ua-bitness', 'sec-ch-ua-full-version', 'sec-ch-ua-full-version-list',
  'sec-ch-ua-model', 'sec-ch-ua-platform-version', 'sec-ch-ua-wow64', 'sec-ch-ua-form-factors',
];

const remove = (header) => ({ header, operation: 'remove' });

// ---------- estado ----------
// simTabs (session): { [tabId]: { windows, ruleBase } } — abas com o simulador ativo.
// prefs (local): { windows, zoom, sidebarCollapsed, syncScroll } — últimas escolhas.
// windows: [{ id, deviceId, rotated }]. O 1º aparelho define o User-Agent dos cabeçalhos HTTP.

const MAX_WINDOWS = 6;
const DEFAULT_WINDOWS = [{ id: 1, deviceId: defaultDeviceId, rotated: false }];

function sanitizeWindows(windows) {
  if (!Array.isArray(windows) || windows.length === 0 || windows.length > MAX_WINDOWS) {
    throw new Error(`Use de 1 a ${MAX_WINDOWS} aparelhos`);
  }
  return windows.map(({ id, deviceId, rotated }) => {
    if (!Number.isInteger(id) || !findDevice(deviceId)) throw new Error(`Aparelho inválido: ${deviceId}`);
    return { id, deviceId, rotated: Boolean(rotated) };
  });
}

async function readSimTabs() {
  const { simTabs = {} } = await chrome.storage.session.get('simTabs');
  return simTabs;
}

async function readSimTab(tabId) {
  return (await readSimTabs())[tabId] ?? null;
}

async function writeSimTab(tabId, patch) {
  const simTabs = await readSimTabs();
  if (patch === null) delete simTabs[tabId];
  else simTabs[tabId] = { ...simTabs[tabId], ...patch };
  await chrome.storage.session.set({ simTabs });
}

async function readPrefs() {
  const { prefs = {} } = await chrome.storage.local.get('prefs');
  const merged = { windows: DEFAULT_WINDOWS, zoom: 'fit', sidebarCollapsed: false, syncScroll: true, keyboard: true, ...prefs };
  // A lista de aparelhos pode mudar entre versões; descarta o que não existe mais.
  const windows = Array.isArray(merged.windows) ? merged.windows.filter((win) => findDevice(win.deviceId)) : [];
  return { ...merged, windows: windows.length ? windows : DEFAULT_WINDOWS };
}

async function writePrefs(patch) {
  await chrome.storage.local.set({ prefs: { ...(await readPrefs()), ...patch } });
}

// ---------- regras de rede (declarativeNetRequest, só na aba simulada) ----------

// Cada aba recebe uma faixa própria de ids de regra (ruleBase+1..3), de um contador da sessão.
// Não dá para derivar do tabId: ids de aba podem passar do limite de inteiro 32 bits das regras.
async function allocateRuleBase() {
  const { nextRuleBase = 10 } = await chrome.storage.session.get('nextRuleBase');
  await chrome.storage.session.set({ nextRuleBase: nextRuleBase + 10 });
  return nextRuleBase;
}

const ruleIds = (ruleBase) => [1, 2, 3].map((n) => ruleBase + n);

function clientHintHeaders(device) {
  const highEntropy = HIGH_ENTROPY_HINTS.map(remove);
  if (device.os === 'ios') {
    // Safari não envia client hints.
    return [remove('sec-ch-ua'), remove('sec-ch-ua-mobile'), remove('sec-ch-ua-platform'), ...highEntropy];
  }
  return [
    { header: 'sec-ch-ua-mobile', operation: 'set', value: device.kind === 'tablet' ? '?0' : '?1' },
    { header: 'sec-ch-ua-platform', operation: 'set', value: '"Android"' },
    ...highEntropy,
  ];
}

function buildRules(tabId, ruleBase, device) {
  const [topPageRule, frameRule, userAgentRule] = ruleIds(ruleBase);
  return [
    {
      // A página de cima vira só a "casca" do simulador: os scripts do site não rodam nela.
      id: topPageRule,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [{ header: 'content-security-policy', operation: 'set', value: "script-src 'none'" }],
      },
      condition: { tabIds: [tabId], resourceTypes: ['main_frame'] },
    },
    {
      // Libera o site para abrir dentro do iframe do simulador.
      id: frameRule,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'sec-fetch-dest', operation: 'set', value: 'document' }],
        responseHeaders: [
          remove('x-frame-options'),
          remove('content-security-policy'),
          remove('content-security-policy-report-only'),
        ],
      },
      condition: { tabIds: [tabId], resourceTypes: ['sub_frame'] },
    },
    {
      id: userAgentRule,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'user-agent', operation: 'set', value: userAgentFor(device) },
          ...clientHintHeaders(device),
        ],
      },
      condition: { tabIds: [tabId], resourceTypes: ['main_frame', 'sub_frame', ...SUBRESOURCE_TYPES] },
    },
  ];
}

async function applyRules(tabId, ruleBase, deviceId) {
  const device = findDevice(deviceId) ?? findDevice(defaultDeviceId);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds(ruleBase),
    addRules: buildRules(tabId, ruleBase, device),
  });
}

async function removeRules(ruleBase) {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds(ruleBase) });
}

// ---------- ciclo de vida do simulador ----------

async function setBadge(tabId, on) {
  await chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' }).catch(() => {});
  if (on) await chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b82f6' }).catch(() => {});
}

async function startSim(tab) {
  if (!/^https?:/i.test(tab.url ?? '')) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '✕' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'O simulador só funciona em páginas http/https' });
    return;
  }
  const { windows } = await readPrefs();
  const ruleBase = await allocateRuleBase();
  await writeSimTab(tab.id, { windows, ruleBase });
  await applyRules(tab.id, ruleBase, windows[0].deviceId);
  await chrome.tabs.reload(tab.id);
}

async function stopSim(tabId, { reload = true } = {}) {
  const simTab = await readSimTab(tabId);
  if (simTab) await removeRules(simTab.ruleBase);
  await writeSimTab(tabId, null);
  await setBadge(tabId, false);
  if (reload) await chrome.tabs.reload(tabId).catch(() => {});
}

async function mountUi(tabId) {
  const target = { tabId, frameIds: [0] };
  await chrome.scripting.insertCSS({ target, files: ['sim/ui.css'] });
  await chrome.scripting.executeScript({ target, files: ['sim/devices.js', 'sim/ui.js'] });
  await setBadge(tabId, true);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (await readSimTab(tab.id)) await stopSim(tab.id);
  else await startSim(tab);
});

// O endereço de cada iframe é avisado pelo próprio inject/spoof.js (postMessage para a UI).
chrome.webNavigation.onCommitted.addListener(async ({ tabId, frameId }) => {
  if (frameId !== 0 || !(await readSimTab(tabId))) return;
  chrome.scripting.insertCSS({ target: { tabId, frameIds: [0] }, css: HIDE_PAGE_CSS }).catch(() => {});
});

chrome.webNavigation.onDOMContentLoaded.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0 || !/^https?:/i.test(url) || !(await readSimTab(tabId))) return;
  mountUi(tabId).catch((error) => console.warn('[phonesim] falha ao montar UI', error));
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (await readSimTab(tabId)) await stopSim(tabId, { reload: false });
});

// Regras e abas de sessões anteriores não valem mais após reiniciar/atualizar a extensão.
async function resetSessionState() {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: rules.map((rule) => rule.id) });
  await chrome.storage.session.clear();
}
chrome.runtime.onInstalled.addListener(resetSessionState);
chrome.runtime.onStartup.addListener(resetSessionState);

// ---------- mensagens da UI ----------

const handlers = {
  async 'phonesim:get-state'(_msg, tabId) {
    const simTab = await readSimTab(tabId);
    const prefs = await readPrefs();
    return {
      windows: simTab?.windows ?? prefs.windows,
      zoom: prefs.zoom,
      sidebarCollapsed: prefs.sidebarCollapsed,
      syncScroll: prefs.syncScroll,
      keyboard: prefs.keyboard,
    };
  },
  async 'phonesim:set-windows'({ windows }, tabId) {
    const clean = sanitizeWindows(windows);
    const simTab = await readSimTab(tabId);
    if (!simTab) throw new Error('Simulador não está ativo nesta aba');
    const primaryChanged = simTab.windows[0].deviceId !== clean[0].deviceId;
    await writeSimTab(tabId, { windows: clean });
    await writePrefs({ windows: clean });
    if (primaryChanged) await applyRules(tabId, simTab.ruleBase, clean[0].deviceId);
    return { primaryChanged };
  },
  async 'phonesim:set-view'({ zoom, sidebarCollapsed, syncScroll, keyboard }) {
    if (zoom !== undefined) await writePrefs({ zoom });
    if (typeof sidebarCollapsed === 'boolean') await writePrefs({ sidebarCollapsed });
    if (typeof syncScroll === 'boolean') await writePrefs({ syncScroll });
    if (typeof keyboard === 'boolean') await writePrefs({ keyboard });
    return { ok: true };
  },
  async 'phonesim:capture'(_msg, _tabId, sender) {
    const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
    return { dataUrl };
  },
  async 'phonesim:exit'(_msg, tabId) {
    await stopSim(tabId);
    return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg?.type];
  const tabId = sender.tab?.id;
  if (!handler || tabId === undefined) return false;
  handler(msg, tabId, sender).then(sendResponse, (error) => sendResponse({ error: String(error?.message ?? error) }));
  return true;
});
