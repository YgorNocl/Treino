// Folhas que sobem de baixo (Estatísticas, detalhe do dia): arrastar para baixo
// fecha, como a barrinha no topo sugere — antes ela era só enfeite.
//
// Só arrasta com a folha no topo da rolagem; puxar para cima continua rolando
// normalmente. Lista rolável dentro da folha (ex.: seletor de exercício) rola
// primeiro.

const CLOSE_DISTANCE = 90;   // px arrastados para fechar
const FLICK_MS = 250;        // arrasto curto e rápido também fecha

function innerScrolled(target, sheet) {
  for (let el = target; el && el !== sheet; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

export function enableSheetDrag(sheet, close) {
  let startY = null;
  let dy = 0;
  let dragging = false;
  let startAt = 0;

  const settle = (transform, after) => {
    sheet.style.transition = 'transform 0.2s ease';
    sheet.style.transform = transform;
    setTimeout(after, 200);
  };
  const reset = () => {
    sheet.style.transition = '';
    sheet.style.transform = '';
  };

  sheet.addEventListener('touchstart', (e) => {
    startY = null;
    if (e.touches.length !== 1 || sheet.scrollTop > 0 || innerScrolled(e.target, sheet)) return;
    startY = e.touches[0].clientY;
    startAt = Date.now();
    dy = 0;
    dragging = false;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dy = e.touches[0].clientY - startY;
    if (!dragging) {
      if (dy < -6) { startY = null; return; } // para cima: rolagem normal
      if (dy < 8) return;
      dragging = true;
      sheet.style.transition = 'none';
    }
    e.preventDefault();
    sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }, { passive: false });

  const end = () => {
    if (startY === null) return;
    startY = null;
    if (!dragging) return;
    dragging = false;
    const flick = dy > 40 && Date.now() - startAt < FLICK_MS;
    if (dy > CLOSE_DISTANCE || flick) {
      settle('translateY(100%)', () => {
        close();
        setTimeout(reset, 400);
      });
    } else {
      settle('', reset);
    }
  };
  sheet.addEventListener('touchend', end);
  sheet.addEventListener('touchcancel', end);
}
