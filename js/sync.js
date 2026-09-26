import { syncToCloud } from './data.js';

// Cada série registrada pede um backup; em vez de subir tudo a cada toque,
// espera um pouco e manda uma vez só. Os envios saem em fila, na ordem.
const SYNC_DELAY_MS = 2000;
let syncTimer = null;
let syncChain = Promise.resolve();

function runSync() {
  syncTimer = null;
  updateSyncStatus('syncing');
  syncChain = syncChain
    .then(() => syncToCloud())
    .then(() => updateSyncStatus('success'))
    .catch(e => { console.warn("Sincronização em nuvem offline:", e); updateSyncStatus('error'); });
  return syncChain;
}

export function trySync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, SYNC_DELAY_MS);
}

// Envia na hora (botão "Fazer Backup Agora" ou app indo para segundo plano).
export function syncNow() {
  clearTimeout(syncTimer);
  return runSync();
}

export function cancelPendingSync() {
  clearTimeout(syncTimer);
  syncTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && syncTimer) syncNow();
});

export function updateSyncStatus(state) {
  const dot = document.getElementById('syncStatusDot');
  const text = document.getElementById('syncStatusText');
  if (!dot || !text) return;
  if (state === 'syncing') {
    dot.style.background = 'var(--warning)';
    text.innerText = 'Salvando backup...';
  } else if (state === 'success') {
    dot.style.background = 'var(--success)';
    const ts = Number(localStorage.getItem('lastSyncAt'));
    text.innerText = ts ? `Backup salvo às ${new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Backup salvo';
  } else if (state === 'error') {
    dot.style.background = 'var(--danger)';
    text.innerText = 'Sem conexão — tentaremos de novo automaticamente';
  } else {
    const ts = Number(localStorage.getItem('lastSyncAt'));
    if (ts) {
      dot.style.background = 'var(--success)';
      text.innerText = `Último backup: ${new Date(ts).toLocaleDateString('pt-BR')} às ${new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      dot.style.background = 'var(--text-faint)';
      text.innerText = 'Nenhum backup feito ainda';
    }
  }
}
