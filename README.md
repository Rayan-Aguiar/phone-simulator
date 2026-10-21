# Phone Simulator

Extensão Chrome (MV3) que mostra qualquer site dentro de um aparelho simulado: iPhone, Android e tablets.

## Instalar

1. Abra `chrome://extensions` e ative o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha esta pasta
   (no Windows: `\\wsl.localhost\Ubuntu\home\rayan\project\Pessoal\phone-simulator`).
3. Fixe o ícone. Em qualquer página http/https, clique nele para ligar ou desligar o simulador.

## Como funciona

| Peça | Papel |
| --- | --- |
| `background.js` | Liga e desliga o simulador por aba, cria as regras de rede (`declarativeNetRequest`, só naquela aba) e injeta a UI. |
| Regras de rede | Página de cima: CSP `script-src 'none'` (o site não roda nela; ela vira só a "casca"). Iframe: remove `X-Frame-Options`/CSP. Tudo: troca `User-Agent` e client hints. |
| `sim/ui.js` + `ui.css` | Troca o conteúdo da aba por um aparelho centralizado (moldura de titânio, Dynamic Island e status bar iOS) com o site num iframe do **mesmo domínio**, o que mantém cookies e login funcionando. As funções ficam numa barra de ícones circular à direita. |
| `inject/spoof.js` | Roda antes do site, só no iframe do simulador (identificado pelo `window.name`). Falsifica `navigator.*`, `screen.*`, `devicePixelRatio`, `matchMedia` de ponteiro e `frameElement`. |
| `sim/devices.js` | Catálogo de aparelhos e geração do User-Agent. |

## Barra de ferramentas (à direita)

De cima para baixo: sair, trocar aparelho, detalhes do aparelho, girar, zoom, capturar tela (PNG), gravar, modos.
No rodapé: copiar endereço, ajuda e **Configurações** (engrenagem), que abre o endereço, os botões voltar/avançar/recarregar e as opções "Sincronizar interações" e "Teclado virtual".

## Teclado virtual

Ao focar um campo de texto, aparece um teclado no estilo do sistema (iOS ou Gboard) e o site encolhe para dar lugar a ele, como num celular.
As teclas digitam de verdade, e campos `tel`/`number`/`inputmode="numeric"` abrem o teclado numérico.
Dá para desligar em **Configurações → Teclado virtual**.

## Limitações conhecidas

- Com vários aparelhos, o cabeçalho HTTP `User-Agent` segue o **1º aparelho**, porque as regras de rede do Chrome valem por aba e não por iframe. O JavaScript de cada aparelho vê o seu próprio. A extensão original tem a mesma limitação.
- Se o site monta um HTML diferente em cada tamanho de tela, o caminho CSS pode não existir nos outros aparelhos. Nesse caso, aquele clique ou digitação não é repetido.
- Editores de texto rico (`contenteditable`) e rolagem dentro de áreas internas da página não são sincronizados.

- As media queries **CSS** `pointer`/`hover` continuam vendo mouse; só o `matchMedia` via JS foi ajustado. A largura (`max-width`) funciona normalmente.
- O site renderiza com o DPR real do seu monitor; `devicePixelRatio` é falsificado só para o JS.
- Não há eventos de toque: o mouse continua gerando cliques normais.
- Workers do site ainda veem o User-Agent real no JS (o cabeçalho HTTP é trocado).
- Emulação completa (CSS de toque, DPR real) exigiria a API `chrome.debugger`, que mostra uma faixa de aviso no navegador.
