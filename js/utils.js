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