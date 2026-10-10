// Calendário do mês — o mesmo desenho na academia, na calistenia e na
// mobilidade (antes cada um tinha o seu código e o seu CSS).
//
// Dia treinado: um anel na cor do treino em volta do número, com o fundo no
// mesmo tom, claro. Dois treinos no dia: o anel e o fundo se dividem em duas
// metades (esquerda = primeiro treino), com um respiro entre os arcos — antes o
// quadradinho era cortado ao meio por uma linha escura bem em cima do número.
// Hoje: um pontinho embaixo do número.

import { todayString, dateStrFromDate, formatDateBR } from './utils.js';

export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const RING_GAP_DEG = 16;

function tint(color) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}3d` : `color-mix(in srgb, ${color} 24%, transparent)`;
}

// Variáveis --ring (arcos) e --tint (fundo) usadas pela classe .cal-ring.
export function ringStyle(colors) {
  const n = colors.length;
  const step = 360 / n;
  const gap = n > 1 ? RING_GAP_DEG / 2 : 0;
  const arcs = colors.map((c, i) => {
    const a = i * step;
    const b = (i + 1) * step;
    return `transparent ${a}deg ${a + gap}deg, ${c} ${a + gap}deg ${b - gap}deg, transparent ${b - gap}deg ${b}deg`;
  }).join(', ');
  const fill = n === 1
    ? tint(colors[0])
    : `conic-gradient(from 180deg, ${colors.map((c, i) => `${tint(c)} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
  return `--ring: conic-gradient(from 180deg, ${arcs}); --tint: ${fill};`;
}

// days: Map "AAAA-MM-DD" -> { colors: ['#...'], label: 'Superior e Inferior' }.
// Dias treinados viram botões com data-date (para abrir o detalhe do dia).
export function monthCalendarHtml(year, month, days) {
  const startWeekday = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const today = todayString();
  let cells = '';
  for (let i = 0; i < startWeekday; i++) cells += '<span class="day-cell empty"></span>';
  for (let d = 1; d <= total; d++) {
    const dateStr = dateStrFromDate(new Date(year, month, d));
    const info = days.get(dateStr);
    const classes = ['day-cell'];
    if (dateStr === today) classes.push('today');
    if (dateStr > today) classes.push('future');
    const dot = dateStr === today ? '<i class="day-today-dot" aria-hidden="true"></i>' : '';
    if (!info || !info.colors || info.colors.length === 0) {
      cells += `<span class="${classes.join(' ')}"><span class="day-num">${d}</span>${dot}</span>`;
      continue;
    }
    classes.push('trained', 'cal-ring');
    const label = `${formatDateBR(dateStr)}${info.label ? `: ${info.label}` : ''}`;
    cells += `<button type="button" class="${classes.join(' ')}" style="${ringStyle(info.colors)}" data-date="${dateStr}" aria-label="${label}"><span class="day-num">${d}</span>${dot}</button>`;
  }
  return `
    <div class="month-cal">
      <div class="month-cal-labels">${WEEKDAY_LABELS.map(l => `<span>${l}</span>`).join('')}</div>
      <div class="month-cal-grid">${cells}</div>
    </div>`;
}

// Setas e nome do mês. Os botões usam data-cal-nav (não id), porque o
// calendário da academia e o da calistenia existem juntos na página.
export function monthNavHtml(year, month, isCurrentMonth) {
  return `
    <div class="cal-nav">
      <button type="button" class="cal-nav-btn" data-cal-nav="prev" aria-label="Mês anterior">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="cal-nav-label">${MONTH_NAMES[month]} ${year}</span>
      <button type="button" class="cal-nav-btn" data-cal-nav="next" aria-label="Próximo mês" ${isCurrentMonth ? 'disabled' : ''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>`;
}

// items: [{ color, label }] — uma cor por treino, no mesmo desenho do dia.
export function calendarLegendHtml(items) {
  return `
    <div class="cal-legend">
      ${items.map(item => `<span class="cal-legend-item"><span class="cal-legend-swatch cal-ring" style="${ringStyle([item.color])}"></span>${item.label}</span>`).join('')}
    </div>`;
}

// Liga setas, arrastar para os lados e toque nos dias treinados. Registrado uma
// vez no container (o conteúdo é redesenhado a cada troca de mês).
// onMonth(-1 | +1); onDay(dateStr).
export function bindMonthCalendar(container, { onMonth, onDay }) {
  container.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-cal-nav]');
    if (nav) {
      if (!nav.disabled) onMonth(nav.dataset.calNav === 'next' ? 1 : -1);
      return;
    }
    const day = e.target.closest('.day-cell[data-date]');
    if (day) onDay(day.dataset.date);
  });
  let start = null;
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !e.target.closest('.month-cal')) { start = null; return; }
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  container.addEventListener('touchend', (e) => {
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = container.querySelector('[data-cal-nav="next"]');
    if (dx < 0 && next && next.disabled) return;
    onMonth(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// Números do mês no topo do calendário: [{ value, label }].
export function calendarStatsHtml(stats) {
  return `
    <div class="cal-stats">
      ${stats.map(s => `<div class="cal-stat"><div class="cal-stat-value">${s.value}</div><div class="cal-stat-label">${s.label}</div></div>`).join('')}
    </div>`;
}

// Linha discreta com o total de dias treinados no ano do mês mostrado.
export function yearSummaryHtml(year, days) {
  return `<p class="cal-year">${days} ${days === 1 ? 'dia treinado' : 'dias treinados'} em ${year}</p>`;
}

// Volume em kg para caber na caixinha: "8.450 kg" ou "12,4 t".
export function formatVolume(kg) {
  if (kg >= 10000) return `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`;
  return `${Math.round(kg).toLocaleString('pt-BR')} kg`;
}
