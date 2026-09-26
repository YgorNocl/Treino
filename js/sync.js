import { syncToCloud } from './data.js';

export function trySync() {
  updateSyncStatus('syncing');
  try {
    const result = syncToCloud();
    if (result && typeof result.then === 'function') {
      result
        .then(() => updateSyncStatus('success'))
        .catch(e => { console.warn("Sincronização em nuvem offline:", e); updateSyncStatus('error'); });
    }
  } catch (e) {
    console.warn("Sincronização em nuvem offline:", e);
    updateSyncStatus('error');
  }
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