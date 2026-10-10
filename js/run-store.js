// Dados da corrida: uma lista em `run:log`, cada corrida
// { d: 'AAAA-MM-DD', km: 5.2, s: 1830, w: 300, n: 'parque', t: <criado em, ms> }
// s = tempo correndo (segundos), w = tempo andando (segundos, só gravado se > 0).
// `t` identifica a corrida (editar/apagar). `n` só é gravado quando há texto.
import { readListCached, getWeekStart, getWeekEnd } from './utils.js';
import { trySync } from './sync.js';

const LOG_KEY = 'run:log';
export const MAX_KM = 300;
export const MAX_SECONDS = 24 * 3600;

function buildRuns(list) {
  return list
    .filter(r => r && typeof r.d === 'string' && typeof r.km === 'number' && r.km > 0)
    .map(r => ({
      d: r.d,
      km: r.km,
      s: Number(r.s) > 0 ? Number(r.s) : 0,
      w: Number(r.w) > 0 ? Number(r.w) : 0,
      n: typeof r.n === 'string' ? r.n : '',
      t: Number(r.t) || 0
    }))
    .filter(r => r.s + r.w > 0);
}

// Mais recente primeiro (data, depois hora em que foi registrada).
export function loadRuns() {
  return readListCached(LOG_KEY, buildRuns).sort((a, b) => b.d.localeCompare(a.d) || b.t - a.t);
}

function saveRuns(list) {
  const out = list.map(r => {
    const item = { d: r.d, km: r.km, s: r.s };
    if (r.w) item.w = r.w;
    if (r.n) item.n = r.n;
    item.t = r.t;
    return item;
  });
  localStorage.setItem(LOG_KEY, JSON.stringify(out));
  trySync();
}

function clean({ date, km, run, walk = 0, note = '' }) {
  return { d: date, km: roundKm(km), s: Math.round(run), w: Math.round(walk), n: String(note).trim().slice(0, 80) };
}

export function addRun(data) {
  const list = loadRuns();
  // t único mesmo com duas corridas registradas no mesmo milissegundo.
  const t = Math.max(Date.now(), ...list.map(r => r.t + 1));
  const run = { ...clean(data), t };
  saveRuns([...list, run]);
  return run;
}

export function updateRun(t, data) {
  const list = loadRuns();
  if (!list.some(r => r.t === t)) return;
  saveRuns(list.map(r => (r.t === t ? { ...clean(data), t } : r)));
}

export function removeRun(t) {
  const list = loadRuns();
  const kept = list.filter(r => r.t !== t);
  if (kept.length !== list.length) saveRuns(kept);
}

export function roundKm(km) { return Math.round(km * 100) / 100; }

export function totalSeconds(run) { return run.s + run.w; }

// Ritmo médio (segundos por km) e velocidade média (km/h), pelo tempo total
// (correndo + andando).
export function paceOf(run) { return totalSeconds(run) / run.km; }
export function speedOf(run) { return run.km / (totalSeconds(run) / 3600); }

// Data -> corridas daquele dia.
export function runsByDate(list = loadRuns()) {
  const map = new Map();
  list.forEach(r => {
    if (!map.has(r.d)) map.set(r.d, []);
    map.get(r.d).push(r);
  });
  return map;
}

// Soma de corridas, km, tempo correndo e tempo andando.
export function totals(list, filter = () => true) {
  const out = { count: 0, km: 0, run: 0, walk: 0 };
  list.filter(filter).forEach(r => {
    out.count += 1;
    out.km += r.km;
    out.run += r.s;
    out.walk += r.w;
  });
  out.km = roundKm(out.km);
  return out;
}

export function weekTotals(dateStr, list = loadRuns()) {
  const start = getWeekStart(dateStr);
  const end = getWeekEnd(start);
  return totals(list, r => r.d >= start && r.d <= end);
}

// Recordes: maior distância e melhor ritmo médio. O ritmo só conta corridas de
// pelo menos 1 km (um tiro de 200 m não vira "melhor ritmo").
export const PACE_MIN_KM = 1;
export function records(list = loadRuns()) {
  if (list.length === 0) return null;
  const longest = list.reduce((best, r) => (r.km > best.km ? r : best));
  const paced = list.filter(r => r.km >= PACE_MIN_KM);
  const fastest = paced.length ? paced.reduce((best, r) => (paceOf(r) < paceOf(best) ? r : best)) : null;
  return { longest, fastest };
}

// Km por semana (domingo a sábado) nas últimas `count` semanas, da mais antiga
// para a atual.
export function weeklyKm(todayStr, count, list = loadRuns()) {
  const weeks = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = getWeekStart(todayStr, -i);
    const end = getWeekEnd(start);
    weeks.push({ start, km: totals(list, r => r.d >= start && r.d <= end).km });
  }
  return weeks;
}
