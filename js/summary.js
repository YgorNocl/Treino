// Resumo ao finalizar o treino — o mesmo na academia, na calistenia e na
// mobilidade: números do dia, recordes e o botão para salvar a imagem.

const modal = document.getElementById('summaryModal');
const body = document.getElementById('summaryBody');

// stats: [{ value, label }]; prs: [{ name, value }]; onShare: () => Promise
export function showSummaryModal({ stats, prs = [], onShare }) {
  const prsHtml = prs.length
    ? `<div class="summary-prs">
        <div class="summary-prs-label">🏆 Recordes de hoje</div>
        ${prs.map(pr => `<div class="summary-pr-row"><span>${pr.name}</span><span class="summary-pr-value">${pr.value}</span></div>`).join('')}
      </div>`
    : '';
  body.innerHTML = `
    <div class="summary-stats-row">
      ${stats.map(s => `<div class="summary-stat"><div class="summary-stat-value">${s.value}</div><div class="summary-stat-label">${s.label}</div></div>`).join('')}
    </div>
    ${prsHtml}
    <button type="button" class="save-btn summary-share-btn" id="summaryShareBtn">Salvar imagem do treino</button>`;
  const btn = document.getElementById('summaryShareBtn');
  btn.addEventListener('click', async () => {
    const original = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Gerando...';
    try {
      await onShare();
    } finally {
      btn.disabled = false;
      btn.innerText = original;
    }
  });
  modal.classList.add('visible');
}

// Data do treino por extenso: "Sábado, 26 de setembro".
export function longDateLabel(dateStr) {
  const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// No celular, abre o menu de compartilhar (Drive, WhatsApp, Galeria...); sem
// suporte, baixa o arquivo.
export async function shareOrDownload(blob, fileName, title) {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
