import { syncToCloud } from './data.js';

// Cada série registrada pede um backup; em vez de subir tudo a cada toque,
// espera um pouco e manda uma vez só. Os envios saem em fila, na ordem.
const SYNC_DELAY_MS = 2000;
// Há mudança que ainda não chegou na nuvem? Fica salvo no aparelho, então um
// backup que falhou (sem internet na academia) é reenviado quando a conexão
// volta ou na próxima vez que o app abrir — antes só saía na próxima série.
const PENDING_KEY = 'sync:pending';
const RETRY_MIN_MS = 30 * 1000;
const RETRY_MAX_MS = 10 * 60 * 1000;

let syncTimer = null;
let retryTimer = null;
let retryDelay = RETRY_MIN_MS;
let syncChain = Promise.resolve();
let changeSeq = 0;

function hasPending() { return localStorage.getItem(PENDING_KEY) === '1'; }

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (hasPending() && navigator.onLine !== false) runSync();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
}

function runSync() {
  syncTimer = null;
  clearTimeout(retryTimer);
  retryTimer = null;
  const seqAtStart = changeSeq;
  updateSyncStatus('syncing');
  syncChain = syncChain
    .then(() => syncToCloud())
    .then(() => {
      // Algo mudou enquanto enviava: continua pendente (o próximo envio já está marcado).
      if (changeSeq === seqAtStart) localStorage.removeItem(PENDING_KEY);
      retryDelay = RETRY_MIN_MS;
      updateSyncStatus('success');
    })
    .catch(e => {
      console.warn("Sincronização em nuvem offline:", e);
      updateSyncStatus('error');
      scheduleRetry();
    });
  return syncChain;
}

export function trySync() {
  changeSeq += 1;
  localStorage.setItem(PENDING_KEY, '1');
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
  clearTimeout(retryTimer);
  syncTimer = null;
  retryTimer = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && syncTimer) syncNow();
});

window.addEventListener('online', () => {
  if (hasPending()) {
    retryDelay = RETRY_MIN_MS;
    syncNow();
  }
});

// App aberto com backup pendente de antes (ex.: fechou sem internet): envia
// depois que a tela já carregou.
if (hasPending()) setTimeout(() => { if (hasPending() && !syncTimer) runSync(); }, 4000);

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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
    text.innerText = ts ? `Backup salvo às ${timeLabel(ts)}` : 'Backup salvo';
  } else if (state === 'error') {
    dot.style.background = 'var(--danger)';
    text.innerText = navigator.onLine === false
      ? 'Sem internet — o backup sai sozinho quando a conexão voltar'
      : 'Não deu para salvar agora — tentaremos de novo automaticamente';
  } else {
    const ts = Number(localStorage.getItem('lastSyncAt'));
    if (hasPending() && ts) {
      dot.style.background = 'var(--warning)';
      text.innerText = `Mudanças ainda não enviadas · último backup ${new Date(ts).toLocaleDateString('pt-BR')} às ${timeLabel(ts)}`;
    } else if (ts) {
      dot.style.background = 'var(--success)';
      text.innerText = `Último backup: ${new Date(ts).toLocaleDateString('pt-BR')} às ${timeLabel(ts)}`;
    } else {
      dot.style.background = 'var(--text-faint)';
      text.innerText = 'Nenhum backup feito ainda';
    }
  }
}
