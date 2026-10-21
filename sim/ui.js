// UI do simulador. Injetada no frame de cima da aba (mundo isolado) pelo background.
// Substitui o conteúdo da página por um ou mais aparelhos lado a lado (moldura PNG + status
// bar iOS), cada um com o site num iframe do mesmo domínio, e uma barra de ferramentas à direita.
(async () => {
  if (window.__phonesimMounted || !(document instanceof HTMLDocument)) return;
  window.__phonesimMounted = true;

  // Para de baixar o resto da página original; ela só serve de casca.
  window.stop();

  const { devices, findDevice, defaultDeviceId, userAgentFor } = globalThis.PHONESIM;
  const MAX_WINDOWS = 6;

  // allow-top-navigation-by-user-activation: links clicados podem sair do iframe,
  // mas scripts de "frame busting" não conseguem derrubar o simulador.
  const SANDBOX = [
    'allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox',
    'allow-modals', 'allow-downloads', 'allow-presentation', 'allow-pointer-lock',
    'allow-top-navigation-by-user-activation', 'allow-storage-access-by-user-activation',
  ].join(' ');
  const ALLOW = 'clipboard-read; clipboard-write; geolocation; camera; microphone; fullscreen; autoplay; encrypted-media; web-share';

  // ícones da barra lateral direita (linha, 24x24)
  const ICONS = {
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    devices: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 20h6"/><rect x="15" y="9" width="7" height="11" rx="1.5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.01"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4V8z"/>',
    panels: '<rect x="3" y="3" width="8" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8.9c0 1.7-2.3 2.1-2.3 3.6"/><path d="M12 17.5v.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    forward: '<path d="M9 18l6-6-6-6"/>',
    reload: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const plusGlyph = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';

  // ícones e rótulos das categorias do painel de aparelhos
  const APPLE_ICO = '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M11.2 8.5c0-1.4.8-2.2 1.3-2.6-.7-1-1.8-1.1-2.2-1.2-.9-.1-1.8.5-2.3.5s-1.2-.5-2-.5c-1 0-2 .6-2.5 1.5-1.1 1.9-.3 4.6.8 6.1.5.7 1.1 1.5 1.9 1.5s1-.5 2-.5 1.2.5 2 .5 1.3-.7 1.8-1.4c.6-.8.8-1.6.8-1.6s-1.6-.6-1.6-2.3zM9.7 3.8c.4-.5.7-1.2.6-1.9-.6 0-1.4.4-1.8.9-.4.4-.7 1.1-.6 1.8.7.1 1.4-.3 1.8-.8z"/></svg>';
  const ANDROID_ICO = '<svg width="17" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9v7a1 1 0 0 0 1 1h1v3a1 1 0 0 0 2 0v-3h4v3a1 1 0 0 0 2 0v-3h1a1 1 0 0 0 1-1V9H6zM4 9a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1zm16 0a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-5a1 1 0 0 0-1-1zM16.1 3l1-1.5a.3.3 0 0 0-.5-.3l-1 1.6A6.3 6.3 0 0 0 12 2c-1 0-2 .2-2.8.6l-1-1.6a.3.3 0 0 0-.5.3l1 1.5A5.5 5.5 0 0 0 6 7.5h12A5.5 5.5 0 0 0 16.1 3zM9.5 5.5a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm5 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"/></svg>';
  const TABLET_ICO = '<svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="10" y1="18.5" x2="14" y2="18.5"/></svg>';
  const GROUP_META = {
    iPhone: { label: 'iPhones', icon: APPLE_ICO },
    iPad: { label: 'iPads', icon: APPLE_ICO },
    'Telefones Android': { label: 'Telefones Android', icon: ANDROID_ICO },
    Tablets: { label: 'Tablets', icon: TABLET_ICO },
  };

  // ícones da status bar (preenchidos, brancos)
  const STATUS_ICONS = `
    <svg width="18" height="12" viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="17" height="12" viewBox="0 0 17 12" fill="#fff"><path d="M8.5 2.3c2.6 0 5 1 6.8 2.7l1.2-1.3C14.4 1.4 11.6.2 8.5.2S2.6 1.4.5 3.7l1.2 1.3C3.5 3.3 5.9 2.3 8.5 2.3Z"/><path d="M8.5 6c1.4 0 2.7.5 3.7 1.5l1.2-1.3C12.2 4.9 10.4 4.2 8.5 4.2s-3.7.7-5 2L4.8 7.5C5.8 6.5 7.1 6 8.5 6Z"/><circle cx="8.5" cy="10" r="1.7"/></svg>
    <svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="2" y="2" width="19" height="9" rx="2" fill="#fff"/><rect x="23.5" y="4" width="1.8" height="5" rx="1" fill="#fff" fill-opacity=".5"/></svg>`;

  const send = async (message) => {
    const response = await chrome.runtime.sendMessage(message);
    if (response?.error) throw new Error(response.error);
    return response;
  };

  const state = {
    windows: [{ id: 1, deviceId: defaultDeviceId, rotated: false }],
    zoom: 'fit',
    syncScroll: true,
    keyboard: true,
    recordAudio: true,
    frameUrl: location.href,
  };
  Object.assign(state, await send({ type: 'phonesim:get-state' }));
  let nextWindowId = Math.max(...state.windows.map((w) => w.id)) + 1;
  let activeId = state.windows[0].id;

  const deviceOf = (win) => findDevice(win.deviceId) ?? findDevice(defaultDeviceId);
  const winOf = (id) => state.windows.find((w) => w.id === id);
  const activeWin = () => winOf(activeId) ?? state.windows[0];
  const activeView = () => views.get(activeWin().id);

  // ---------- montagem do DOM ----------
  const originalTitle = document.title || location.hostname;
  const root = document.documentElement;
  for (const attr of [...root.attributes]) if (attr.name !== 'lang') root.removeAttribute(attr.name);

  const head = document.createElement('head');
  head.innerHTML = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title>';
  head.querySelector('title').textContent = `📱 ${originalTitle}`;

  const railTool = (key, title, badge) =>
    `<button class="ps-tool" data-tool="${key}" title="${title}" aria-label="${title}">${icon(key)}${badge ? `<span class="ps-badge">${badge}</span>` : ''}</button>`;

  const body = document.createElement('body');
  body.className = 'phonesim-body';
  body.innerHTML = `
    <main class="ps-stage"><div class="ps-windows"></div></main>

    <nav class="ps-rail">
      ${railTool('close', 'Sair do simulador')}
      ${railTool('devices', 'Aparelhos (comparar)')}
      ${railTool('alert', 'Detalhes do aparelho')}
      ${railTool('rotate', 'Girar')}
      ${railTool('zoom', 'Zoom')}
      ${railTool('camera', 'Capturar tela (PNG)')}
      ${railTool('video', 'Gravar')}
      ${railTool('panels', 'Modos', 'NEW')}
      <div class="ps-spacer"></div>
      ${railTool('share', 'Copiar endereço')}
      ${railTool('help', 'Ajuda')}
      ${railTool('settings', 'Configurações')}
    </nav>

    <div class="ps-pop ps-pop-devices" hidden>
      <div class="ps-vis-head">Dispositivos visíveis na aba</div>
      <div class="ps-vis-row"></div>
      <div class="ps-devices-list"></div>
    </div>

    <div class="ps-pop ps-pop-zoom" hidden>
      <h3>Zoom</h3>
      <button class="ps-opt" data-zoom="fit">Ajustar à tela</button>
      <button class="ps-opt" data-zoom="50">50%</button>
      <button class="ps-opt" data-zoom="75">75%</button>
      <button class="ps-opt" data-zoom="100">100%</button>
      <button class="ps-opt" data-zoom="125">125%</button>
    </div>

    <div class="ps-pop ps-pop-settings" hidden>
      <h3>Endereço</h3>
      <form class="ps-url-form ps-field">
        <input class="ps-input ps-url" type="text" spellcheck="false" autocomplete="off" />
      </form>
      <div class="ps-nav">
        <button class="ps-row-btn" data-nav="back" title="Voltar">${icon('back')}</button>
        <button class="ps-row-btn" data-nav="forward" title="Avançar">${icon('forward')}</button>
        <button class="ps-row-btn" data-nav="reload" title="Recarregar todos">${icon('reload')}</button>
      </div>
      <h3>Opções</h3>
      <label class="ps-check"><input type="checkbox" class="ps-sync"><span>Sincronizar interações<small>Rolagem, cliques e digitação entre aparelhos</small></span></label>
      <label class="ps-check"><input type="checkbox" class="ps-keyboard-toggle"><span>Teclado virtual<small>Aparece ao tocar num campo</small></span></label>
      <label class="ps-check"><input type="checkbox" class="ps-rec-audio"><span>Gravar com áudio<small>Captura o som da aba no vídeo</small></span></label>
      <p class="ps-note" hidden>O cabeçalho User-Agent enviado ao servidor segue o 1º aparelho. Cada aparelho tem o seu no JavaScript.</p>
    </div>

    <div class="ps-toast" role="status" aria-live="polite"></div>`;
  root.replaceChildren(head, body);

  const $ = (sel) => body.querySelector(sel);
  const assetUrl = (p) => chrome.runtime.getURL(p);
  const windowsEl = $('.ps-windows');
  const stageEl = $('.ps-stage');
  const toastEl = $('.ps-toast');
  const urlInput = $('.ps-url');
  const syncInput = $('.ps-sync');
  const keyboardToggle = $('.ps-keyboard-toggle');
  const recAudioInput = $('.ps-rec-audio');
  const devicesList = $('.ps-devices-list');
  const visRow = $('.ps-vis-row');
  const noteEl = $('.ps-note');

  syncInput.checked = state.syncScroll;
  keyboardToggle.checked = state.keyboard;
  recAudioInput.checked = state.recordAudio;
  urlInput.value = state.frameUrl;

  // ---------- janelas de aparelho ----------
  // views: id -> { el, scaler, device, screen, frameImg, keyboard, clock, kb, frame, url, syncing }
  const views = new Map();

  function createView(win) {
    const el = document.createElement('section');
    el.className = 'ps-window';
    el.dataset.id = String(win.id);
    el.innerHTML = `
      <button class="ps-win-close" title="Fechar este aparelho">${icon('close')}</button>
      <div class="ps-scaler">
        <div class="ps-device">
          <div class="ps-screen">
            <div class="ps-status"><span class="ps-clock"></span><span class="ps-status-right">${STATUS_ICONS}</span></div>
            <div class="ps-keyboard"></div>
          </div>
          <img class="ps-frame" alt="" />
        </div>
      </div>`;
    windowsEl.append(el);
    const view = {
      el,
      scaler: el.querySelector('.ps-scaler'),
      device: el.querySelector('.ps-device'),
      screen: el.querySelector('.ps-screen'),
      status: el.querySelector('.ps-status'),
      frameImg: el.querySelector('.ps-frame'),
      keyboard: el.querySelector('.ps-keyboard'),
      clock: el.querySelector('.ps-clock'),
      kb: { open: false, layout: 'text', mode: 'letters', shift: false, hideTimer: null },
      frame: null,
      url: null,
      syncing: false,
    };
    views.set(win.id, view);
    view.frameImg.src = assetUrl(`assets/devices/${deviceOf(win).id}/device.png`);
    return view;
  }

  function spoofConfig(d) {
    const ios = d.os === 'ios';
    return {
      ua: userAgentFor(d),
      os: d.os,
      kind: d.kind,
      width: d.width,
      height: d.height,
      dpr: d.dpr,
      platform: ios ? (d.kind === 'tablet' ? 'iPad' : 'iPhone') : 'Linux armv81',
      vendor: ios ? 'Apple Computer, Inc.' : 'Google Inc.',
    };
  }

  // Recria o iframe: o nome (com a config do aparelho) só é lido quando o documento carrega.
  function loadFrame(win, url) {
    const view = views.get(win.id);
    url = url ?? view.url ?? state.frameUrl;
    closeKeyboard(view);
    view.frame?.remove();
    const el = document.createElement('iframe');
    el.name = `phonesim:${btoa(JSON.stringify(spoofConfig(deviceOf(win))))}`;
    el.setAttribute('sandbox', SANDBOX);
    el.allow = ALLOW;
    el.src = url;
    view.screen.prepend(el);
    view.frame = el;
    view.url = url;
    view.syncing = true;
    layout(); // posiciona o iframe abaixo da status bar (top/height dependem da geometria)
  }

  // ---------- geometria e escala ----------
  function geometry(win) {
    const d = deviceOf(win);
    const land = win.rotated && d.rotate && d.pathL;
    if (!land) {
      return { d, land: false, w: d.width, h: d.height, left: d.left, top: d.top, fw: d.fw, fh: d.fh, clip: d.path };
    }
    // 90° horário: novo offset = (fh - top - h, left); caixa vira fh×fw.
    return { d, land: true, w: d.height, h: d.width, left: d.fh - d.top - d.height, top: d.left, fw: d.fh, fh: d.fw, clip: d.pathL };
  }

  // Altura (px da tela do aparelho) reservada para a status bar, para o site começar
  // ABAIXO dela — como num celular de verdade. Sem isso, o header do site fica escondido
  // atrás do relógio/ícones. Celulares com notch/ilha têm faixa maior que os com botão home.
  function statusInset(d, land) {
    if (d.kind === 'tablet' || land) return 0;
    if (d.os === 'android') return 26;
    return /[CcAaQq]/.test(d.path) ? 47 : 20; // path com curva = notch/ilha; reto = botão home
  }

  function layout() {
    const items = state.windows.map((win) => ({ win, view: views.get(win.id), geo: geometry(win) }));
    const GAP = 28;

    // escala compartilhada: todos lado a lado cabem na largura e o mais alto na altura
    let scale = Number(state.zoom) / 100;
    if (state.zoom === 'fit') {
      const availW = window.innerWidth - 150 - GAP * (items.length - 1);
      const availH = window.innerHeight - 40;
      const totalW = items.reduce((s, it) => s + it.geo.fw, 0);
      const maxH = Math.max(...items.map((it) => it.geo.fh));
      scale = Math.max(0.15, Math.min(1, availW / totalW, availH / maxH));
    }

    for (const { win, view, geo } of items) {
      const { d, land, w, h, left, top, fw, fh, clip } = geo;
      view.device.dataset.kind = d.kind;
      view.device.style.width = `${fw}px`;
      view.device.style.height = `${fh}px`;

      if (land) {
        view.frameImg.style.width = `${fh}px`;
        view.frameImg.style.height = `${fw}px`;
        view.frameImg.style.inset = 'auto';
        view.frameImg.style.left = '50%';
        view.frameImg.style.top = '50%';
        view.frameImg.style.transform = 'translate(-50%, -50%) rotate(90deg)';
      } else {
        view.frameImg.style.cssText = '';
      }

      view.screen.style.left = `${left}px`;
      view.screen.style.top = `${top}px`;
      view.screen.style.width = `${w}px`;
      view.screen.style.height = `${h}px`;
      view.screen.style.clipPath = clip ? `path(evenodd, '${clip}')` : '';

      view.device.style.transform = `scale(${scale})`;
      view.scaler.style.width = `${fw * scale}px`;
      view.scaler.style.height = `${fh * scale}px`;

      const kbH = keyboardHeight(d, w, h, land);
      view.keyboard.style.height = `${kbH}px`;
      view.keyboard.style.fontSize = `${Math.round(Math.min(w, 500) / 18)}px`;

      // reserva a faixa da status bar: o site começa abaixo dela e termina no topo do teclado.
      const sb = statusInset(d, land);
      view.status.style.height = `${sb}px`;
      if (view.frame) {
        view.frame.style.top = `${sb}px`;
        view.frame.style.height = `${(view.kb.open ? h - kbH : h) - sb}px`;
      }

      view.el.dataset.active = String(win.id === activeId && state.windows.length > 1);
      view.el.querySelector('.ps-win-close').hidden = state.windows.length === 1;
    }

    windowsEl.style.gap = `${GAP}px`;
    // aviso de User-Agent quando há OS diferentes (o cabeçalho segue o 1º aparelho)
    noteEl.hidden = new Set(state.windows.map((w) => deviceOf(w).os)).size < 2;
  }

  // ---------- relógio da status bar ----------
  function tick() {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    for (const v of views.values()) v.clock.textContent = t;
  }
  setInterval(tick, 15000);

  // ---------- teclado virtual (por aparelho) ----------
  function keyboardHeight(d, w, h, rotated) {
    if (d.kind === 'tablet') return Math.round(w * (rotated ? 0.3 : 0.42));
    if (rotated) return Math.round(h * 0.55);
    return Math.round(w * 0.66) + 34; // + faixa do indicador de início / barra de navegação
  }

  const SPECIAL_KEYS = ['shift', 'backspace', 'enter', 'mode', 'space'];

  function keyboardRows(os, kb) {
    if (kb.layout === 'numeric') return [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], [',', '0', 'backspace']];
    const bottom = os === 'ios' ? ['mode', 'space', 'enter'] : ['mode', ',', 'space', '.', 'enter'];
    if (kb.mode === 'symbols') {
      return [[...'1234567890'], [...'-/:;()$&@"'], ['.', ',', '?', '!', "'", 'backspace'], bottom];
    }
    const letters = (chars) => [...chars].map((c) => (kb.shift ? c.toUpperCase() : c));
    return [letters('qwertyuiop'), letters('asdfghjkl'), ['shift', ...letters('zxcvbnm'), 'backspace'], bottom];
  }

  function keyLabel(key, os, kb) {
    if (key === 'mode') return kb.mode === 'symbols' ? 'ABC' : os === 'ios' ? '123' : '?123';
    if (key === 'space') return os === 'ios' ? 'espaço' : '';
    return { shift: '⇧', backspace: '⌫', enter: '↵' }[key] ?? key;
  }

  function renderKeyboard(win) {
    const view = views.get(win.id);
    const os = deviceOf(win).os;
    const { kb } = view;
    view.keyboard.dataset.os = os;
    view.keyboard.dataset.layout = kb.layout;
    view.keyboard.replaceChildren(
      ...keyboardRows(os, kb).map((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'ps-kb-row';
        for (const key of row) {
          const button = document.createElement('button');
          button.type = 'button';
          button.tabIndex = -1;
          button.className = 'ps-key';
          button.dataset.key = key;
          if (SPECIAL_KEYS.includes(key)) button.dataset.special = key;
          if (key === 'shift' && kb.shift) button.classList.add('ps-key-on');
          button.textContent = keyLabel(key, os, kb);
          rowEl.append(button);
        }
        return rowEl;
      }),
    );
  }

  function openKeyboard(view, win, layoutName) {
    const { kb } = view;
    clearTimeout(kb.hideTimer);
    if (!state.keyboard) return;
    if (!kb.open || kb.layout !== layoutName) Object.assign(kb, { layout: layoutName, mode: 'letters', shift: false });
    kb.open = true;
    renderKeyboard(win);
    layout();
    requestAnimationFrame(() => { if (kb.open) view.keyboard.classList.add('ps-kb-open'); });
  }

  function closeKeyboard(view) {
    clearTimeout(view.kb.hideTimer);
    if (!view.kb.open) return;
    view.kb.open = false;
    view.keyboard.classList.remove('ps-kb-open');
    layout();
  }

  const scheduleCloseKeyboard = (view) => {
    clearTimeout(view.kb.hideTimer);
    view.kb.hideTimer = setTimeout(() => closeKeyboard(view), 120);
  };

  function pressKey(view, win, key) {
    const { kb } = view;
    if (key === 'shift') kb.shift = !kb.shift;
    else if (key === 'mode') kb.mode = kb.mode === 'symbols' ? 'letters' : 'symbols';
    else {
      const typed = key === 'space' ? ' ' : key;
      view.frame?.contentWindow?.postMessage({ type: 'phonesim:apply', event: { kind: 'type', key: typed } }, '*');
      if (!kb.shift || typed.length !== 1) return;
      kb.shift = false;
    }
    renderKeyboard(win);
  }

  // mousedown cancelado: o campo dentro do iframe continua com o foco ao tocar nas teclas.
  windowsEl.addEventListener('mousedown', (event) => {
    if (event.target.closest('.ps-keyboard')) event.preventDefault();
  });
  windowsEl.addEventListener('click', (event) => {
    const keyEl = event.target.closest('.ps-key');
    if (keyEl) {
      const win = winOf(Number(keyEl.closest('.ps-window').dataset.id));
      if (win) pressKey(views.get(win.id), win, keyEl.dataset.key);
      return;
    }
    const closeEl = event.target.closest('.ps-win-close');
    if (closeEl) { closeWindow(Number(closeEl.closest('.ps-window').dataset.id)); return; }
    // clique no aparelho (moldura) foca ele
    const winEl = event.target.closest('.ps-window');
    if (winEl) setActive(Number(winEl.dataset.id));
  });

  // ---------- ponte com os iframes (spoof.js) ----------
  function viewBySource(source) {
    for (const [id, view] of views) if (view.frame?.contentWindow === source) return [id, view];
    return [];
  }

  window.addEventListener('message', (event) => {
    const [id, view] = viewBySource(event.source);
    if (!view) return;
    const win = winOf(id);
    const data = event.data;
    if (data?.type === 'phonesim:location') onFrameLocation(id, view, data);
    else if (data?.type === 'phonesim:keyboard') {
      if (data.open) openKeyboard(view, win, data.layout === 'numeric' ? 'numeric' : 'text');
      else scheduleCloseKeyboard(view);
    } else if (data?.type === 'phonesim:sync' && state.syncScroll) {
      for (const [otherId, other] of views) {
        if (otherId !== id) other.frame?.contentWindow?.postMessage({ type: 'phonesim:apply', event: data.event }, '*');
      }
    }
  });

  function onFrameLocation(id, view, { url, sync }) {
    view.url = url;
    closeKeyboard(view);
    if (id === activeId) {
      state.frameUrl = url;
      if (document.activeElement !== urlInput) urlInput.value = url;
    }
    const programmatic = view.syncing;
    view.syncing = false;
    if (programmatic || !sync || !state.syncScroll) return;
    for (const [otherId, other] of views) {
      if (otherId !== id && other.url !== url) loadFrame(winOf(otherId), url);
    }
  }

  // ---------- persistência ----------
  const saveWindows = () => send({ type: 'phonesim:set-windows', windows: state.windows });
  const saveView = (patch) => send({ type: 'phonesim:set-view', ...patch }).catch(() => {});

  // Se o 1º aparelho mudou, o User-Agent do cabeçalho mudou para todos: recarrega todos.
  function reloadAfterSave({ primaryChanged }, changedWin) {
    if (primaryChanged) state.windows.forEach((w) => loadFrame(w));
    else if (changedWin) loadFrame(changedWin);
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('ps-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('ps-visible'), 2600);
  }

  // ---------- captura de tela (aparelho ativo) ----------
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('imagem inválida'));
      img.src = src;
    });

  async function screenshot() {
    const win = activeWin();
    const view = views.get(win.id);
    body.classList.add('ps-capturing');
    await nextFrame();
    await nextFrame();
    try {
      const d = deviceOf(win);
      const [{ dataUrl }, frameSrc] = await Promise.all([
        send({ type: 'phonesim:capture' }),
        loadImage(assetUrl(`assets/devices/${d.id}/device.png`)),
      ]);
      const shot = await loadImage(dataUrl);

      const geo = geometry(win);
      const S = 2;
      const outW = Math.round(geo.fw * S);
      const outH = Math.round(geo.fh * S);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      if (geo.land) {
        ctx.save();
        ctx.translate(outW, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(frameSrc, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(frameSrc, 0, 0, outW, outH);
      }

      const ratio = shot.naturalWidth / window.innerWidth;
      const r = view.screen.getBoundingClientRect();
      ctx.save();
      ctx.setTransform(S, 0, 0, S, geo.left * S, geo.top * S);
      if (geo.clip) ctx.clip(new Path2D(geo.clip), 'evenodd');
      ctx.drawImage(shot, r.left * ratio, r.top * ratio, r.width * ratio, r.height * ratio, 0, 0, geo.w, geo.h);
      ctx.restore();

      body.classList.remove('ps-capturing');
      openEditor(canvas, d);
    } catch (error) {
      body.classList.remove('ps-capturing');
      toast(`Falha na captura: ${error.message}`);
    }
  }

  // ---------- editor de imagem pós-print ----------
  const EDITOR_COLORS = ['#ff0000', '#ff9500', '#ffcc00', '#34c759', '#2f81f7', '#af52de', '#000000', '#ffffff'];
  const EDITOR_ICONS = {
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
    arrow: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>',
    line: '<path d="M5 19L19 5"/>',
    text: '<path d="M5 6h14"/><path d="M12 6v13"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
  };
  const edIcon = (n) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${EDITOR_ICONS[n]}</svg>`;

  let ed = null;

  function buildEditor() {
    const root = document.createElement('div');
    root.className = 'ps-editor';
    root.hidden = true;
    const toolBtn = (t, title) => `<button class="ps-ed-tool" data-ed-tool="${t}" title="${title}">${edIcon(t)}</button>`;
    root.innerHTML = `
      <div class="ps-ed-bar">
        <div class="ps-ed-group">
          ${toolBtn('rect', 'Retângulo')}${toolBtn('arrow', 'Seta')}${toolBtn('line', 'Linha')}${toolBtn('text', 'Texto')}
        </div>
        <div class="ps-ed-group ps-ed-colors">
          ${EDITOR_COLORS.map((c) => `<button class="ps-ed-color" data-ed-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
        </div>
        <label class="ps-ed-group ps-ed-width" title="Espessura"><input type="range" min="1" max="24" class="ps-ed-w"></label>
        <div class="ps-ed-group">
          <button class="ps-ed-act" data-ed-act="undo" title="Desfazer (Ctrl+Z)">${edIcon('undo')}</button>
          <button class="ps-ed-act" data-ed-act="clear" title="Limpar">${edIcon('clear')}</button>
        </div>
        <div class="ps-ed-group ps-ed-right">
          <button class="ps-ed-act" data-ed-act="copy" title="Copiar">${edIcon('copy')}</button>
          <button class="ps-ed-save" data-ed-act="png">PNG</button>
          <button class="ps-ed-save" data-ed-act="webp">WebP</button>
          <button class="ps-ed-act" data-ed-act="close" title="Fechar">${edIcon('close')}</button>
        </div>
      </div>
      <div class="ps-ed-stage"><canvas class="ps-ed-canvas"></canvas></div>`;
    body.append(root);

    const canvas = root.querySelector('.ps-ed-canvas');
    const ctx = canvas.getContext('2d');
    const st = { tool: 'rect', color: '#ff0000', w: Math.max(2, Math.round(3 * (window.devicePixelRatio || 1))), shapes: [], drawing: false, cur: null, base: null };
    ed = { root, canvas, ctx, st };

    const widthInput = root.querySelector('.ps-ed-w');
    widthInput.value = st.w;

    function markTool() {
      for (const b of root.querySelectorAll('[data-ed-tool]')) b.dataset.on = String(b.dataset.edTool === st.tool);
      for (const b of root.querySelectorAll('[data-ed-color]')) b.dataset.on = String(b.dataset.edColor === st.color);
    }

    function drawArrow(c, from, to, color, w) {
      const head = Math.max(10, w * 3.5);
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();
      c.beginPath();
      c.moveTo(to.x, to.y);
      c.lineTo(to.x - head * Math.cos(ang - Math.PI / 6), to.y - head * Math.sin(ang - Math.PI / 6));
      c.lineTo(to.x - head * Math.cos(ang + Math.PI / 6), to.y - head * Math.sin(ang + Math.PI / 6));
      c.closePath(); c.fill();
    }
    const constrainSquare = (s, e) => {
      const side = Math.max(Math.abs(e.x - s.x), Math.abs(e.y - s.y));
      return { x: s.x + Math.sign(e.x - s.x) * side, y: s.y + Math.sign(e.y - s.y) * side };
    };
    const constrainAngle = (s, e, step = 45) => {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      const a = Math.round(Math.atan2(e.y - s.y, e.x - s.x) / (Math.PI / 180) / step) * step * (Math.PI / 180);
      return { x: s.x + d * Math.cos(a), y: s.y + d * Math.sin(a) };
    };

    function drawShape(c, s) {
      c.save();
      c.lineWidth = s.w; c.strokeStyle = s.color; c.fillStyle = s.color; c.lineJoin = 'round'; c.lineCap = 'round';
      if (s.type === 'rect') {
        let e = s.end; if (s.lock) e = constrainSquare(s.start, e);
        c.strokeRect(Math.min(s.start.x, e.x), Math.min(s.start.y, e.y), Math.abs(e.x - s.start.x), Math.abs(e.y - s.start.y));
      } else if (s.type === 'arrow') {
        let e = s.end; if (s.lock) e = constrainAngle(s.start, e);
        drawArrow(c, s.start, e, s.color, s.w);
      } else if (s.type === 'line') {
        let e = s.end; if (s.lock) e = constrainAngle(s.start, e);
        c.beginPath(); c.moveTo(s.start.x, s.start.y); c.lineTo(e.x, e.y); c.stroke();
      } else if (s.type === 'text') {
        c.font = `${s.size}px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        c.textBaseline = 'top';
        c.fillText(s.text, s.start.x, s.start.y);
      }
      c.restore();
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(st.base, 0, 0);
      for (const s of st.shapes) drawShape(ctx, s);
      if (st.cur) drawShape(ctx, st.cur);
    }
    ed.render = render;

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    };

    function placeText(p, clientX, clientY) {
      const input = document.createElement('input');
      input.className = 'ps-ed-textinput';
      input.style.left = `${clientX}px`;
      input.style.top = `${clientY}px`;
      input.style.color = st.color;
      input.style.font = `${Math.round(st.w * 7 * (canvas.getBoundingClientRect().width / canvas.width))}px Inter, system-ui, sans-serif`;
      root.append(input);
      input.focus();
      const commit = () => {
        if (input.value.trim()) st.shapes.push({ type: 'text', start: p, text: input.value, color: st.color, w: st.w, size: st.w * 7 });
        input.remove();
        render();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') input.remove(); });
      input.addEventListener('blur', commit);
    }

    canvas.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      if (st.tool === 'text') { placeText(p, e.clientX, e.clientY); return; }
      st.drawing = true;
      st.cur = { type: st.tool, start: p, end: p, color: st.color, w: st.w, lock: e.shiftKey };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!st.drawing) return;
      st.cur.end = pos(e); st.cur.lock = e.shiftKey; render();
    });
    canvas.addEventListener('pointerup', () => {
      if (!st.drawing) return;
      st.drawing = false;
      if (st.cur) st.shapes.push(st.cur);
      st.cur = null; render();
    });

    root.addEventListener('click', (e) => {
      const tool = e.target.closest('[data-ed-tool]');
      if (tool) { st.tool = tool.dataset.edTool; markTool(); return; }
      const color = e.target.closest('[data-ed-color]');
      if (color) { st.color = color.dataset.edColor; markTool(); return; }
      const act = e.target.closest('[data-ed-act]')?.dataset.edAct;
      if (!act) return;
      if (act === 'undo') { st.shapes.pop(); render(); }
      else if (act === 'clear') { st.shapes = []; render(); }
      else if (act === 'close') closeEditor();
      else if (act === 'copy') edCopy();
      else edDownload(act);
    });
    widthInput.addEventListener('input', () => { st.w = Number(widthInput.value); });

    function edDownload(fmt) {
      canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${ed.deviceId}-${new Date().toISOString().replace(/[:.]/g, '-')}.${fmt}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      }, `image/${fmt}`, 0.85);
      toast(`Imagem salva (${fmt.toUpperCase()})`);
    }
    async function edCopy() {
      try {
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Copiada para a área de transferência');
      } catch { toast('Não foi possível copiar'); }
    }

    ed.markTool = markTool;
    ed.onKey = (e) => {
      if (e.key === 'Escape') closeEditor();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); st.shapes.pop(); render(); }
    };
    return ed;
  }

  function openEditor(baseCanvas, device) {
    if (!ed) buildEditor();
    const { st, canvas, root } = ed;
    ed.deviceId = device.id;
    st.shapes = []; st.cur = null; st.drawing = false; st.tool = 'rect'; st.color = '#ff0000';
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    st.base = baseCanvas;
    ed.render();
    ed.markTool();
    root.hidden = false;
    window.addEventListener('keydown', ed.onKey, true);
  }

  function closeEditor() {
    if (!ed) return;
    ed.root.hidden = true;
    window.removeEventListener('keydown', ed.onKey, true);
  }

  // ---------- gravação de tela (aparelho ativo) ----------
  let rec = null;

  const tabStream = (streamId, withAudio) => {
    const src = { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } };
    return navigator.mediaDevices.getUserMedia({ audio: withAudio ? src : false, video: src });
  };

  async function toggleRecord(btn) {
    if (rec) return stopRecord();
    const win = activeWin();
    const view = views.get(win.id);
    try {
      const { streamId } = await send({ type: 'phonesim:record-stream-id' });
      let stream;
      try { stream = await tabStream(streamId, state.recordAudio); }
      catch { stream = await tabStream(streamId, false); }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      let audioCtx = null;
      if (stream.getAudioTracks().length) {
        audioCtx = new AudioContext();
        audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);
        audioCtx.resume?.().catch(() => {});
      }

      const geo = geometry(win);
      const mask = await loadImage(assetUrl(`assets/devices/${deviceOf(win).id}/device.png`));

      const rect = view.device.getBoundingClientRect();
      const scale = Math.min(video.videoWidth / window.innerWidth, video.videoHeight / window.innerHeight);
      const offX = (video.videoWidth - window.innerWidth * scale) / 2;
      const offY = (video.videoHeight - window.innerHeight * scale) / 2;
      const crop = { x: offX + rect.left * scale, y: offY + rect.top * scale, w: rect.width * scale, h: rect.height * scale };
      const canvas = document.createElement('canvas');
      const cw = Math.max(2, Math.round(crop.w));
      const ch = Math.max(2, Math.round(crop.h));
      canvas.width = cw;
      canvas.height = ch;
      const cctx = canvas.getContext('2d');

      let raf = 0;
      const draw = () => {
        cctx.clearRect(0, 0, cw, ch);
        cctx.globalCompositeOperation = 'source-over';
        cctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, cw, ch);
        cctx.globalCompositeOperation = 'destination-in';
        if (geo.land) {
          cctx.save();
          cctx.translate(cw, 0);
          cctx.rotate(Math.PI / 2);
          cctx.drawImage(mask, 0, 0, ch, cw);
          cctx.restore();
        } else {
          cctx.drawImage(mask, 0, 0, cw, ch);
        }
        cctx.globalCompositeOperation = 'source-over';
        raf = requestAnimationFrame(draw);
      };
      draw();

      const canvasStream = canvas.captureStream(30);
      const recordStream = new MediaStream([...canvasStream.getVideoTracks(), ...stream.getAudioTracks()]);

      const hasAudio = stream.getAudioTracks().length > 0;
      const pick = (c) => MediaRecorder.isTypeSupported(c);
      const mime = (hasAudio && pick('video/webm;codecs=vp9,opus')) ? 'video/webm;codecs=vp9,opus'
        : (hasAudio && pick('video/webm;codecs=vp8,opus')) ? 'video/webm;codecs=vp8,opus'
        : pick('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
        : pick('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const recorder = new MediaRecorder(recordStream, { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        canvasStream.getTracks().forEach((t) => t.stop());
        audioCtx?.close();
        const blob = new Blob(chunks, { type: 'video/webm' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${deviceOf(win).id}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        toast('Gravação salva');
      };
      recorder.start();
      rec = { recorder, btn };
      btn.classList.add('ps-recording');
      btn.title = 'Parar gravação';
      toast(hasAudio ? 'Gravando (com áudio)… clique para parar' : 'Gravando… clique para parar');
    } catch (error) {
      rec = null;
      toast(`Falha ao gravar: ${error.message}`);
    }
  }

  function stopRecord() {
    if (!rec) return;
    const { recorder, btn } = rec;
    rec = null;
    btn.classList.remove('ps-recording');
    btn.title = 'Gravar';
    if (recorder.state !== 'inactive') recorder.stop();
  }

  function normalizeUrl(raw) {
    const value = raw.trim();
    if (!value) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withScheme);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  // ---------- painel de aparelhos ----------
  function buildDeviceList() {
    // linha "dispositivos visíveis na aba": um círculo por aparelho + adicionar
    visRow.replaceChildren();
    for (const win of state.windows) {
      const d = deviceOf(win);
      const item = document.createElement('button');
      item.className = 'ps-vis-item';
      item.dataset.visId = String(win.id);
      item.dataset.on = String(win.id === activeId);
      item.title = d.name;
      item.innerHTML = `<img src="${assetUrl(`assets/devices/${d.id}/terminal-mini.png`)}" alt="">`;
      visRow.append(item);
    }
    if (state.windows.length < MAX_WINDOWS) {
      const add = document.createElement('button');
      add.className = 'ps-vis-add';
      add.dataset.visAdd = '';
      add.title = 'Adicionar aparelho';
      add.innerHTML = `${plusGlyph}<span class="ps-badge">NEW</span>`;
      visRow.append(add);
    }

    // grade do catálogo: muda o aparelho ATIVO
    devicesList.replaceChildren();
    let currentGroup = null;
    let grid = null;
    for (const d of devices) {
      if (d.group !== currentGroup) {
        currentGroup = d.group;
        const meta = GROUP_META[d.group] ?? { label: d.group, icon: '' };
        const headEl = document.createElement('div');
        headEl.className = 'ps-dgroup-head';
        headEl.innerHTML = `${meta.icon}<span>${meta.label}</span>`;
        devicesList.append(headEl);
        grid = document.createElement('div');
        grid.className = 'ps-dgrid';
        devicesList.append(grid);
      }
      const card = document.createElement('button');
      card.className = 'ps-dcard';
      card.dataset.device = d.id;
      card.dataset.on = String(d.id === activeWin().deviceId);
      card.title = `${d.name} · ${d.width}×${d.height}`;
      card.innerHTML = `<img class="ps-dcard-ico" src="${assetUrl(`assets/devices/${d.id}/terminal-mini.png`)}" alt=""><span class="ps-dcard-name">${d.name}</span>`;
      grid.append(card);
    }
  }

  function setActive(id) {
    if (!winOf(id) || id === activeId) return;
    activeId = id;
    const view = views.get(id);
    state.frameUrl = view.url ?? state.frameUrl;
    if (document.activeElement !== urlInput) urlInput.value = state.frameUrl;
    layout();
    if (!pops.devices.hidden) buildDeviceList();
  }

  async function addWindow() {
    if (state.windows.length >= MAX_WINDOWS) return;
    const lastIndex = devices.findIndex((d) => d.id === state.windows.at(-1).deviceId);
    const win = { id: nextWindowId++, deviceId: devices[(lastIndex + 1) % devices.length].id, rotated: false };
    state.windows.push(win);
    createView(win);
    layout();
    loadFrame(win, state.frameUrl);
    activeId = win.id;
    layout();
    buildDeviceList();
    try { await saveWindows(); } catch (error) { toast(error.message); }
  }

  async function closeWindow(id) {
    if (state.windows.length === 1) return;
    state.windows = state.windows.filter((w) => w.id !== id);
    views.get(id)?.el.remove();
    views.delete(id);
    if (activeId === id) activeId = state.windows[0].id;
    layout();
    if (!pops.devices.hidden) buildDeviceList();
    try { reloadAfterSave(await saveWindows()); } catch (error) { toast(error.message); }
  }

  function selectDevice(id) {
    const win = activeWin();
    if (!findDevice(id) || id === win.deviceId) return closePops();
    win.deviceId = id;
    views.get(win.id).frameImg.src = assetUrl(`assets/devices/${id}/device.png`);
    layout();
    // reloadAfterSave recria o iframe (config nova; se for o 1º, recarrega todos pelo UA)
    saveWindows().then((r) => reloadAfterSave(r, win)).catch((error) => toast(error.message));
    closePops();
  }

  function setZoom(value) {
    state.zoom = value;
    layout();
    saveView({ zoom: value });
    closePops();
  }

  // ---------- popovers ----------
  const pops = {
    devices: $('.ps-pop-devices'),
    zoom: $('.ps-pop-zoom'),
    settings: $('.ps-pop-settings'),
  };

  function closePops(except) {
    for (const [name, el] of Object.entries(pops)) {
      if (name !== except) {
        el.hidden = true;
        body.querySelector(`[data-tool="${name}"]`)?.setAttribute('aria-expanded', 'false');
      }
    }
  }

  function togglePop(name, anchorBtn) {
    const el = pops[name];
    const willOpen = el.hidden;
    closePops(willOpen ? name : null);
    el.hidden = !willOpen;
    anchorBtn.setAttribute('aria-expanded', String(willOpen));
    if (!willOpen) return;
    if (name === 'devices') buildDeviceList();
    if (name === 'zoom') for (const opt of el.querySelectorAll('[data-zoom]')) opt.dataset.on = String(opt.dataset.zoom === String(state.zoom));
    const rect = anchorBtn.getBoundingClientRect();
    const maxH = window.innerHeight - 24;
    el.style.maxHeight = `${maxH}px`;
    const height = Math.min(el.offsetHeight, maxH);
    el.style.top = `${Math.max(12, Math.min(rect.top, window.innerHeight - height - 12))}px`;
  }

  // ---------- ações da barra ----------
  const tools = {
    close: () => send({ type: 'phonesim:exit' }).catch((e) => toast(e.message)),
    devices: (btn) => togglePop('devices', btn),
    zoom: (btn) => togglePop('zoom', btn),
    settings: (btn) => togglePop('settings', btn),
    rotate: () => { const w = activeWin(); w.rotated = !w.rotated; closeKeyboard(views.get(w.id)); layout(); saveWindows().catch((e) => toast(e.message)); },
    camera: () => screenshot(),
    alert: () => { const d = deviceOf(activeWin()); toast(`${d.name} · ${d.width}×${d.height} · DPR ${d.dpr}`); },
    share: async () => {
      try { await navigator.clipboard.writeText(state.frameUrl); toast('Endereço copiado'); }
      catch { toast(state.frameUrl); }
    },
    help: () => toast('Clique no ícone da extensão para ligar/desligar o simulador'),
    video: (btn) => toggleRecord(btn),
    panels: () => toast('Mais modos em breve'),
  };

  body.addEventListener('click', (event) => {
    const toolBtn = event.target.closest('.ps-tool');
    if (toolBtn) return tools[toolBtn.dataset.tool]?.(toolBtn);

    if (event.target.closest('[data-vis-add]')) return addWindow();

    const visItem = event.target.closest('[data-vis-id]');
    if (visItem) { setActive(Number(visItem.dataset.visId)); return; }

    const deviceOpt = event.target.closest('[data-device]');
    if (deviceOpt) return selectDevice(deviceOpt.dataset.device);

    const zoomOpt = event.target.closest('[data-zoom]');
    if (zoomOpt) return setZoom(zoomOpt.dataset.zoom);

    const navBtn = event.target.closest('[data-nav]');
    if (navBtn) {
      if (navBtn.dataset.nav === 'back') history.back();
      else if (navBtn.dataset.nav === 'forward') history.forward();
      else state.windows.forEach((w) => loadFrame(w));
      return;
    }

    if (!event.target.closest('.ps-pop') && !event.target.closest('.ps-rail') && !event.target.closest('.ps-window')) closePops();
  });

  $('.ps-url-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const url = normalizeUrl(urlInput.value);
    if (!url) return toast('Endereço inválido (use http ou https)');
    location.href = url;
  });

  syncInput.addEventListener('change', () => {
    state.syncScroll = syncInput.checked;
    saveView({ syncScroll: state.syncScroll });
  });

  keyboardToggle.addEventListener('change', () => {
    state.keyboard = keyboardToggle.checked;
    if (!state.keyboard) for (const v of views.values()) closeKeyboard(v);
    saveView({ keyboard: state.keyboard });
  });

  recAudioInput.addEventListener('change', () => {
    state.recordAudio = recAudioInput.checked;
  });

  window.addEventListener('resize', layout);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePops(); });

  // ---------- start ----------
  for (const win of state.windows) createView(win);
  tick();
  layout();
  for (const win of state.windows) loadFrame(win, state.frameUrl);
})();
