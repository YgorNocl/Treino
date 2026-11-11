// Versão nova chegando com o app aberto. O celular mantém o app na memória por
// dias, e antes a versão nova só entrava quando ele era fechado de vez.
//
// 1. Ao voltar para o app (no máximo a cada 30 min), pergunta ao servidor se
//    há versão nova.
// 2. Quando o Service Worker novo assume, o app recarrega na próxima vez que
//    sair da tela — nunca na sua frente, e nunca com descanso ou cronômetro
//    contando ou com algo digitado e não salvo.

const CHECK_EVERY_MS = 30 * 60 * 1000;

// Pode recarregar sem perder nada?
export function isSafeToReload(doc = document) {
  if (doc.querySelector('.rest-overlay.visible')) return false;
  if (doc.querySelector('.cali-timer[data-phase="prep"], .cali-timer[data-phase="run"], .cali-mobility-target[data-phase="prep"], .cali-mobility-target[data-phase="run"], .exercise-card[data-counting]')) return false;
  // Campos de telas fechadas não contam (ex.: o nome digitado num "Novo treino"
  // já criado continua no campo escondido da janela).
  const closed = '.full-modal:not(.visible), .info-modal:not(.visible), .stats-sheet:not(.visible), .day-detail-modal:not(.visible), .cali-overlay:not(.visible)';
  return ![...doc.querySelectorAll('input, textarea')].some(el =>
    el.type !== 'file' && el.type !== 'hidden' && el.type !== 'checkbox' && !el.closest(closed) && el.value !== el.defaultValue);
}

export function initAutoUpdate() {
  if (!('serviceWorker' in navigator)) return;
  // Na primeira instalação o SW também "assume" a página; isso não é versão nova.
  const hadController = !!navigator.serviceWorker.controller;
  let updateReady = false;
  let lastCheck = Date.now();

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) updateReady = true;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (updateReady && isSafeToReload()) location.reload();
      return;
    }
    if (Date.now() - lastCheck < CHECK_EVERY_MS) return;
    lastCheck = Date.now();
    navigator.serviceWorker.getRegistration()
      .then(reg => reg && reg.update())
      .catch(() => { /* sem internet: tenta na próxima volta */ });
  });
}
