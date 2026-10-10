// Mantém a tela acesa enquanto houver algum motivo ativo: treino da academia em
// andamento, treino de calistenia/mobilidade em andamento ou cronômetro de
// sustentação rodando. Um só bloqueio para o app todo — antes cada modo tinha o
// seu e um soltava o do outro ao trocar de aba.
//
// O navegador solta o bloqueio sozinho quando o app sai da tela; ao voltar,
// ele é pedido de novo enquanto ainda houver motivo.

const reasons = new Set();
let lock = null;
let pending = false;

function apply() {
  if (!('wakeLock' in navigator)) return;
  if (reasons.size === 0) {
    if (lock) lock.release().catch(() => {});
    lock = null;
    return;
  }
  if (lock || pending || document.visibilityState !== 'visible') return;
  pending = true;
  navigator.wakeLock.request('screen')
    .then(l => {
      lock = l;
      l.addEventListener('release', () => { if (lock === l) lock = null; });
      if (reasons.size === 0) apply();
    })
    .catch(() => {})
    .finally(() => { pending = false; });
}

export function setAwake(reason, on) {
  const had = reasons.has(reason);
  if (on === had && (!on || lock)) return;
  if (on) reasons.add(reason);
  else reasons.delete(reason);
  apply();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') apply();
});
