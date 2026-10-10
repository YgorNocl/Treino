// Corrida, dentro da Academia: o botão "Corrida" ao lado de Superior/Inferior
// troca a lista de exercícios por esta tela (app.js decide quando mostrar).
// Registra distância, tempo correndo e tempo andando, com data e observação;
// ritmo médio e velocidade saem sozinhos. Tocar numa corrida da lista abre ela
// no mesmo formulário para corrigir ou apagar.
import * as runs from './run-store.js';
import { todayString, parseNum, formatDateBR, emptyStateHtml, niceTicks, pad2 } from './utils.js';
import { confirmDialog } from './dialog.js';

const $ = id => document.getElementById(id);
const root = $('runRoot');
const LIST_VISIBLE = 10;
let showAll = false;
let editing = null;            // `t` da corrida aberta no formulário, ou null
let hooks = { onChange: () => {} };

// ---------- Formatos ----------
export function fmtKm(km) { return km.toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }

export function fmtDuration(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(r)}` : `${m}:${pad2(r)}`;
}

export function fmtPace(secondsPerKm) {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

export function fmtSpeed(kmh) { return kmh.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); }

// "30:00 correndo · 10:00 andando"
export function timesText(run) {
  const parts = [];
  if (run.s) parts.push(`${fmtDuration(run.s)} correndo`);
  if (run.w) parts.push(`${fmtDuration(run.w)} andando`);
  return parts.join(' · ');
}

function shortDate(dateStr) {
  const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.,', ',');
}

function escapeText(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(title, text) {
  if (typeof window.showToast === 'function') window.showToast(title, text);
}

// ---------- Tela ----------
function weekCardHtml(all) {
  const week = runs.weekTotals(todayString(), all);
  return `
    <section class="session-bar run-week">
      <div class="session-info">
        <div class="session-info-left">
          <span class="session-label">KM NESTA SEMANA</span>
          <span class="session-count">${fmtKm(week.km)}<span class="session-total"> km</span></span>
        </div>
        <div class="workout-timer" aria-label="Tempo correndo nesta semana">${fmtDuration(week.run)}</div>
      </div>
    </section>`;
}

function timeRowHtml(prefix, label, seconds) {
  const min = seconds ? Math.floor(seconds / 60) : '';
  const sec = seconds ? pad2(seconds % 60) : '';
  return `
    <div class="run-time-row">
      <span class="run-time-label">${label}</span>
      <input type="number" inputmode="numeric" enterkeyhint="next" id="${prefix}Min" value="${min}" placeholder="0" aria-label="${label}: minutos">
      <span class="run-unit">min</span>
      <input type="number" inputmode="numeric" enterkeyhint="next" id="${prefix}Sec" value="${sec}" placeholder="00" aria-label="${label}: segundos">
      <span class="run-unit">seg</span>
    </div>`;
}

function formHtml(run) {
  const today = todayString();
  return `
    <section class="body-card run-form ${run ? 'editing' : ''}" aria-label="${run ? 'Editar corrida' : 'Nova corrida'}">
      <div class="body-card-title">${run ? `Editando · ${shortDate(run.d)}` : 'Nova corrida'}</div>
      <div class="input-row">
        <div class="input-group"><label for="runKm">Distância (km)</label><input type="number" inputmode="decimal" enterkeyhint="next" id="runKm" value="${run ? run.km : ''}" placeholder="5"></div>
      </div>
      ${timeRowHtml('runRun', 'Correndo', run ? run.s : 0)}
      ${timeRowHtml('runWalk', 'Andando', run ? run.w : 0)}
      <div class="run-pace" id="runPace" aria-live="polite">Ritmo médio —</div>
      <div class="run-extra">
        <label class="run-field"><span>Data</span><input type="date" id="runDate" class="notes-input" value="${run ? run.d : today}" max="${today}"></label>
        <label class="run-field grow"><span>Observação</span><input type="text" id="runNote" class="notes-input" maxlength="80" value="${run ? escapeText(run.n) : ''}" placeholder="Ex: parque, esteira..."></label>
      </div>
      <button type="button" class="save-btn" id="runSave">${run ? 'Salvar alterações' : 'Registrar corrida'}</button>
      ${run ? `<div class="set-edit-links">
        <button type="button" class="set-edit-link danger" id="runDelete">Apagar corrida</button>
        <button type="button" class="set-edit-link" id="runCancel">Cancelar</button>
      </div>` : ''}
    </section>`;
}

function runRowHtml(run) {
  return `
    <button type="button" class="run-row ${run.t === editing ? 'active' : ''}" data-run="${run.t}" aria-label="Editar corrida de ${formatDateBR(run.d)}">
      <span class="run-row-left">
        <span class="run-row-date">${shortDate(run.d)}</span>
        <span class="run-row-times">${timesText(run)}</span>
        ${run.n ? `<span class="run-row-note">${escapeText(run.n)}</span>` : ''}
      </span>
      <span class="run-row-right">
        <span class="run-row-km">${fmtKm(run.km)} km</span>
        <span class="run-row-sub">${fmtPace(runs.paceOf(run))}/km · ${fmtSpeed(runs.speedOf(run))} km/h</span>
      </span>
    </button>`;
}

function listHtml(all) {
  if (all.length === 0) {
    return `<div class="run-list-empty">${emptyStateHtml('list', 'Nenhuma corrida ainda', 'Registre a primeira corrida acima.')}</div>`;
  }
  const visible = showAll ? all : all.slice(0, LIST_VISIBLE);
  const hidden = all.length - visible.length;
  return `
    <div class="evo-list-label">Corridas</div>
    <div class="run-list">${visible.map(runRowHtml).join('')}</div>
    ${hidden > 0 ? `<button type="button" class="evo-show-more-btn" id="runMore">Ver ${hidden} corrida${hidden > 1 ? 's' : ''} mais antiga${hidden > 1 ? 's' : ''}</button>` : ''}`;
}

// Desenha a tela inteira (ao abrir a Corrida, ao trocar de dia ou ao editar).
export function renderRun() {
  if (!root) return;
  const all = runs.loadRuns();
  const run = editing ? all.find(r => r.t === editing) : null;
  if (!run) editing = null;
  root.innerHTML = `${weekCardHtml(all)}<div id="runFormWrap">${formHtml(run)}</div><div id="runListWrap">${listHtml(all)}</div>`;
  bindForm();
}

// Ao sair da Corrida (Superior/Inferior), o formulário volta a ser "Nova corrida".
export function leaveRun() {
  editing = null;
  showAll = false;
}

function readTime(prefix) {
  return Math.round(parseNum($(`${prefix}Min`).value) * 60 + parseNum($(`${prefix}Sec`).value));
}

function readForm() {
  return { km: parseNum($('runKm').value), run: readTime('runRun'), walk: readTime('runWalk') };
}

function markMissing(input, title, text) {
  input.classList.remove('input-missing');
  void input.offsetWidth;
  input.classList.add('input-missing');
  input.focus();
  toast(title, text);
}

function showPace() {
  const { km, run, walk } = readForm();
  const total = run + walk;
  const pace = $('runPace');
  const ready = km > 0 && total > 0;
  pace.textContent = ready
    ? `Total ${fmtDuration(total)} · ritmo médio ${fmtPace(total / km)}/km · ${fmtSpeed(km / (total / 3600))} km/h`
    : 'Ritmo médio —';
  pace.classList.toggle('ready', ready);
}

function bindForm() {
  const order = ['runKm', 'runRunMin', 'runRunSec', 'runWalkMin', 'runWalkSec'];
  order.forEach((id, i) => {
    const input = $(id);
    input.addEventListener('input', () => { input.classList.remove('input-missing'); showPace(); });
    input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
    // "próximo" no teclado vai para o campo seguinte; no último, registra.
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i < order.length - 1) $(order[i + 1]).focus();
      else { input.blur(); $('runSave').click(); }
    });
  });
  $('runSave').addEventListener('click', saveForm);
  const del = $('runDelete');
  if (del) del.addEventListener('click', deleteEditing);
  const cancel = $('runCancel');
  if (cancel) cancel.addEventListener('click', () => { editing = null; renderRun(); });
  showPace();
}

let lastSaveAt = 0;
function saveForm() {
  const { km, run, walk } = readForm();
  if (!(km > 0 && km <= runs.MAX_KM)) return markMissing($('runKm'), 'Falta preencher', 'Digite a distância em km.');
  if (!(run + walk > 0 && run + walk <= runs.MAX_SECONDS)) return markMissing($('runRunMin'), 'Falta preencher', 'Digite o tempo correndo (e o andando, se teve).');
  // Toque duplo sem querer não registra a mesma corrida duas vezes.
  if (!editing && Date.now() - lastSaveAt < 1000) return;
  lastSaveAt = Date.now();
  const today = todayString();
  const dateValue = $('runDate').value;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) && dateValue <= today ? dateValue : today;
  const data = { date, km, run, walk, note: $('runNote').value };

  if (editing) {
    runs.updateRun(editing, data);
    editing = null;
    toast('Corrida atualizada', `${fmtKm(runs.roundKm(km))} km de ${formatDateBR(date)}.`);
  } else {
    const prev = runs.records();
    const saved = runs.addRun(data);
    if (navigator.vibrate) navigator.vibrate(40);
    const summary = `${fmtKm(saved.km)} km · ${fmtPace(runs.paceOf(saved))}/km · ${fmtSpeed(runs.speedOf(saved))} km/h`;
    // Recorde só quando já havia corrida para comparar.
    if (prev && saved.km > prev.longest.km) toast('🏆 Maior distância!', `${summary} (antes ${fmtKm(prev.longest.km)} km).`);
    else if (prev && prev.fastest && saved.km >= runs.PACE_MIN_KM && runs.paceOf(saved) < runs.paceOf(prev.fastest)) toast('🏆 Melhor ritmo!', `${summary} (antes ${fmtPace(runs.paceOf(prev.fastest))}/km).`);
    else toast('Corrida registrada', summary);
  }
  renderRun();
  hooks.onChange();
}

async function deleteEditing() {
  const run = runs.loadRuns().find(r => r.t === editing);
  if (!run) return;
  const ok = await confirmDialog({
    title: 'Apagar esta corrida?',
    text: `${fmtKm(run.km)} km de ${formatDateBR(run.d)} sai da lista, do calendário e do progresso.`,
    confirmLabel: 'Apagar corrida',
    danger: true
  });
  if (!ok) return;
  runs.removeRun(run.t);
  editing = null;
  renderRun();
  hooks.onChange();
  toast('Corrida apagada', `${fmtKm(run.km)} km de ${formatDateBR(run.d)}.`);
}

function onRootClick(e) {
  if (e.target.closest('#runMore')) {
    showAll = true;
    $('runListWrap').innerHTML = listHtml(runs.loadRuns());
    return;
  }
  const row = e.target.closest('[data-run]');
  if (!row) return;
  const t = Number(row.dataset.run);
  editing = editing === t ? null : t;
  renderRun();
  if (editing) $('runFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Detalhe do dia (calendário da Academia) ----------
export function dayRunsHtml(date) {
  const list = runs.runsByDate().get(date) || [];
  return list.map(run => `
    <div class="day-detail-ex run-day-item">
      <div class="day-detail-ex-head">
        <div class="day-detail-ex-name">${fmtKm(run.km)} km</div>
        <span class="day-trend">${fmtPace(runs.paceOf(run))}/km · ${fmtSpeed(runs.speedOf(run))} km/h</span>
      </div>
      <div class="run-day-times">${timesText(run)}${run.n ? ` · ${escapeText(run.n)}` : ''}</div>
    </div>`).join('');
}

// ---------- Progresso ----------
const CHART_W = 340;
const CHART_H = 180;

function weekBarsSvg(weeks) {
  const PAD_TOP = 22, PAD_BOTTOM = 24, PAD_LEFT = 30, PAD_RIGHT = 8;
  const innerW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(...weeks.map(w => w.km), 1);
  const ticks = niceTicks(0, max * 1.1, { target: 3 });
  const top = Math.max(ticks[ticks.length - 1], max);
  const yFor = v => PAD_TOP + innerH - (v / top) * innerH;
  const slot = innerW / weeks.length;
  const barW = Math.min(18, slot * 0.6);
  let html = ticks.map(v => `<line x1="${PAD_LEFT}" x2="${CHART_W - PAD_RIGHT}" y1="${yFor(v).toFixed(1)}" y2="${yFor(v).toFixed(1)}" stroke="rgba(255,255,255,0.05)"/><text x="${PAD_LEFT - 6}" y="${(yFor(v) + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="var(--text-faint)">${v}</text>`).join('');
  weeks.forEach((w, i) => {
    const x = PAD_LEFT + slot * i + (slot - barW) / 2;
    const y = yFor(w.km);
    const current = i === weeks.length - 1;
    if (w.km > 0) {
      html += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(PAD_TOP + innerH - y).toFixed(1)}" rx="4" fill="var(--run-color)" opacity="${current ? 1 : 0.7}"/>`;
      html += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="var(--text-dim)">${fmtKm(Math.round(w.km))}</text>`;
    }
    if (i % 3 === (weeks.length - 1) % 3) {
      const [, m, d] = w.start.split('-');
      html += `<text x="${(x + barW / 2).toFixed(1)}" y="${CHART_H - 6}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${d}/${m}</text>`;
    }
  });
  return `<svg viewBox="0 0 ${CHART_W} ${CHART_H}" class="evo-chart-svg" role="img" aria-label="Km por semana">${html}</svg>`;
}

// Ritmo médio por corrida, mais rápido em cima (linha subindo = melhorando).
function paceLineSvg(list) {
  const PAD_TOP = 18, PAD_BOTTOM = 24, PAD_LEFT = 38, PAD_RIGHT = 14;
  const innerW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const paces = list.map(runs.paceOf);
  let min = Math.min(...paces);
  let max = Math.max(...paces);
  if (max - min < 20) { min -= 10; max += 10; }
  const yFor = p => PAD_TOP + ((p - min) / (max - min)) * innerH;
  const xFor = i => (list.length === 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + (i / (list.length - 1)) * innerW);
  const span = (max - min) / 3;
  const step = span > 60 ? 120 : span > 30 ? 60 : span > 10 ? 15 : 5;
  let html = '';
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    html += `<line x1="${PAD_LEFT}" x2="${CHART_W - PAD_RIGHT}" y1="${yFor(v).toFixed(1)}" y2="${yFor(v).toFixed(1)}" stroke="rgba(255,255,255,0.05)"/><text x="${PAD_LEFT - 6}" y="${(yFor(v) + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="var(--text-faint)">${fmtPace(v)}</text>`;
  }
  const pts = list.map((r, i) => `${xFor(i).toFixed(1)},${yFor(paces[i]).toFixed(1)}`);
  if (list.length > 1) html += `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--run-color)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  const best = paces.indexOf(Math.min(...paces));
  list.forEach((r, i) => {
    html += `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(paces[i]).toFixed(1)}" r="${i === best ? 5 : 3.5}" fill="${i === best ? 'var(--run-color)' : 'var(--bg)'}" stroke="var(--run-color)" stroke-width="2"><title>${formatDateBR(r.d)}: ${fmtPace(paces[i])}/km</title></circle>`;
  });
  [...new Set([0, list.length - 1])].forEach(i => {
    const [, m, d] = list[i].d.split('-');
    html += `<text x="${xFor(i).toFixed(1)}" y="${CHART_H - 6}" text-anchor="${list.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${d}/${m}</text>`;
  });
  return `<svg viewBox="0 0 ${CHART_W} ${CHART_H}" class="evo-chart-svg" role="img" aria-label="Ritmo por corrida">${html}</svg>`;
}

function progressHtml() {
  const all = runs.loadRuns();
  if (all.length === 0) return emptyStateHtml('chart', 'Sem corridas ainda', 'Registre suas corridas para ver o progresso aqui.');
  const total = runs.totals(all);
  const rec = runs.records(all);
  const recRows = [
    `<div class="summary-pr-row"><span>Maior distância</span><span class="summary-pr-value">${fmtKm(rec.longest.km)} km<span class="summary-pr-prev">${formatDateBR(rec.longest.d)}</span></span></div>`,
    rec.fastest ? `<div class="summary-pr-row"><span>Melhor ritmo médio</span><span class="summary-pr-value">${fmtPace(runs.paceOf(rec.fastest))}/km<span class="summary-pr-prev">${fmtKm(rec.fastest.km)} km · ${formatDateBR(rec.fastest.d)}</span></span></div>` : ''
  ].join('');
  // Ritmo das últimas 20 corridas de pelo menos 1 km, da mais antiga para a mais nova.
  const paced = all.filter(r => r.km >= runs.PACE_MIN_KM).slice(0, 20).reverse();
  // Num bloco próprio: direto no container flexível, os cartões dos gráficos
  // encolhiam e cortavam o desenho.
  return `<div class="run-progress">
    <div class="evo-summary">
      <div class="evo-stat"><div class="evo-stat-value">${total.count}</div><div class="evo-stat-label">${total.count === 1 ? 'Corrida' : 'Corridas'}</div></div>
      <div class="evo-stat evo-stat-hero"><div class="evo-stat-value">${fmtKm(Math.round(total.km * 10) / 10)}<span class="evo-stat-unit">km</span></div><div class="evo-stat-label">No total</div></div>
      <div class="evo-stat"><div class="evo-stat-value">${fmtDuration(total.run)}</div><div class="evo-stat-label">Correndo</div></div>
    </div>
    ${total.walk > 0 ? `<p class="run-walk-total">E mais ${fmtDuration(total.walk)} andando</p>` : ''}
    <div class="summary-prs"><div class="summary-prs-label">🏆 Recordes</div>${recRows}</div>
    <div class="evo-list-label">Km por semana</div>
    <div class="evo-chart-card"><div class="evo-chart-scroll">${weekBarsSvg(runs.weeklyKm(todayString(), 12, all))}</div></div>
    ${paced.length >= 2 ? `<div class="evo-list-label">Ritmo médio por corrida (min/km)</div><div class="evo-chart-card"><div class="evo-chart-scroll">${paceLineSvg(paced)}</div></div>` : ''}
  </div>`;
}

export function openRunProgress() {
  $('runStatsContent').innerHTML = progressHtml();
  $('runStatsModal').classList.add('visible');
  $('runStatsContent').scrollTop = 0;
}

// onChange: corrida registrada, corrigida ou apagada (o app atualiza o
// subtítulo, o botão "Corrida" e o calendário).
export function initRun(options = {}) {
  if (!root) return;
  hooks = { ...hooks, ...options };
  // Registrado uma vez no container (o conteúdo é redesenhado a cada mudança).
  root.addEventListener('click', onRootClick);
  $('closeRunStats').addEventListener('click', () => $('runStatsModal').classList.remove('visible'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('runStatsModal').classList.remove('visible'); });
}
