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

// Qual série é melhor: a de maior carga estimada (1RM); empate é decidido pelas
// repetições. Sem o desempate, exercício com peso do corpo (carga 0) nunca tinha
// recorde — toda série valia 0.
export function compareSets(a, b) {
  return (estimatedMax(a.weight, a.reps) - estimatedMax(b.weight, b.reps)) || (a.reps - b.reps);
}
export function isBetterSet(a, b) { return compareSets(a, b) > 0; }

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

// Data "AAAA-MM-DD" de n meses antes, no fuso local. (new Date('AAAA-MM-DD')
// lê a data em UTC: no Brasil ela vira o dia anterior às 21h.)
export function monthsAgo(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return dateStrFromDate(new Date(y, m - 1 - n, d));
}

// Lê JSON do localStorage sem quebrar o app: valor corrompido (ou de outro
// tipo, ex.: objeto no lugar de lista) volta como `fallback`. Não grava nada,
// então o valor original continua lá para o backup.
export function readJSON(key, fallback) {
  let value;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    value = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
  if (fallback && typeof fallback === 'object') return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  return value ?? fallback;
}

// Lista do localStorage com cache: o mesmo texto guardado não é convertido de
// novo. O histórico é lido várias vezes a cada série registrada; com anos de
// treino, converter tudo de novo em cada leitura deixava o toque lento no
// celular. `build(lista)` prepara os itens uma vez (validar, completar campos) e
// precisa ser sempre a mesma função. Devolve uma cópia da lista; os itens são
// congelados — para mudar um item, crie outro objeto.
const listCache = new Map();
export function readListCached(key, build) {
  const raw = localStorage.getItem(key);
  const hit = listCache.get(key);
  if (hit && hit.raw === raw && hit.build === build) return hit.list.slice();
  let parsed = [];
  if (raw !== null) {
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) parsed = value;
    } catch (e) { /* corrompido: lista vazia, sem apagar o original */ }
  }
  const list = build(parsed).map(item => (item && typeof item === 'object' ? Object.freeze(item) : item));
  listCache.set(key, { raw, list, build });
  return list.slice();
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


// Card aberto perto do fim da tela: rola só o necessário para ele aparecer
// inteiro (campos e botão de registrar), depois da animação de abrir.
export function revealCard(card) {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    if (card.isConnected && card.classList.contains('expanded')) card.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
  }, 360);
}

// Texto para busca: minúsculo e sem acento ("Tríceps" acha com "triceps").
export function searchKey(text) {
  return String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Marcas do eixo dos gráficos em valores "redondos" (35, 40, 45 / 12, 13, 14),
// sem repetir número. minStep: menor passo (1 para repetições e segundos).
export function niceTicks(min, max, { target = 4, minStep = 0 } = {}) {
  const raw = (max - min) / target || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  step = Math.max(step, minStep);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
