// Roda no mundo MAIN de todo frame, antes dos scripts da página.
// Só age no iframe do simulador, identificado pelo window.name ("phonesim:<config base64>").
// O nome do iframe sobrevive a navegações dentro dele, então a config vale para todas as páginas.
(() => {
  const PREFIX = 'phonesim:';
  let config;
  try {
    if (!window.name.startsWith(PREFIX)) return;
    config = JSON.parse(atob(window.name.slice(PREFIX.length)));
  } catch {
    return;
  }

  const define = (target, prop, get) => {
    try {
      Object.defineProperty(target, prop, { get, configurable: true });
    } catch {
      // propriedade já travada por outra injeção
    }
  };

  // ---------- navigator ----------
  const isAndroid = config.os === 'android';
  const realUaData = navigator.userAgentData;
  const brands = realUaData ? realUaData.brands : [];

  const fakeUaData = isAndroid
    ? {
        brands,
        mobile: config.kind !== 'tablet',
        platform: 'Android',
        async getHighEntropyValues() {
          const real = realUaData ? await realUaData.getHighEntropyValues(['fullVersionList', 'uaFullVersion']) : {};
          return {
            ...real,
            brands,
            mobile: config.kind !== 'tablet',
            platform: 'Android',
            platformVersion: '10.0.0',
            model: 'K',
            architecture: '',
            bitness: '',
            wow64: false,
            formFactors: [config.kind === 'tablet' ? 'Tablet' : 'Mobile'],
          };
        },
        toJSON() {
          return { brands, mobile: config.kind !== 'tablet', platform: 'Android' };
        },
      }
    : undefined; // Safari não tem userAgentData

  define(navigator, 'userAgent', () => config.ua);
  define(navigator, 'appVersion', () => config.ua.replace(/^Mozilla\//, ''));
  define(navigator, 'platform', () => config.platform);
  define(navigator, 'vendor', () => config.vendor);
  define(navigator, 'maxTouchPoints', () => 5);
  define(navigator, 'userAgentData', () => fakeUaData);

  // ---------- tela ----------
  const longSide = Math.max(config.width, config.height);
  const shortSide = Math.min(config.width, config.height);
  // Pela largura: o teclado virtual encolhe a altura, mas não deve "virar" o aparelho.
  const isLandscape = () => window.innerWidth > shortSide;

  for (const prop of ['width', 'availWidth']) define(screen, prop, () => (isLandscape() ? longSide : shortSide));
  for (const prop of ['height', 'availHeight']) define(screen, prop, () => (isLandscape() ? shortSide : longSide));
  define(window, 'devicePixelRatio', () => config.dpr);
  define(window, 'outerWidth', () => window.innerWidth);
  define(window, 'outerHeight', () => window.innerHeight);
  define(window, 'frameElement', () => null);

  // ---------- media queries de ponteiro (só via JS; o CSS do site continua vendo mouse) ----------
  const ALWAYS = '(min-width: 0px)';
  const NEVER = '(max-width: 0px)';
  const POINTER_QUERIES = [
    [/\(\s*(any-)?pointer\s*:\s*coarse\s*\)/gi, ALWAYS],
    [/\(\s*(any-)?pointer\s*:\s*fine\s*\)/gi, NEVER],
    [/\(\s*(any-)?hover\s*:\s*none\s*\)/gi, ALWAYS],
    [/\(\s*(any-)?hover\s*:\s*hover\s*\)/gi, NEVER],
  ];
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) =>
    nativeMatchMedia(POINTER_QUERIES.reduce((q, [pattern, replacement]) => q.replace(pattern, replacement), String(query)));

  // ---------- ponte com a UI do simulador (vários aparelhos) ----------
  // Avisa o simulador quando o endereço muda ou o usuário interage (rolagem, clique, digitação),
  // e repete aqui as interações feitas nos outros aparelhos.
  // Só eventos isTrusted (do usuário) são repassados; os repetidos são sintéticos, então não ecoam.
  const simulatorWindow = window.parent;
  const post = (message) => simulatorWindow.postMessage(message, '*');
  const share = (event) => post({ type: 'phonesim:sync', event });

  // sync: false em replaceState, que só ajusta a URL sem ser uma navegação do usuário.
  const reportLocation = (sync = true) => post({ type: 'phonesim:location', url: location.href, sync });
  reportLocation();
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      reportLocation(method === 'pushState');
      return result;
    };
  }
  window.addEventListener('popstate', () => reportLocation());
  window.addEventListener('hashchange', () => reportLocation());

  // Rolagem como proporção (0..1), porque cada aparelho tem altura de página diferente.
  const scroller = () => document.scrollingElement || document.documentElement;
  let applyingRemoteScroll = false;
  let scrollQueued = false;

  window.addEventListener(
    'scroll',
    () => {
      if (applyingRemoteScroll || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        const el = scroller();
        const maxX = el.scrollWidth - window.innerWidth;
        const maxY = el.scrollHeight - window.innerHeight;
        share({ kind: 'scroll', x: maxX > 0 ? window.scrollX / maxX : 0, y: maxY > 0 ? window.scrollY / maxY : 0 });
      });
    },
    { passive: true },
  );

  // Caminho CSS para achar "o mesmo" elemento nos outros aparelhos.
  // Se o site monta um HTML diferente por tamanho de tela, o caminho pode não existir lá: aí nada acontece.
  function selectorFor(el) {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      let index = 1;
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.localName === node.localName) index++;
      }
      parts.unshift(`${node.localName}:nth-of-type(${index})`);
    }
    return parts.join(' > ');
  }

  // Links e botões de envio não são repetidos: a troca de página já é sincronizada,
  // e repetir um envio de formulário mandaria os dados duas vezes.
  function leavesPage(el) {
    const link = el.closest('a[href]');
    if (link) {
      const href = link.getAttribute('href').trim();
      if (!href.startsWith('#') && !/^javascript:/i.test(href)) return true;
    }
    const button = el.closest('button, input[type="submit"], input[type="image"]');
    return Boolean(button?.form && (button.type === 'submit' || button.type === 'image'));
  }

  const isTextField = (el) =>
    (el instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'password'].includes(el.type)) ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement;

  // Clique num <label> gera um segundo clique no campo ligado a ele; só o primeiro é repassado.
  let labelControl = null;

  window.addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      const target = event.target;
      if (labelControl && target === labelControl) {
        labelControl = null;
        return;
      }
      const label = target.closest('label');
      if (label?.control && label.control !== target) {
        labelControl = label.control;
        setTimeout(() => (labelControl = null));
      }
      if (!leavesPage(target)) share({ kind: 'click', selector: selectorFor(target) });
    },
    true,
  );

  window.addEventListener(
    'input',
    (event) => {
      if (event.isTrusted && isTextField(event.target)) {
        share({ kind: 'input', selector: selectorFor(event.target), value: event.target.value });
      }
    },
    true,
  );

  window.addEventListener(
    'change',
    (event) => {
      if (event.isTrusted && isTextField(event.target)) share({ kind: 'change', selector: selectorFor(event.target) });
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (event) => {
      // Esc fecha modais e menus; outras teclas já chegam como digitação nos campos.
      if (event.isTrusted && event.key === 'Escape') share({ kind: 'key', key: 'Escape', code: 'Escape', keyCode: 27 });
    },
    true,
  );

  // Usa o setter do protótipo para frameworks como React perceberem a mudança de valor.
  function setFieldValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function replayClick(el) {
    const rect = el.getBoundingClientRect();
    const position = { bubbles: true, cancelable: true, composed: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    // Sequência completa: há sites que reagem no pointerdown/mousedown, não no click.
    el.dispatchEvent(new PointerEvent('pointerdown', { ...position, pointerType: 'touch', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mousedown', position));
    el.dispatchEvent(new PointerEvent('pointerup', { ...position, pointerType: 'touch', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mouseup', position));
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', position));
  }

  const applyRemote = {
    scroll({ x, y }) {
      const el = scroller();
      applyingRemoteScroll = true;
      window.scrollTo({
        left: x * (el.scrollWidth - window.innerWidth),
        top: y * (el.scrollHeight - window.innerHeight),
        behavior: 'instant', // ignora scroll-behavior: smooth do site, que geraria eco
      });
      // O evento de scroll do scrollTo chega no próximo frame; só então volta a repassar.
      requestAnimationFrame(() => requestAnimationFrame(() => (applyingRemoteScroll = false)));
    },
    click({ selector }) {
      const el = document.querySelector(selector);
      if (el) replayClick(el);
    },
    input({ selector, value }) {
      const el = document.querySelector(selector);
      if (el && isTextField(el)) setFieldValue(el, value);
    },
    change({ selector }) {
      document.querySelector(selector)?.dispatchEvent(new Event('change', { bubbles: true }));
    },
    key({ key, code, keyCode }) {
      dispatchKey(document.activeElement || document.body, key, code, keyCode);
    },
    // Tecla do teclado virtual. execCommand gera eventos de input como digitação real,
    // então a sincronização com os outros aparelhos funciona igual.
    type({ key }) {
      const el = document.activeElement;
      if (!el || !wantsKeyboard(el)) return;
      if (key === 'backspace') {
        document.execCommand('delete');
      } else if (key === 'enter') {
        if (el instanceof HTMLTextAreaElement || el.isContentEditable) {
          document.execCommand('insertText', false, '\n');
        } else {
          const notCanceled = dispatchKey(el, 'Enter', 'Enter', 13);
          if (notCanceled && el.form) el.form.requestSubmit();
        }
      } else {
        document.execCommand('insertText', false, key);
      }
    },
  };

  function dispatchKey(target, key, code, keyCode) {
    const init = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true };
    const notCanceled = target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));
    return notCanceled;
  }

  // ---------- teclado virtual ----------
  // Avisa a UI quando um campo que abriria o teclado do celular ganha ou perde o foco.
  const NO_KEYBOARD_TYPES = [
    'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'range', 'color', 'hidden',
    'date', 'time', 'datetime-local', 'month', 'week',
  ];
  function wantsKeyboard(el) {
    if (el.isContentEditable) return true;
    const field = el instanceof HTMLInputElement ? !NO_KEYBOARD_TYPES.includes(el.type) : el instanceof HTMLTextAreaElement;
    return field && !el.readOnly && !el.disabled;
  }
  const keyboardLayout = (el) =>
    ['numeric', 'decimal', 'tel'].includes(el.inputMode) || ['number', 'tel'].includes(el.type) ? 'numeric' : 'text';

  window.addEventListener(
    'focusin',
    (event) => {
      if (event.target instanceof Element && wantsKeyboard(event.target)) {
        post({ type: 'phonesim:keyboard', open: true, layout: keyboardLayout(event.target) });
      }
    },
    true,
  );
  window.addEventListener(
    'focusout',
    (event) => {
      if (event.target instanceof Element && wantsKeyboard(event.target)) post({ type: 'phonesim:keyboard', open: false });
    },
    true,
  );
  // Quando o teclado encolhe a tela, mantém o campo focado visível (como o celular faz).
  window.addEventListener('resize', () => {
    const el = document.activeElement;
    if (el instanceof Element && wantsKeyboard(el)) el.scrollIntoView({ block: 'nearest' });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== simulatorWindow || event.data?.type !== 'phonesim:apply') return;
    try {
      applyRemote[event.data.event?.kind]?.(event.data.event);
    } catch {
      // seletor inválido ou elemento diferente neste aparelho: ignora
    }
  });

  // ---------- cursor de "dedo" ----------
  const cursorSvg =
    "%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='14' cy='14' r='11' fill='rgba(40,40,40,0.35)' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E";
  const style = document.createElement('style');
  style.textContent = `html, html * { cursor: url("data:image/svg+xml,${cursorSvg}") 14 14, auto !important; }`;
  (document.head || document.documentElement).append(style);
})();
