// Botão "voltar" do celular (Android) fecha a tela aberta — guia, calendário,
// estatísticas, configurações... — em vez de sair do app.
//
// Mantém uma entrada no histórico do navegador para cada tela aberta. As telas
// podem abrir e fechar de várias formas (X, toque fora, Esc, uma fechando e
// outra abrindo no mesmo toque), então em vez de reagir a cada evento o
// histórico é acertado uma vez só, no fim da interação: tantas entradas quanto
// telas abertas.

const OVERLAY_SELECTOR = '.full-modal, .info-modal, .day-detail-modal, .summary-modal, .stats-sheet, .cali-overlay';

const stack = [];      // telas abertas, a última é a do topo
let depth = 0;         // entradas de histórico criadas por nós que ainda existem
let ignorePops = 0;    // popstates causados pelo nosso próprio history.go
let syncScheduled = false;

function isOpen(el) { return el.classList.contains('visible'); }

function close(el) {
  el.classList.remove('visible');
  if (el.id === 'statsSheet') {
    const backdrop = document.getElementById('sheetBackdrop');
    if (backdrop) backdrop.classList.remove('visible');
  }
}

function scheduleSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  setTimeout(() => {
    syncScheduled = false;
    const diff = stack.length - depth;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) history.pushState({ overlay: true }, '');
    } else if (diff < 0) {
      ignorePops += 1;
      history.go(diff);
    }
    depth = stack.length;
  }, 0);
}

function track(el) {
  new MutationObserver(() => {
    const idx = stack.indexOf(el);
    if (isOpen(el) && idx === -1) {
      stack.push(el);
      scheduleSync();
    } else if (!isOpen(el) && idx !== -1) {
      stack.splice(idx, 1);
      scheduleSync();
    }
  }).observe(el, { attributes: true, attributeFilter: ['class'] });
}

export function initBackNav() {
  document.querySelectorAll(OVERLAY_SELECTOR).forEach(track);
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops -= 1; return; }
    // "Voltar" do usuário: consumiu uma das nossas entradas; fecha a tela do topo.
    depth = Math.max(0, depth - 1);
    const top = stack.pop();
    if (top) close(top);
  });
}
