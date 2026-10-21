// UI do simulador. Injetada no frame de cima da aba (mundo isolado) pelo background.
// Substitui o conteúdo da página por um aparelho centralizado (moldura + status bar iOS)
// com o site num iframe do mesmo domínio, e uma barra de ferramentas circular à direita.
(async () => {
  if (window.__phonesimMounted || !(document instanceof HTMLDocument)) return;
  window.__phonesimMounted = true;

  // Para de baixar o resto da página original; ela só serve de casca.
  window.stop();

  const { devices, findDevice, defaultDeviceId, userAgentFor } = globalThis.PHONESIM;

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

  // silhueta de telefone/tablet dos cards do catálogo
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

  // Visual de aparelho único: trabalhamos sempre com o 1º aparelho da lista.
  const state = {
    windows: [{ id: 1, deviceId: defaultDeviceId, rotated: false }],
    zoom: 'fit',
    syncScroll: true,
    keyboard: true,
    frameUrl: location.href,
  };
  Object.assign(state, await send({ type: 'phonesim:get-state' }));
  const win = state.windows[0];

  const deviceOf = () => findDevice(win.deviceId) ?? findDevice(defaultDeviceId);

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
    <main class="ps-stage">
      <div class="ps-scaler">
        <div class="ps-device">
          <div class="ps-screen">
            <div class="ps-status"><span class="ps-clock"></span><span class="ps-status-right">${STATUS_ICONS}</span></div>
            <div class="ps-keyboard"></div>
          </div>
          <img class="ps-frame" alt="" />
        </div>
      </div>
    </main>

    <nav class="ps-rail">
      ${railTool('close', 'Sair do simulador')}
      ${railTool('devices', 'Trocar aparelho')}
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
        <button class="ps-row-btn" data-nav="reload" title="Recarregar">${icon('reload')}</button>
      </div>
      <h3>Opções</h3>
      <label class="ps-check"><input type="checkbox" class="ps-sync"><span>Sincronizar interações<small>Rolagem, cliques e digitação</small></span></label>
      <label class="ps-check"><input type="checkbox" class="ps-keyboard-toggle"><span>Teclado virtual<small>Aparece ao tocar num campo</small></span></label>
    </div>

    <div class="ps-toast" role="status" aria-live="polite"></div>`;
  root.replaceChildren(head, body);

  const $ = (sel) => body.querySelector(sel);
  const scalerEl = $('.ps-scaler');
  const deviceEl = $('.ps-device');
  const screenEl = $('.ps-screen');
  const frameImg = $('.ps-frame');
  const keyboardEl = $('.ps-keyboard');
  const assetUrl = (p) => chrome.runtime.getURL(p);
  const setFrameSrc = (d) => { frameImg.src = assetUrl(`assets/devices/${d.id}/device.png`); };
  const clockEl = $('.ps-clock');
  const toastEl = $('.ps-toast');
  const urlInput = $('.ps-url');
  const syncInput = $('.ps-sync');
  const keyboardToggle = $('.ps-keyboard-toggle');
  const devicesList = $('.ps-devices-list');

  syncInput.checked = state.syncScroll;
  keyboardToggle.checked = state.keyboard;
  urlInput.value = state.frameUrl;

  // estado do teclado virtual desta tela
  const kb = { open: false, layout: 'text', mode: 'letters', shift: false, hideTimer: null };
  let frame = null;      // iframe do site
  let frameUrl = null;   // último endereço pedido ao iframe
  let syncing = false;   // true enquanto um carregamento pedido pela UI está em curso

  // ---------- relógio da status bar ----------
  function tick() {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  tick();
  setInterval(tick, 15000);

  // ---------- painel de aparelhos ----------
  const visRow = $('.ps-vis-row');

  function buildDeviceList() {
    // linha "dispositivos visíveis na aba": o aparelho atual (selecionado) + adicionar
    const current = deviceOf();
    visRow.replaceChildren();
    const item = document.createElement('div');
    item.className = 'ps-vis-item';
    item.title = current.name;
    item.innerHTML = `<img src="${assetUrl(`assets/devices/${current.id}/terminal-mini.png`)}" alt="">`;
    const add = document.createElement('button');
    add.className = 'ps-vis-add';
    add.dataset.visAdd = '';
    add.title = 'Adicionar aparelho';
    add.innerHTML = `${plusGlyph}<span class="ps-badge">NEW</span>`;
    visRow.append(item, add);

    // grade do catálogo, por categoria
    devicesList.replaceChildren();
    let currentGroup = null;
    let grid = null;
    for (const d of devices) {
      if (d.group !== currentGroup) {
        currentGroup = d.group;
        const meta = GROUP_META[d.group] ?? { label: d.group, icon: '' };
        const head = document.createElement('div');
        head.className = 'ps-dgroup-head';
        head.innerHTML = `${meta.icon}<span>${meta.label}</span>`;
        devicesList.append(head);
        grid = document.createElement('div');
        grid.className = 'ps-dgrid';
        devicesList.append(grid);
      }
      const card = document.createElement('button');
      card.className = 'ps-dcard';
      card.dataset.device = d.id;
      card.dataset.on = String(d.id === win.deviceId);
      card.title = `${d.name} · ${d.width}×${d.height}`;
      card.innerHTML = `<img class="ps-dcard-ico" src="${assetUrl(`assets/devices/${d.id}/terminal-mini.png`)}" alt=""><span class="ps-dcard-name">${d.name}</span>`;
      grid.append(card);
    }
  }

  // ---------- iframe ----------
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
  function loadFrame(url = frameUrl ?? state.frameUrl) {
    closeKeyboard();
    frame?.remove();
    const el = document.createElement('iframe');
    el.name = `phonesim:${btoa(JSON.stringify(spoofConfig(deviceOf())))}`;
    el.setAttribute('sandbox', SANDBOX);
    el.allow = ALLOW;
    el.src = url;
    screenEl.prepend(el);
    frame = el;
    frameUrl = url;
    syncing = true;
  }

  // ---------- geometria e escala ----------
  // Moldura real (device.png): caixa fw×fh; tela no offset (left,top) com tamanho width×height;
  // o recorte da tela (cantos + ilha/notch) vem do path SVG do catálogo.
  // No modo paisagem, gira a moldura 90° e troca os offsets de acordo.
  function geometry() {
    const d = deviceOf();
    const land = win.rotated && d.rotate && d.pathL;
    if (!land) {
      return { d, land: false, w: d.width, h: d.height, left: d.left, top: d.top, fw: d.fw, fh: d.fh, clip: d.path };
    }
    // 90° horário: novo offset = (fh - top - h, left); caixa vira fh×fw.
    return {
      d, land: true,
      w: d.height, h: d.width,
      left: d.fh - d.top - d.height,
      top: d.left,
      fw: d.fh, fh: d.fw,
      clip: d.pathL,
    };
  }

  function layout() {
    const { d, land, w, h, left, top, fw, fh, clip } = geometry();
    deviceEl.dataset.kind = d.kind; // status bar some nos tablets

    // caixa da moldura
    deviceEl.style.width = `${fw}px`;
    deviceEl.style.height = `${fh}px`;

    // moldura PNG: em paisagem, gira a imagem (tamanho natural fw0×fh0 = fh×fw da caixa)
    if (land) {
      frameImg.style.width = `${fh}px`;
      frameImg.style.height = `${fw}px`;
      frameImg.style.inset = 'auto';
      frameImg.style.left = '50%';
      frameImg.style.top = '50%';
      frameImg.style.transform = 'translate(-50%, -50%) rotate(90deg)';
    } else {
      frameImg.style.cssText = '';
    }

    // tela encaixada no recorte, com clip (cantos + ilha/notch)
    screenEl.style.left = `${left}px`;
    screenEl.style.top = `${top}px`;
    screenEl.style.width = `${w}px`;
    screenEl.style.height = `${h}px`;
    screenEl.style.clipPath = clip ? `path(evenodd, '${clip}')` : '';

    let scale = Number(state.zoom) / 100;
    if (state.zoom === 'fit') {
      // Usa o tamanho da janela (a .ps-stage encolhe até o conteúdo); 150px reserva a barra à direita.
      scale = Math.max(0.2, Math.min(1, (window.innerHeight - 40) / fh, (window.innerWidth - 150) / fw));
    }
    // O transform encolhe só visualmente; dimensiona o scaler com o tamanho já escalado
    // para a caixa de layout caber na tela (senão o aparelho estoura e corta).
    deviceEl.style.transform = `scale(${scale})`;
    scalerEl.style.width = `${fw * scale}px`;
    scalerEl.style.height = `${fh * scale}px`;

    const kbH = keyboardHeight(d, w, h, land);
    keyboardEl.style.height = `${kbH}px`;
    keyboardEl.style.fontSize = `${Math.round(Math.min(w, 500) / 18)}px`;
    if (frame) frame.style.height = kb.open ? `${h - kbH}px` : '';
  }

  // ---------- teclado virtual ----------
  function keyboardHeight(d, w, h, rotated) {
    if (d.kind === 'tablet') return Math.round(w * (rotated ? 0.3 : 0.42));
    if (rotated) return Math.round(h * 0.55);
    return Math.round(w * 0.66) + 34; // + faixa do indicador de início / barra de navegação
  }

  const SPECIAL_KEYS = ['shift', 'backspace', 'enter', 'mode', 'space'];

  function keyboardRows(os) {
    if (kb.layout === 'numeric') return [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], [',', '0', 'backspace']];
    const bottom = os === 'ios' ? ['mode', 'space', 'enter'] : ['mode', ',', 'space', '.', 'enter'];
    if (kb.mode === 'symbols') {
      return [[...'1234567890'], [...'-/:;()$&@"'], ['.', ',', '?', '!', "'", 'backspace'], bottom];
    }
    const letters = (chars) => [...chars].map((c) => (kb.shift ? c.toUpperCase() : c));
    return [letters('qwertyuiop'), letters('asdfghjkl'), ['shift', ...letters('zxcvbnm'), 'backspace'], bottom];
  }

  function keyLabel(key, os) {
    if (key === 'mode') return kb.mode === 'symbols' ? 'ABC' : os === 'ios' ? '123' : '?123';
    if (key === 'space') return os === 'ios' ? 'espaço' : '';
    return { shift: '⇧', backspace: '⌫', enter: '↵' }[key] ?? key;
  }

  function renderKeyboard() {
    const os = deviceOf().os;
    keyboardEl.dataset.os = os;
    keyboardEl.dataset.layout = kb.layout;
    keyboardEl.replaceChildren(
      ...keyboardRows(os).map((row) => {
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
          button.textContent = keyLabel(key, os);
          rowEl.append(button);
        }
        return rowEl;
      }),
    );
  }

  function openKeyboard(layoutName) {
    clearTimeout(kb.hideTimer);
    if (!state.keyboard) return;
    if (!kb.open || kb.layout !== layoutName) Object.assign(kb, { layout: layoutName, mode: 'letters', shift: false });
    kb.open = true;
    renderKeyboard();
    layout(); // reserva o espaço do teclado (o site encolhe); o teclado sobe deslizando nele
    // próximo frame: garante que o estado "fechado" (translateY 100%) foi aplicado antes de animar.
    requestAnimationFrame(() => { if (kb.open) keyboardEl.classList.add('ps-kb-open'); });
  }

  function closeKeyboard() {
    clearTimeout(kb.hideTimer);
    if (!kb.open) return;
    kb.open = false;
    keyboardEl.classList.remove('ps-kb-open'); // desce deslizando
    layout();
  }

  const scheduleCloseKeyboard = () => {
    clearTimeout(kb.hideTimer);
    kb.hideTimer = setTimeout(closeKeyboard, 120);
  };

  function pressKey(key) {
    if (key === 'shift') kb.shift = !kb.shift;
    else if (key === 'mode') kb.mode = kb.mode === 'symbols' ? 'letters' : 'symbols';
    else {
      const typed = key === 'space' ? ' ' : key;
      frame?.contentWindow?.postMessage({ type: 'phonesim:apply', event: { kind: 'type', key: typed } }, '*');
      if (!kb.shift || typed.length !== 1) return;
      kb.shift = false;
    }
    renderKeyboard();
  }

  // mousedown cancelado: o campo dentro do iframe continua com o foco ao tocar nas teclas.
  screenEl.addEventListener('mousedown', (event) => {
    if (event.target.closest('.ps-keyboard')) event.preventDefault();
  });
  screenEl.addEventListener('click', (event) => {
    const keyEl = event.target.closest('.ps-key');
    if (keyEl) pressKey(keyEl.dataset.key);
  });

  // ---------- ponte com o iframe (spoof.js) ----------
  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.type === 'phonesim:location') onFrameLocation(data);
    else if (data?.type === 'phonesim:keyboard') {
      if (data.open) openKeyboard(data.layout === 'numeric' ? 'numeric' : 'text');
      else scheduleCloseKeyboard();
    }
    // phonesim:sync não é repassado: só há um aparelho neste visual.
  });

  function onFrameLocation({ url }) {
    frameUrl = url;
    state.frameUrl = url;
    closeKeyboard();
    if (document.activeElement !== urlInput) urlInput.value = url;
    syncing = false;
  }

  // ---------- persistência ----------
  const saveWindows = () => send({ type: 'phonesim:set-windows', windows: state.windows });
  const saveView = (patch) => send({ type: 'phonesim:set-view', ...patch }).catch(() => {});

  // ---------- toast ----------
  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('ps-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('ps-visible'), 2600);
  }

  // ---------- captura de tela ----------
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('imagem inválida'));
      img.src = src;
    });

  async function screenshot() {
    deviceEl.classList.add('ps-capturing');
    await nextFrame();
    await nextFrame();
    try {
      const { dataUrl } = await send({ type: 'phonesim:capture' });
      const img = await loadImage(dataUrl);
      const rect = screenEl.getBoundingClientRect();
      const ratio = img.naturalWidth / window.innerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      canvas
        .getContext('2d')
        .drawImage(img, rect.left * ratio, rect.top * ratio, rect.width * ratio, rect.height * ratio, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${deviceOf().id}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      link.click();
      toast('Captura salva');
    } catch (error) {
      toast(`Falha na captura: ${error.message}`);
    } finally {
      deviceEl.classList.remove('ps-capturing');
    }
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
    // preenche o conteúdo ANTES de medir a altura (senão o painel é medido vazio)
    if (name === 'devices') buildDeviceList();
    if (name === 'zoom') for (const opt of el.querySelectorAll('[data-zoom]')) opt.dataset.on = String(opt.dataset.zoom === String(state.zoom));
    // trava a altura na janela e alinha com o botão, sem passar das bordas (scroll interno cuida do resto)
    const rect = anchorBtn.getBoundingClientRect();
    const maxH = window.innerHeight - 24;
    el.style.maxHeight = `${maxH}px`;
    const height = Math.min(el.offsetHeight, maxH);
    el.style.top = `${Math.max(12, Math.min(rect.top, window.innerHeight - height - 12))}px`;
  }

  function selectDevice(id) {
    if (!findDevice(id) || id === win.deviceId) return closePops();
    win.deviceId = id;
    setFrameSrc(deviceOf());
    layout();
    loadFrame();
    saveWindows().catch((error) => toast(error.message));
    closePops();
  }

  function setZoom(value) {
    state.zoom = value;
    layout();
    saveView({ zoom: value });
    closePops();
  }

  // ---------- ações da barra ----------
  const tools = {
    close: () => send({ type: 'phonesim:exit' }).catch((e) => toast(e.message)),
    devices: (btn) => togglePop('devices', btn),
    zoom: (btn) => togglePop('zoom', btn),
    settings: (btn) => togglePop('settings', btn),
    rotate: () => { win.rotated = !win.rotated; closeKeyboard(); layout(); saveWindows().catch((e) => toast(e.message)); },
    camera: () => screenshot(),
    alert: () => { const d = deviceOf(); toast(`${d.name} · ${d.width}×${d.height} · DPR ${d.dpr}`); },
    share: async () => {
      try { await navigator.clipboard.writeText(frameUrl ?? state.frameUrl); toast('Endereço copiado'); }
      catch { toast(frameUrl ?? state.frameUrl); }
    },
    help: () => toast('Clique no ícone da extensão para ligar/desligar o simulador'),
    video: () => toast('Gravação de tela não está disponível nesta versão'),
    panels: () => toast('Mais modos em breve'),
  };

  body.addEventListener('click', (event) => {
    const toolBtn = event.target.closest('.ps-tool');
    if (toolBtn) return tools[toolBtn.dataset.tool]?.(toolBtn);

    if (event.target.closest('[data-vis-add]')) return toast('Vários aparelhos lado a lado em breve');

    const deviceOpt = event.target.closest('[data-device]');
    if (deviceOpt) return selectDevice(deviceOpt.dataset.device);

    const zoomOpt = event.target.closest('[data-zoom]');
    if (zoomOpt) return setZoom(zoomOpt.dataset.zoom);

    const navBtn = event.target.closest('[data-nav]');
    if (navBtn) {
      if (navBtn.dataset.nav === 'back') history.back();
      else if (navBtn.dataset.nav === 'forward') history.forward();
      else loadFrame();
      return;
    }

    // clique fora dos popovers e da barra fecha os popovers
    if (!event.target.closest('.ps-pop') && !event.target.closest('.ps-rail')) closePops();
  });

  $('.ps-url-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const url = normalizeUrl(urlInput.value);
    if (!url) return toast('Endereço inválido (use http ou https)');
    // Navega a aba inteira: o simulador remonta na nova página, mantendo cookies de primeira parte.
    location.href = url;
  });

  syncInput.addEventListener('change', () => {
    state.syncScroll = syncInput.checked;
    saveView({ syncScroll: state.syncScroll });
  });

  keyboardToggle.addEventListener('change', () => {
    state.keyboard = keyboardToggle.checked;
    if (!state.keyboard) closeKeyboard();
    saveView({ keyboard: state.keyboard });
  });

  window.addEventListener('resize', layout);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePops(); });

  // ---------- start ----------
  setFrameSrc(deviceOf());
  layout();
  loadFrame(state.frameUrl);
})();
