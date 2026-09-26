export function pad2(n) { return String(n).padStart(2, '0'); }

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseNum(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function safeId(text) { return text.replace(/[^a-zA-Z0-9]/g, ''); }

export function unitLabel(unit) { return unit === 'placas' ? 'placas' : 'kg'; }

export function formatLoad(weight, unit) { return `${weight}${unit === 'placas' ? ' placas' : 'kg'}`; }

export function estimatedMax(weight, reps) { return weight * (1 + reps / 30); }

export function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateShortBR(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export function dateStrFromDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export function getWeekStart(dateStr, offset = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay() + offset * 7);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getWeekEnd(weekStartStr) {
  const [y, m, d] = weekStartStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 6);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
// Estado vazio com um desenho "fantasma" em cinza: 'chart' (linha de evolução)
// ou 'list' (linhas de histórico com mini gráfico).
export function emptyStateHtml(kind, title, text = '') {
  const art = kind === 'list'
    ? `<svg viewBox="0 0 240 120" aria-hidden="true">${[0, 1, 2].map(i => {
        const y = 8 + i * 40;
        return `<rect x="0" y="${y}" width="240" height="32" rx="9" class="es-box"/>`
          + `<rect x="12" y="${y + 9}" width="${[84, 64, 96][i]}" height="6" rx="3" class="es-bar"/>`
          + `<rect x="12" y="${y + 20}" width="40" height="4" rx="2" class="es-bar dim"/>`
          + `<polyline points="${[[150, 22], [165, 16], [180, 19], [195, 11], [210, 13]].map(([x, yy]) => `${x},${y + yy - 4 + i * 2}`).join(' ')}" class="es-line"/>`;
      }).join('')}</svg>`
    : `<svg viewBox="0 0 240 120" aria-hidden="true">
        ${[20, 50, 80, 110].map(y => `<line x1="0" x2="240" y1="${y}" y2="${y}" class="es-grid"/>`).join('')}
        <polyline points="10,92 50,80 90,84 130,60 170,52 210,34 230,28" class="es-line"/>
        ${[[10, 92], [50, 80], [90, 84], [130, 60], [170, 52], [210, 34]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" class="es-dot"/>`).join('')}
      </svg>`;
  return `<div class="empty-state">${art}<strong>${title}</strong>${text ? `<span>${text}</span>` : ''}</div>`;
}

// Fundo de um dia no calendário: uma cor, ou o quadradinho dividido em partes
// iguais lado a lado (com uma linha fina escura entre elas) quando houve mais de
// um treino no dia.
export function dayColorsBackground(colors) {
  if (colors.length <= 1) return colors[0] || 'transparent';
  const step = 100 / colors.length;
  const parts = colors.map((c, i) => {
    const from = i === 0 ? '0%' : `calc(${(i * step).toFixed(2)}% + 1px)`;
    const to = i === colors.length - 1 ? '100%' : `calc(${((i + 1) * step).toFixed(2)}% - 1px)`;
    const sep = i === colors.length - 1 ? '' : `, rgba(11, 12, 14, 0.55) ${to} calc(${((i + 1) * step).toFixed(2)}% + 1px)`;
    return `${c} ${from} ${to}${sep}`;
  }).join(', ');
  return `linear-gradient(90deg, ${parts})`;
}
