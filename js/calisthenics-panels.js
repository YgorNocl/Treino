import {
  MODE_SKILLS,
  CALI_SKILL_MAP,
  CALI_STEPS,
  CALI_AREA_MAP,
  fmtValue,
  fmtSeconds,
  escapeHtml,
  tutorialUrl,
  stepPhotos
} from './calisthenics-data.js';
import * as store from './calisthenics-store.js';
import { buildEvolutionChart, buildSparkline, metricValue } from './calisthenics-charts.js';
import { poseSvgs } from './calisthenics-poses.js';
import { formatDateBR, formatDateShortBR, todayString, dateStrFromDate } from './utils.js';
import { musclesHtml } from './body-map.js';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const RANGES = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: 'Tudo', months: Infinity }
];
const TABS = [
  { id: 'historico', label: 'Histórico' },
  { id: 'evolucao', label: 'Evolução' }
];
const SESSIONS_VISIBLE = 4;

let hooks = { getMode: () => 'cali' };
let monthOffset = 0;
let progressTab = 'evolucao';
let evoStepId = null;
let evoRange = 3;
let evoMetric = 'best';
let panelMode = 'cali';

const $ = id => document.getElementById(id);

function areaColor(areaId) {
  return CALI_AREA_MAP[areaId] ? CALI_AREA_MAP[areaId].color : 'var(--accent)';
}

function fmtDelta(step, diff) {
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const abs = Math.abs(diff);
  return step.mode === 'time' ? `${sign}${fmtSeconds(abs)}` : `${sign}${abs} ${abs === 1 ? 'rep' : 'reps'}`;
}

// Evolução do passo no dia, no mesmo formato do calendário da academia.
function dayTrendHtml(item, date) {
  if (item.isPR) return '<span class="day-trend pr">🏆 PR</span>';
  const previous = store.sessionsOf(item.step.id).filter(s => s.date < date);
  if (previous.length === 0) return '<span class="day-trend">1º registro</span>';
  const last = previous[previous.length - 1];
  const diff = item.best - sessionStats(last).best;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  const text = dir === 'same' ? '= igual' : `${dir === 'up' ? '↑' : '↓'} ${fmtDelta(item.step, diff)}`;
  return `<span class="day-trend ${dir}">${text} <span class="day-trend-vs">vs ${formatDateShortBR(last.date)}</span></span>`;
}

function sessionStats(session) {
  const values = session.sets.map(s => s.v);
  return { best: Math.max(...values), total: values.reduce((sum, v) => sum + v, 0) };
}

export function sessionRowHtml(step, session, previous, metric = 'best') {
  const stats = sessionStats(session);
  const bestIndex = session.sets.findIndex(s => s.v === stats.best);
  let trend = '';
  if (previous) {
    const prev = sessionStats(previous);
    const diff = metric === 'total' ? stats.total - prev.total : stats.best - prev.best;
    if (diff > 0) trend = `<span class="evo-session-trend up">↑ ${fmtDelta(step, diff)} vs treino anterior</span>`;
    else if (diff < 0) trend = `<span class="evo-session-trend down">↓ ${fmtDelta(step, diff)} vs treino anterior</span>`;
    else trend = '<span class="evo-session-trend">= igual ao treino anterior</span>';
  }
  const chips = session.sets
    .map((s, i) => `<span class="evo-set-chip ${i === bestIndex ? 'best' : ''}">${fmtValue(step, s.v)}</span>`)
    .join('');
  const notes = [...new Set(session.sets.map(s => s.n).filter(Boolean))];
  return `
    <div class="evo-session-card">
      <div class="evo-session-header-row">
        <div class="evo-session-date">${session.date === todayString() ? '<span class="evo-today-tag">HOJE</span>' : formatDateBR(session.date)}</div>
        ${trend}
      </div>
      <div class="evo-sets-row">${chips}</div>
      ${notes.length ? `<div class="cali-session-note">${escapeHtml(notes.join(' / '))}</div>` : ''}
    </div>`;
}

function renderCalendar() {
  const index = store.buildDayIndex(panelMode);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const cells = store.buildMonthCells(year, month, index);
  const summary = store.summarizeMonth(year, month, index);
  const isCurrent = monthOffset === 0;

  const grid = cells
    .map(cell => {
      if (!cell) return '<div class="cali-cal-cell empty"></div>';
      const classes = ['cali-cal-cell'];
      if (cell.isToday) classes.push('today');
      if (cell.isFuture) classes.push('future');
      if (!cell.data) return `<div class="${classes.join(' ')} lvl-0"><span>${cell.day}</span></div>`;
      classes.push(`lvl-${store.intensityLevel(cell.data.sets)}`);
      return `<button type="button" class="${classes.join(' ')}" data-date="${cell.dateStr}" aria-label="${formatDateBR(cell.dateStr)}: ${cell.data.sets} séries">
        <span>${cell.day}</span>
      </button>`;
    })
    .join('');

  $('caliCalendarContent').innerHTML = `
    <div class="cali-kpis three">
      <div class="cali-kpi"><b>${summary.days}</b><span>Dias treinados</span></div>
      <div class="cali-kpi"><b>${summary.sets}</b><span>Séries</span></div>
      ${summary.holdSeconds > 0
        ? `<div class="cali-kpi"><b>${fmtSeconds(summary.holdSeconds)}</b><span>Sob tensão</span></div>`
        : `<div class="cali-kpi"><b>${summary.reps}</b><span>Repetições</span></div>`}
    </div>
    <div class="cali-cal-nav">
      <button type="button" class="cal-nav-btn" id="caliCalPrev" aria-label="Mês anterior">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="cali-cal-title">${MONTHS[month]} ${year}</span>
      <button type="button" class="cal-nav-btn" id="caliCalNext" aria-label="Próximo mês" ${isCurrent ? 'disabled' : ''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <div class="cali-cal-card">
      <div class="cali-cal-labels">${WEEKDAYS.map(l => `<span>${l}</span>`).join('')}</div>
      <div class="cali-cal-grid">${grid}</div>
    </div>`;

  $('caliCalendarContent').querySelectorAll('.cali-cal-cell[data-date]').forEach(el => {
    el.addEventListener('click', () => openDay(panelMode, el.dataset.date));
  });
  $('caliCalPrev').addEventListener('click', () => {
    monthOffset -= 1;
    renderCalendar();
  });
  $('caliCalNext').addEventListener('click', () => {
    if (monthOffset < 0) {
      monthOffset += 1;
      renderCalendar();
    }
  });
}

export function openCalendar(mode) {
  panelMode = mode || hooks.getMode();
  monthOffset = 0;
  renderCalendar();
  $('caliCalendarModal').classList.add('visible');
}

export function openDay(mode, date) {
  panelMode = mode || hooks.getMode();
  const items = store.getDayDetail(panelMode, date);
  if (items.length === 0) return;
  const day = store.buildDayIndex(panelMode).get(date);
  const chips = [`<span class="cali-chip">${day.sets} ${day.sets === 1 ? 'série' : 'séries'}</span>`];
  if (day.holdSeconds > 0) chips.push(`<span class="cali-chip">${fmtSeconds(day.holdSeconds)} sob tensão</span>`);
  if (day.reps > 0) chips.push(`<span class="cali-chip">${day.reps} reps</span>`);
  if (day.last - day.first >= 60000) chips.push(`<span class="cali-chip">${fmtSeconds((day.last - day.first) / 1000)} de sessão</span>`);

  // Recordes do dia ficam num resumo no topo (igual ao painel da academia),
  // em vez de uma etiqueta fixa em cada exercício.
  const prItems = items.filter(item => item.isPR);
  const prsHtml = prItems.length
    ? `<div class="cali-day-prs">
        <div class="cali-day-prs-label">🏆 Recordes desse dia</div>
        ${prItems.map(item => `<div class="cali-day-pr-row"><span>${item.step.name}</span><span class="cali-day-pr-value">${fmtValue(item.step, item.best)}<span class="summary-pr-prev">antes ${fmtValue(item.step, store.getBestBefore(item.step.id, date))}</span></span></div>`).join('')}
      </div>`
    : '';

  const body = items
    .map(item => {
      const skill = CALI_SKILL_MAP[item.step.skillId];
      const bestIndex = item.sets.findIndex(s => s.v === item.best);
      const setChips = item.sets
        .map((s, i) => `<span class="cali-chip ${i === bestIndex ? 'best' : ''}">${fmtValue(item.step, s.v)}</span>`)
        .join('');
      const notes = [...new Set(item.sets.map(s => s.n).filter(Boolean))];
      return `
        <div class="cali-day-item" style="--area:${areaColor(item.step.area)}">
          <div class="cali-day-item-head">
            <div>
              <div class="cali-day-item-name">${item.step.name}</div>
              <div class="cali-day-item-skill">${skill.name}</div>
            </div>
            ${dayTrendHtml(item, date)}
          </div>
          <div class="cali-chip-row">${setChips}</div>
          ${notes.length ? `<div class="cali-session-note">${escapeHtml(notes.join(' / '))}</div>` : ''}
        </div>`;
    })
    .join('');

  $('caliDayTitle').textContent = date === todayString() ? 'Hoje' : formatDateBR(date);
  const skills = [...new Set(items.map(item => item.step.skillId))].map(id => CALI_SKILL_MAP[id]).filter(s => s.muscles);
  const primary = [...new Set(skills.flatMap(s => s.muscles.prim))];
  const secondary = [...new Set(skills.flatMap(s => s.muscles.sec))].filter(m => !primary.includes(m));
  const musclesBlock = primary.length
    ? `<div class="day-muscles">${musclesHtml(primary, secondary, panelMode === 'mobi' ? 'Regiões do dia' : 'Músculos do dia')}</div>`
    : '';

  $('caliDayBody').innerHTML = `${prsHtml}${musclesBlock}<div class="cali-chip-row spaced">${chips.join('')}</div>${body}`;
  $('caliDayModal').classList.add('visible');
}

function mediaHtml(step) {
  const photos = stepPhotos(step);
  if (photos.length > 0) {
    const imgs = photos
      .map((src, i) => `<img crossorigin="anonymous" src="${src}" alt="${escapeHtml(step.name)}, posição ${i + 1}" loading="lazy" onerror="this.style.display='none'">`)
      .join('');
    const caption = step.mediaNote || (photos.length > 1 ? 'Duas posições do movimento' : 'Posição de referência');
    return `<div class="info-media-frames ${photos.length === 1 ? 'single' : ''}">${imgs}</div><div class="info-media-caption">${caption}</div>`;
  }
  const svgs = poseSvgs(step.id);
  if (svgs.length > 1) {
    return `<div class="info-media-frames">${svgs.map(svg => `<div class="cali-pose">${svg}</div>`).join('')}</div><div class="info-media-caption">Início e fim do movimento</div>`;
  }
  if (svgs.length === 1) {
    return `<div class="cali-pose">${svgs[0]}</div><div class="info-media-caption">${step.mediaNote || 'Posição de referência'}</div>`;
  }
  return '';
}

export function openGuide(stepId) {
  const step = CALI_STEPS[stepId];
  if (!step) return;
  const media = $('caliGuideMedia');
  const mediaMarkup = mediaHtml(step);
  media.innerHTML = mediaMarkup;
  media.style.display = mediaMarkup ? 'block' : 'none';
  $('caliGuideTitle').textContent = step.name;
  $('caliGuideAlias').textContent = step.alias;
  const muscles = CALI_SKILL_MAP[step.skillId].muscles;
  const musclesEl = $('caliGuideMuscles');
  musclesEl.style.display = muscles ? '' : 'none';
  musclesEl.innerHTML = muscles
    ? musclesHtml(muscles.prim, muscles.sec, step.area === 'mobilidade' ? 'Regiões trabalhadas' : 'Músculos trabalhados')
    : '';
  $('caliGuideCues').innerHTML = step.cues.map(c => `<li>${c}</li>`).join('');
  $('caliGuideTip').textContent = step.tip;
  $('caliGuideVideo').href = tutorialUrl(step);
  const modal = $('caliGuideModal');
  modal.classList.add('visible');
  modal.querySelector('.info-modal-content').scrollTop = 0;
}

function trendHtml(step, series) {
  if (series.length < 2) return `<span class="cali-trend">${series.length} treino</span>`;
  const diff = series[series.length - 1].best - series[series.length - 2].best;
  if (diff > 0) return `<span class="cali-trend up">↑ ${fmtDelta(step, diff)}</span>`;
  if (diff < 0) return `<span class="cali-trend down">↓ ${fmtDelta(step, diff)}</span>`;
  return '<span class="cali-trend">= igual ao anterior</span>';
}

function renderHistoryTab(body, withHistory) {
  if (withHistory.length === 0) {
    body.innerHTML = '<div class="cali-empty">Nenhum histórico registrado ainda. Registre suas séries para acompanhar tudo aqui.</div>';
    return;
  }
  const chevron = '<svg class="hist-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  const skills = MODE_SKILLS[panelMode] || [];
  body.innerHTML = skills.map(skill => {
    const steps = withHistory.filter(step => step.skillId === skill.id);
    if (steps.length === 0) return '';
    const rows = steps
      .map(step => {
        const series = store.getSeries(step.id);
        const last = series[series.length - 1];
        const spark = buildSparkline(series.map(s => s.best));
        return `
          <div class="stat-row" role="button" tabindex="0" data-step="${step.id}">
            <div><div class="stat-name">${step.name}</div><div class="stat-sub">${trendHtml(step, series)}</div></div>
            ${spark ? `<div class="stat-spark">${spark}</div>` : ''}
            <div class="stat-value">${fmtValue(step, last.best)}</div>
          </div>`;
      })
      .join('');
    return `
      <div class="hist-cat-card expanded">
        <div class="cat-header" role="button" tabindex="0">${skill.name}${chevron}</div>
        <div class="hist-wrapper"><div class="hist-body"><div class="hist-inner">${rows}</div></div></div>
      </div>`;
  }).join('');

  body.querySelectorAll('.cat-header').forEach(header => {
    header.addEventListener('click', () => header.parentElement.classList.toggle('expanded'));
  });
  body.querySelectorAll('.stat-row').forEach(row => {
    const open = () => {
      evoStepId = row.dataset.step;
      progressTab = 'evolucao';
      renderProgress();
    };
    row.addEventListener('click', open);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter') open();
    });
  });
}

function stepSelectHtml(withHistory) {
  const check = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
  const skills = MODE_SKILLS[panelMode] || [];
  const groups = skills.map(skill => {
    const steps = withHistory.filter(step => step.skillId === skill.id);
    if (steps.length === 0) return '';
    return (
      `<div class="custom-select-group">${skill.name}</div>` +
      steps
        .map(step => {
          const selected = step.id === evoStepId;
          return `<div class="custom-select-option ${selected ? 'selected' : ''}" role="option" data-value="${step.id}">${step.name}${selected ? check : ''}</div>`;
        })
        .join('')
    );
  }).join('');
  return `
    <div class="custom-select-wrap" id="caliSelectWrap">
      <div class="custom-select-header" id="caliSelectHeader" role="button" tabindex="0">
        <span>${CALI_STEPS[evoStepId].name}</span>
        <svg class="custom-select-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="custom-select-options" id="caliSelectOptions" role="listbox">${groups}</div>
    </div>
    <div id="caliEvoContent"></div>`;
}

function renderEvolutionTab(body, withHistory) {
  if (withHistory.length === 0) {
    body.innerHTML = '<div class="cali-empty">Nenhum histórico registrado ainda. Registre suas séries para ver sua evolução aqui.</div>';
    return;
  }
  if (!evoStepId || !withHistory.some(s => s.id === evoStepId)) {
    const last = store.getLastTrained(panelMode);
    evoStepId = last ? last.step.id : withHistory[0].id;
  }
  body.innerHTML = stepSelectHtml(withHistory);

  const header = $('caliSelectHeader');
  const options = $('caliSelectOptions');
  const toggle = () => {
    options.classList.toggle('open');
    header.classList.toggle('open');
  };
  header.addEventListener('click', e => {
    e.stopPropagation();
    toggle();
  });
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  options.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.addEventListener('click', () => {
      evoStepId = opt.dataset.value;
      evoRange = 3;
      renderProgress();
    });
  });
  renderEvolutionContent();
}

function renderEvolutionContent() {
  const content = $('caliEvoContent');
  if (!content) return;
  const step = CALI_STEPS[evoStepId];
  const series = store.getSeries(step.id);
  const values = series.map(s => metricValue(s, evoMetric));
  const pr = Math.max(...values);
  const delta = pr - values[0];
  const deltaClass = series.length < 2 ? 'flat' : delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'flat';
  const deltaLabel = series.length < 2 ? '—' : fmtDelta(step, delta);
  const prText = step.mode === 'time' ? fmtSeconds(pr) : `${pr}<span class="evo-stat-unit">${pr === 1 ? 'rep' : 'reps'}</span>`;

  const metricToggle = `
    <div class="unit-toggle" id="caliMetricToggle" role="group" aria-label="Métrica do gráfico">
      <button type="button" class="unit-toggle-btn ${evoMetric === 'best' ? 'active' : ''}" data-metric="best">Melhor série</button>
      <button type="button" class="unit-toggle-btn ${evoMetric === 'total' ? 'active' : ''}" data-metric="total">Total do treino</button>
    </div>`;

  const summary = `
    <div class="evo-summary">
      <div class="evo-stat"><div class="evo-stat-value">${series.length}</div><div class="evo-stat-label">${series.length === 1 ? 'Treino' : 'Treinos'}</div></div>
      <div class="evo-stat evo-stat-hero"><div class="evo-stat-value">${prText}</div><div class="evo-stat-label">Recorde ${evoMetric === 'total' ? 'total' : 'série'}</div></div>
      <div class="evo-stat"><div class="evo-stat-value ${deltaClass}">${deltaLabel}</div><div class="evo-stat-label">Desde o início</div></div>
    </div>`;

  let inRange = series;
  if (Number.isFinite(evoRange)) {
    const cutoff = new Date(todayString());
    cutoff.setMonth(cutoff.getMonth() - evoRange);
    const cutoffStr = dateStrFromDate(cutoff);
    inRange = series.filter(s => s.date >= cutoffStr);
    if (inRange.length < 2) inRange = series.slice(-Math.min(6, series.length));
  }

  let chartHtml;
  let pointsData = [];
  if (series.length >= 2) {
    const built = buildEvolutionChart(inRange, step, evoMetric);
    pointsData = built.pointsData;
    const rangeButtons = RANGES.map(r => {
      const active = r.months === Infinity ? !Number.isFinite(evoRange) : evoRange === r.months;
      return `<button type="button" class="evo-zoom-btn ${active ? 'active' : ''}" data-range="${r.months === Infinity ? 'all' : r.months}">${r.label}</button>`;
    }).join('');
    chartHtml = `
      <div class="evo-chart-card">
        <div class="evo-zoom-row">${rangeButtons}</div>
        <div class="evo-chart-scroll">${built.svg}</div>
      </div>
      <div class="evo-tooltip" id="caliEvoTooltip">
        <div class="evo-tooltip-placeholder">Toque em um ponto do gráfico para ver os detalhes daquele treino</div>
      </div>`;
  } else {
    chartHtml = '<div class="evo-chart-card"><div class="evo-chart-empty">Registre mais um treino para começar a ver o gráfico de evolução.</div></div>';
  }

  const reversed = series.map((session, i) => ({ session, previous: i > 0 ? series[i - 1] : null })).reverse();
  const row = item => sessionRowHtml(step, item.session, item.previous, evoMetric);
  const visible = reversed.slice(0, SESSIONS_VISIBLE);
  const hidden = reversed.slice(SESSIONS_VISIBLE);
  let listHtml = `<div class="evo-list-label">Histórico de treinos</div><div class="evo-session-list">${visible.map(row).join('')}</div>`;
  if (hidden.length > 0) {
    listHtml += `<div id="caliEvoHidden" class="evo-session-list" style="display:none; margin-top:10px;">${hidden.map(row).join('')}</div>`;
    listHtml += `<button type="button" id="caliEvoMore" class="evo-show-more-btn">Ver ${hidden.length} ${hidden.length > 1 ? 'treinos mais antigos' : 'treino mais antigo'}</button>`;
  }

  content.innerHTML = metricToggle + summary + chartHtml + listHtml;

  content.querySelectorAll('#caliMetricToggle .unit-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      evoMetric = btn.dataset.metric;
      renderEvolutionContent();
    });
  });
  content.querySelectorAll('.evo-zoom-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      evoRange = btn.dataset.range === 'all' ? Infinity : Number(btn.dataset.range);
      renderEvolutionContent();
    });
  });
  const more = $('caliEvoMore');
  if (more) {
    more.addEventListener('click', () => {
      $('caliEvoHidden').style.display = 'flex';
      more.remove();
    });
  }

  if (pointsData.length > 0) {
    const tooltip = $('caliEvoTooltip');
    const chartCard = content.querySelector('.evo-chart-card');
    chartCard.querySelectorAll('.evo-point').forEach(pointEl => {
      const show = () => {
        const idx = Number(pointEl.dataset.idx);
        chartCard.querySelectorAll('.evo-point').forEach(el => el.classList.toggle('active', Number(el.dataset.idx) === idx));
        const p = pointsData[idx];
        if (!p) return;
        const best = Math.max(...p.sets.map(s => s.v));
        const bestIndex = p.sets.findIndex(s => s.v === best);
        const setBlocks = p.sets
          .map((s, i) => `<div class="evo-set-block ${i === bestIndex ? 'best' : ''}"><span class="evo-set-label">S${i + 1}</span><span class="evo-set-value">${fmtValue(step, s.v)}</span></div>`)
          .join('');
        let deltaHtml = '';
        if (p.delta !== null) {
          const cls = p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : '';
          const arrow = p.delta > 0 ? '↑ ' : p.delta < 0 ? '↓ ' : '';
          deltaHtml = `<div class="cali-tooltip-delta"><span class="cali-trend ${cls}">${p.delta === 0 ? '= igual ao treino anterior' : `${arrow}${fmtDelta(step, p.delta)} vs treino anterior`}</span></div>`;
        }
        const notes = [...new Set(p.sets.map(s => s.n).filter(Boolean))];
        tooltip.innerHTML = `
          <div class="evo-tooltip-header">
            <div class="evo-tooltip-date">${p.date}</div>
            ${p.isPR ? '<span class="evo-tooltip-pr">🏆 Recorde</span>' : ''}
          </div>
          ${deltaHtml}
          <div class="evo-tooltip-sets-row">${setBlocks}</div>
          ${notes.length ? `<div class="cali-session-note">${escapeHtml(notes.join(' / '))}</div>` : ''}`;
      };
      pointEl.addEventListener('click', e => {
        e.stopPropagation();
        show();
      });
      pointEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          show();
        }
      });
    });
    const initial = chartCard.querySelector(`.evo-point[data-idx="${pointsData.length - 1}"]`);
    if (initial) initial.dispatchEvent(new Event('click', { bubbles: true }));
  }
}

function renderProgress() {
  const withHistory = store.getStepsWithHistory(panelMode);
  const content = $('caliStatsContent');
  content.innerHTML = `
    <div class="cali-tabs" role="tablist">
      ${TABS.map(t => `<button type="button" role="tab" class="cali-tab ${t.id === progressTab ? 'active' : ''}" data-tab="${t.id}" aria-selected="${t.id === progressTab}">${t.label}</button>`).join('')}
    </div>
    <div id="caliProgressBody"></div>`;
  content.querySelectorAll('.cali-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      progressTab = tab.dataset.tab;
      renderProgress();
    });
  });
  const body = $('caliProgressBody');
  if (progressTab === 'historico') renderHistoryTab(body, withHistory);
  else renderEvolutionTab(body, withHistory);
}

export function openProgress(mode, stepId) {
  panelMode = mode || hooks.getMode();
  const withHistory = store.getStepsWithHistory(panelMode);
  if (stepId) {
    evoStepId = stepId;
    evoRange = 3;
    progressTab = 'evolucao';
  } else {
    progressTab = withHistory.length > 0 ? 'evolucao' : 'historico';
  }
  renderProgress();
  $('caliStatsModal').classList.add('visible');
  $('caliStatsContent').scrollTop = 0;
}

export function closePanels() {
  ['caliCalendarModal', 'caliStatsModal', 'caliGuideModal', 'caliDayModal'].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove('visible');
  });
}

export function initPanels(options) {
  hooks = Object.assign(hooks, options);
  $('closeCaliCalendar').addEventListener('click', () => $('caliCalendarModal').classList.remove('visible'));
  $('closeCaliStats').addEventListener('click', () => $('caliStatsModal').classList.remove('visible'));
  $('closeCaliGuide').addEventListener('click', () => $('caliGuideModal').classList.remove('visible'));
  $('closeCaliDay').addEventListener('click', () => $('caliDayModal').classList.remove('visible'));
  ['caliGuideModal', 'caliDayModal'].forEach(id => {
    $(id).addEventListener('click', e => {
      if (e.target.id === id) $(id).classList.remove('visible');
    });
  });
  document.addEventListener('click', e => {
    const header = $('caliSelectHeader');
    const options = $('caliSelectOptions');
    if (header && options && !header.contains(e.target) && !options.contains(e.target)) {
      options.classList.remove('open');
      header.classList.remove('open');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanels();
  });
}