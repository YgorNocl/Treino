import { dbFirestore, syncId, setSyncId, syncToCloud, MEDIA_BASE, db, workoutData, SETS_PER_EXERCISE, days } from './data.js';
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { closeRestOverlay, initRestTimer, startRestFor } from './rest-timer.js';
import { pad2, todayString, yesterdayString, parseNum, safeId, unitLabel, formatLoad, estimatedMax, formatDateBR, formatDateShortBR, dateStrFromDate, getWeekStart, getWeekEnd } from './utils.js';
import { musclesHtml, bodyMapHtml, regionLevels } from './body-map.js';

// As chaves "Treino A/B" continuam sendo usadas no armazenamento (histórico,
// séries, sessões); na tela cada treino aparece pelo grupo muscular.
const GROUP_LABELS = { upper: 'Superior', lower: 'Inferior' };
const GROUP_ORDER = ['upper', 'lower'];
const orderedDays = [...days].sort((a, b) => GROUP_ORDER.indexOf(workoutData[a].group) - GROUP_ORDER.indexOf(workoutData[b].group));
function dayLabel(day) { return (workoutData[day] && GROUP_LABELS[workoutData[day].group]) || day; }

const LAST_DAY_KEY = 'gym:lastDay';
let currentDay = days.includes(localStorage.getItem(LAST_DAY_KEY)) ? localStorage.getItem(LAST_DAY_KEY) : orderedDays[0];
let expandedExerciseId = null;
let evoSelectedExercise = null;
let evoRangeMonths = 3;
let evoSelectedUnit = null;
let volumeWeekOffset = 0; // 0 = semana atual, -1 = semana anterior, etc.
let activeBodyMetric = 'weight';
const bodyMetricsMap = {
    weight: { label: 'Peso', unit: 'kg' },
    arm: { label: 'Braço', unit: 'cm' },
    chest: { label: 'Peito', unit: 'cm' },
    waist: { label: 'Cintura', unit: 'cm' },
    thigh: { label: 'Coxa', unit: 'cm' },
    calf: { label: 'Panturr.', unit: 'cm' }
};

const daySelectorsContainer = document.getElementById('daySelectors');
const exerciseListContainer = document.getElementById('exerciseList');
const sessionCountEl = document.getElementById('sessionCount');
const sessionFillEl = document.getElementById('sessionFill');
const statsSheet = document.getElementById('statsSheet');
const sheetBackdrop = document.getElementById('sheetBackdrop');
const statsBody = document.getElementById('statsBody');
const evolutionBody = document.getElementById('evolutionBody');
const catalogoBody = document.getElementById('catalogoBody');
const volumeBody = document.getElementById('volumeBody');
const headerTitle = document.getElementById('headerTitle');
const headerSubtitle = document.getElementById('headerSubtitle');
const catalogModal = document.getElementById('catalogModal');
const catalogModalContent = document.getElementById('catalogModalContent');
const configModal = document.getElementById('configModal');
const calendarModal = document.getElementById('calendarModal');
const calendarModalContent = document.getElementById('calendarModalContent');
const dayDetailModal = document.getElementById('dayDetailModal');
const dayDetailTitle = document.getElementById('dayDetailTitle');
const dayDetailBody = document.getElementById('dayDetailBody');

function storageKey(day, exercise) { return `treino:${safeId(day)}:${safeId(exercise)}`; }
function historyKey(exercise) { return `historico:${safeId(exercise)}`; }

// Data "lógica" do treino: se existe uma sessão de `day` iniciada ontem e ainda
// não finalizada (ex: começou às 22h e virou meia-noite), tudo que for
// registrado agora continua contando como parte do dia em que a sessão começou.
// Sem sessão ativa de ontem, cai no comportamento normal (data de hoje).
function sessionDateFor(day) {
  const stored = localStorage.getItem(`sessaoAtivaData:${safeId(day)}`);
  return stored || todayString();
}

function ensureFreshSessionAnchor(day) {
  const activeKey = `sessaoAtivaData:${safeId(day)}`;
  const stored = localStorage.getItem(activeKey);
  if (!stored) return;
  const isCompleted = getCompletedDays().some(c => c && c.day === day && c.date === stored);
  const diffDays = Math.floor((new Date(todayString()) - new Date(stored)) / (1000 * 60 * 60 * 24));
  if (isCompleted || diffDays > 1) {
    localStorage.removeItem(activeKey);
  }
}

function setsKey(day, exercise) { return `series:${safeId(day)}:${safeId(exercise)}:${sessionDateFor(day)}`; }
function sessionStartKey(day) { return `sessaoInicio:${safeId(day)}:${sessionDateFor(day)}`; }
function sessionEndKey(day) { return `sessaoFim:${safeId(day)}:${sessionDateFor(day)}`; }

// Retorna o início (domingo) da semana calendário que contém `dateStr` (YYYY-MM-DD),
// deslocado por `offset` semanas (offset negativo = semanas anteriores).
function trySync() {
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

function updateSyncStatus(state) {
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

function checkAutoReset() {
  let cs = localStorage.getItem('cycleStart');
  if (!cs) {
    cs = todayString();
    localStorage.setItem('cycleStart', cs);
    trySync();
  } else {
    const start = new Date(cs);
    const now = new Date(todayString());
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    if (diff >= 7) {
      localStorage.setItem('cycleStart', todayString());
      localStorage.setItem('completedDays', '[]');
      trySync();
    }
  }
}

function getCompletedDays() { return JSON.parse(localStorage.getItem('completedDays') || '[]'); }

function calculateStreak() {
  const allCompleted = JSON.parse(localStorage.getItem('allCompletedDates') || '[]');
  if (allCompleted.length === 0) return 0;
  const dates = [...new Set(allCompleted)].sort().reverse();
  const today = new Date(todayString());
  const diffFromToday = Math.round((today - new Date(dates[0])) / (1000 * 60 * 60 * 24));
  if (diffFromToday > 1) return 0;
  let streak = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const current = new Date(dates[i]);
    const next = new Date(dates[i + 1]);
    const gap = Math.round((current - next) / (1000 * 60 * 60 * 24));
    if (gap <= 2) streak++; else break;
  }
  return streak;
}

function updateHeaderTitle() {
  headerTitle.innerText = dayLabel(currentDay);
  // Conta os mesmos dias que aparecem marcados no calendário.
  const weekStart = getWeekStart(todayString());
  let count = 0;
  getLoggedWorkoutsByDate().forEach((_, date) => { if (date >= weekStart) count += 1; });
  headerSubtitle.innerText = `🔥 ${count} treino${count !== 1 ? 's' : ''} nesta semana`;
}

function saveCompletedDay(day) {
  const logDate = sessionDateFor(day);
  const completed = getCompletedDays();
  if (!completed.find(c => c && c.day === day && c.date === logDate)) {
    completed.push({ day, date: logDate });
    localStorage.setItem('completedDays', JSON.stringify(completed));
  }
  const allDates = JSON.parse(localStorage.getItem('allCompletedDates') || '[]');
  if (!allDates.includes(logDate)) {
    allDates.push(logDate);
    localStorage.setItem('allCompletedDates', JSON.stringify(allDates));
  }
  const allTime = JSON.parse(localStorage.getItem('completedDaysAllTime') || '[]');
  if (!allTime.find(c => c && c.day === day && c.date === logDate)) {
    allTime.push({ day, date: logDate });
    localStorage.setItem('completedDaysAllTime', JSON.stringify(allTime.slice(-200)));
  }
  trySync();
  updateHeaderTitle();
}

function markSessionStarted(day) {
  const activeKey = `sessaoAtivaData:${safeId(day)}`;
  if (!localStorage.getItem(activeKey)) {
    localStorage.setItem(activeKey, todayString());
  }
  const key = sessionStartKey(day);
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, String(Date.now()));
    trySync();
  }
}

function getSessionDurationLabel(day) {
  const startRaw = localStorage.getItem(sessionStartKey(day));
  if (!startRaw) return null;
  let endTime = Date.now();
  const endRaw = localStorage.getItem(sessionEndKey(day));
  if (endRaw) endTime = Number(endRaw);
  const minutes = Math.max(0, Math.round((endTime - Number(startRaw)) / 60000));
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

// Mantém a tela acesa enquanto um treino da academia está em andamento. O
// navegador solta o bloqueio sozinho quando o app sai da tela; o timer de 1s
// pede de novo quando você volta.
const SCREEN_AWAKE_MAX_MS = 3 * 60 * 60 * 1000;
let screenWakeLock = null;
let screenWakeLockPending = false;

function setScreenAwake(on) {
  if (!('wakeLock' in navigator)) return;
  if (!on) {
    if (screenWakeLock) screenWakeLock.release().catch(() => {});
    screenWakeLock = null;
    return;
  }
  if (screenWakeLock || screenWakeLockPending || document.visibilityState !== 'visible') return;
  screenWakeLockPending = true;
  navigator.wakeLock.request('screen')
    .then(lock => {
      screenWakeLock = lock;
      lock.addEventListener('release', () => { if (screenWakeLock === lock) screenWakeLock = null; });
    })
    .catch(() => {})
    .finally(() => { screenWakeLockPending = false; });
}

function isGymModeActive() {
  return !document.body.classList.contains('mode-cali') && !document.body.classList.contains('mode-mobi');
}

function updateLiveTimer() {
  const timerEl = document.getElementById('workoutTimer');
  if (!timerEl) return;
  const startRaw = localStorage.getItem(sessionStartKey(currentDay));

  if (!startRaw) {
    timerEl.innerText = "00:00";
    timerEl.style.color = "var(--accent)";
    timerEl.style.borderColor = "var(--accent-dim)";
    setScreenAwake(false);
    return;
  }

  let endTime = Date.now();
  const endRaw = localStorage.getItem(sessionEndKey(currentDay));
  const isCompletedToday = getCompletedDays().some(c => c && c.day === currentDay && c.date === sessionDateFor(currentDay));
  const isLive = !endRaw && !isCompletedToday && Date.now() - Number(startRaw) < SCREEN_AWAKE_MAX_MS;
  setScreenAwake(isLive && isGymModeActive());

  if (endRaw) {
    endTime = Number(endRaw);
    timerEl.style.color = "var(--text-dim)";
    timerEl.style.borderColor = "var(--card-border)";
  } else if (isCompletedToday) {
    localStorage.setItem(sessionEndKey(currentDay), String(Date.now()));
    endTime = Date.now();
    timerEl.style.color = "var(--text-dim)";
    timerEl.style.borderColor = "var(--card-border)";
  } else {
    timerEl.style.color = "var(--accent)";
    timerEl.style.borderColor = "var(--accent-dim)";
  }

  const diffSeconds = Math.max(0, Math.floor((endTime - Number(startRaw)) / 1000));
  const h = Math.floor(diffSeconds / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  const s = diffSeconds % 60;
  
  if (h > 0) {
    timerEl.innerText = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  } else {
    timerEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
setInterval(updateLiveTimer, 1000);

function updateFinishButtonState() {
  const btn = document.getElementById('finishDayBtn');
  if (!btn) return;
  const completed = getCompletedDays();
  const isDone = completed.find(c => c && c.day === currentDay && c.date === sessionDateFor(currentDay));
  if (isDone) {
    btn.innerText = "Treino Finalizado ✓";
    btn.disabled = true;
    btn.classList.add('finished');
  } else {
    btn.innerText = "Finalizar Treino Atual";
    btn.disabled = false;
    btn.classList.remove('finished');
  }
}

function buildWorkoutSummary(day) {
  const logDate = sessionDateFor(day);
  const exercises = workoutData[day].exercises;
  let totalSets = 0;
  const prsToday = [];
  exercises.forEach(ex => {
    const setsCompleted = getSetsCompleted(day, ex);
    totalSets += setsCompleted.length;
    const history = loadHistory(ex);
    const todaySets = history.filter(h => h.date === logDate);
    if (todaySets.length === 0) return;
    const todayUnit = todaySets[todaySets.length - 1].unit || 'kg';
    const historyBeforeToday = history.filter(h => h.date !== logDate && (h.unit || 'kg') === todayUnit);
    if (historyBeforeToday.length === 0) return;
    const prevBest = historyBeforeToday.reduce((best, h) => estimatedMax(h.weight, h.reps) > estimatedMax(best.weight, best.reps) ? h : best);
    const bestToday = todaySets.reduce((best, h) => estimatedMax(h.weight, h.reps) > estimatedMax(best.weight, best.reps) ? h : best);
    if (estimatedMax(bestToday.weight, bestToday.reps) > estimatedMax(prevBest.weight, prevBest.reps)) {
      prsToday.push({ exercise: ex, weight: bestToday.weight, reps: bestToday.reps, unit: todayUnit });
    }
  });
  return {
    day,
    totalSets,
    prsToday,
    duration: getSessionDurationLabel(day)
  };
}

function showWorkoutSummary(day) {
  const summary = buildWorkoutSummary(day);
  const modal = document.getElementById('summaryModal');
  const body = document.getElementById('summaryBody');
  if (!modal || !body) return;
  let prsHtml = '';
  if (summary.prsToday.length > 0) {
    prsHtml = `
      <div class="summary-prs">
        <div class="summary-prs-label">🏆 Recordes de hoje</div>
        ${summary.prsToday.map(pr => `<div class="summary-pr-row"><span>${pr.exercise}</span><span class="summary-pr-value">${formatLoad(pr.weight, pr.unit)} × ${pr.reps}</span></div>`).join('')}
      </div>`;
  }
  body.innerHTML = `
    <div class="summary-stats-row">
      <div class="summary-stat"><div class="summary-stat-value">${summary.totalSets}</div><div class="summary-stat-label">Séries</div></div>
      <div class="summary-stat"><div class="summary-stat-value">${summary.duration || '—'}</div><div class="summary-stat-label">Duração</div></div>
      <div class="summary-stat"><div class="summary-stat-value">${summary.prsToday.length}</div><div class="summary-stat-label">PRs</div></div>
    </div>
    ${prsHtml}
  `;
  modal.classList.add('visible');
}

function loadProgress(day, exercise) {
  const raw = localStorage.getItem(storageKey(day, exercise));
  return raw ? JSON.parse(raw) : { weight: '', reps: '', notes: '', unit: getLastUsedUnit(exercise) };
}

function saveProgressData(day, exercise, weight, reps, notes, setIndex, unit) {
  localStorage.setItem(storageKey(day, exercise), JSON.stringify({ weight, reps, notes, unit }));
  const history = loadHistory(exercise);
  const logDate = sessionDateFor(day);
  const entry = { date: logDate, weight: parseNum(weight), reps: parseNum(reps), setIndex, notes: notes || '', unit: unit || 'kg' };
  const existingIdx = history.findIndex(h => h.date === logDate && h.setIndex === setIndex);
  if (existingIdx >= 0) {
    history[existingIdx] = entry;
  } else {
    history.push(entry);
  }
  localStorage.setItem(historyKey(exercise), JSON.stringify(history.slice(-300)));
  trySync();
}

function loadHistory(exercise) {
  const history = JSON.parse(localStorage.getItem(historyKey(exercise)) || '[]');
  // Compatibilidade com registros salvos antes de existir a unidade: assume kg.
  return history.map(h => ({ unit: 'kg', ...h }));
}
function getSetsCompleted(day, exercise) { return JSON.parse(localStorage.getItem(setsKey(day, exercise)) || '[]'); }
function bestSetOf(sets) {
  return sets.reduce((best, h) => estimatedMax(h.weight, h.reps) > estimatedMax(best.weight, best.reps) ? h : best);
}

function describeLoadDelta(cur, prev, unit) {
  const sign = n => (n > 0 ? '+' : '-');
  if (cur.weight !== prev.weight) {
    const diff = cur.weight - prev.weight;
    return { dir: diff > 0 ? 'up' : 'down', text: `${sign(diff)}${formatLoad(Math.round(Math.abs(diff) * 100) / 100, unit)}` };
  }
  if (cur.reps !== prev.reps) {
    const diff = cur.reps - prev.reps;
    return { dir: diff > 0 ? 'up' : 'down', text: `${sign(diff)}${Math.abs(diff)} rep${Math.abs(diff) === 1 ? '' : 's'}` };
  }
  return { dir: 'same', text: 'igual' };
}

// Evolução do exercício num dia: melhor set, se bateu PR (superou todo o
// histórico anterior) e a comparação com a sessão anterior — sempre na mesma unidade.
function getDayProgress(exercise, dateStr) {
  const history = loadHistory(exercise);
  const daySets = history.filter(h => h.date === dateStr);
  if (daySets.length === 0) return null;
  const unit = daySets[daySets.length - 1].unit || 'kg';
  const best = bestSetOf(daySets.filter(h => (h.unit || 'kg') === unit));
  const prior = history.filter(h => h.date < dateStr && (h.unit || 'kg') === unit);
  if (prior.length === 0) return { unit, best, isFirst: true, isPR: false };
  const prevRecord = bestSetOf(prior);
  const prevDate = prior.reduce((latest, h) => (h.date > latest ? h.date : latest), prior[0].date);
  return {
    unit,
    best,
    isFirst: false,
    isPR: estimatedMax(best.weight, best.reps) > estimatedMax(prevRecord.weight, prevRecord.reps),
    prevRecord,
    prevDate,
    delta: describeLoadDelta(best, bestSetOf(prior.filter(h => h.date === prevDate)), unit)
  };
}

function dayTrendHtml(progress) {
  if (!progress) return '';
  if (progress.isFirst) return '<span class="day-trend">1º registro</span>';
  if (progress.isPR) return '<span class="day-trend pr">🏆 PR</span>';
  const arrow = { up: '↑', down: '↓', same: '=' }[progress.delta.dir];
  return `<span class="day-trend ${progress.delta.dir}">${arrow} ${progress.delta.text} <span class="day-trend-vs">vs ${formatDateShortBR(progress.prevDate)}</span></span>`;
}

// Soma o volume (peso x reps) das séries em kg feitas naquele dia.
// Séries em "placas" ficam de fora por não terem um peso real comparável.
function getDayVolumeKg(exercisesLogged) {
  let total = 0;
  exercisesLogged.forEach(item => {
    item.sets.forEach(s => { if ((s.unit || 'kg') === 'kg') total += s.weight * s.reps; });
  });
  return total;
}

// Unidade usada na última série registrada desse exercício (qualquer dia),
// pra pré-selecionar o toggle e evitar ficar escolhendo toda vez.
function getLastUsedUnit(exercise) {
  const history = loadHistory(exercise);
  if (history.length === 0) return 'kg';
  return history[history.length - 1].unit || 'kg';
}

function getPersonalRecord(exercise, unit) {
  const targetUnit = unit || getLastUsedUnit(exercise);
  const history = loadHistory(exercise).filter(h => (h.unit || 'kg') === targetUnit);
  if (history.length === 0) return null;
  return history.reduce((best, h) => estimatedMax(h.weight, h.reps) > estimatedMax(best.weight, best.reps) ? h : best);
}

function maybeShowSetFeedback(exercise, historyBefore, weight, reps, setIndexBeingCompleted, unit) {
  if (!weight || !reps) return;
  const sameUnitHistory = historyBefore.filter(h => (h.unit || 'kg') === unit);
  const prevBest = sameUnitHistory.length > 0
    ? sameUnitHistory.reduce((best, h) => estimatedMax(h.weight, h.reps) > estimatedMax(best.weight, best.reps) ? h : best)
    : null;
  const isNewPR = prevBest && estimatedMax(weight, reps) > estimatedMax(prevBest.weight, prevBest.reps);
  if (isNewPR) {
    showToast('🏆 Novo recorde pessoal!', `${formatLoad(weight, unit)} × ${reps} supera seu melhor anterior (${formatLoad(prevBest.weight, unit)} × ${prevBest.reps}).`);
    return;
  }
  if (setIndexBeingCompleted === SETS_PER_EXERCISE - 1 && prevBest && reps >= prevBest.reps && weight >= prevBest.weight) {
    showToast('💪 Boa consistência', 'Você manteve ou superou seu último desempenho nesse exercício.');
  }
}

function toggleSet(day, exercise, index) {
  const sets = getSetsCompleted(day, exercise);
  const existing = sets.indexOf(index);
  if (existing >= 0) {
    sets.splice(existing, 1);
    const history = loadHistory(exercise).filter(h => !(h.date === sessionDateFor(day) && h.setIndex === index));
    localStorage.setItem(historyKey(exercise), JSON.stringify(history));
  } else {
    sets.push(index);
  }
  localStorage.setItem(setsKey(day, exercise), JSON.stringify(sets));
  trySync();
  updateExerciseCard(day, exercise);
  updateSessionBar(day);
  renderDaySelectors();
}

function updateSessionBar(day) {
  const exercises = workoutData[day].exercises;
  let done = 0;
  const total = exercises.length * SETS_PER_EXERCISE;
  exercises.forEach(ex => { done += getSetsCompleted(day, ex).length; });
  sessionCountEl.innerHTML = `${done}<span class="session-total">/${total}</span>`;
  sessionFillEl.style.width = `${total > 0 ? (done / total) * 100 : 0}%`;
  updateHeaderTitle();
}

function updateStreakBadge() {
  const streakEl = document.getElementById('streakBadge');
  if (!streakEl) return;
  const streak = calculateStreak();
  if (streak >= 2) {
    streakEl.style.display = 'inline-flex';
    streakEl.innerHTML = `🔥 ${streak} dias seguidos`;
  } else {
    streakEl.style.display = 'none';
  }
}

function loadBodyMetrics() {
    return JSON.parse(localStorage.getItem('bodyMetrics') || '[]');
}

function saveBodyMetrics(dataObj) {
    const metrics = loadBodyMetrics();
    const today = todayString();
    const existingIdx = metrics.findIndex(m => m.date === today);
    if (existingIdx >= 0) {
        metrics[existingIdx] = { ...metrics[existingIdx], ...dataObj };
    } else {
        metrics.push({ date: today, ...dataObj });
    }
    localStorage.setItem('bodyMetrics', JSON.stringify(metrics));
    trySync();
    renderBodyModal();
    showToast('Salvo', 'Medidas atualizadas com sucesso!');
}

function buildMetricChartSVG(metrics, field) {
    const valid = metrics.filter(m => m[field]);
    if (valid.length < 2) {
        return `
        <div class="empty-chart">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                <polyline points="0,30 20,25 40,35 60,15 80,20 100,5" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2,2"/>
            </svg>
            <span>Registre mais dados para ver a evolução</span>
        </div>`;
    }

    const W = 320, H = 140, PAD_TOP = 25, PAD_BOTTOM = 20, PAD_LEFT = 30, PAD_RIGHT = 15;
    const innerH = H - PAD_TOP - PAD_BOTTOM;
    const usableW = W - PAD_LEFT - PAD_RIGHT;

    const vals = valid.map(m => m[field]);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.3;
    min -= pad; max += pad;

    const points = valid.map((m, i) => {
        const x = PAD_LEFT + (i / (valid.length - 1)) * usableW;
        const y = PAD_TOP + innerH - ((m[field] - min) / (max - min)) * innerH;
        return { x, y, val: m[field], date: m.date };
    });

    let gridHtml = '';
    const gridCount = 3;
    for (let g = 0; g <= gridCount; g++) {
        const w = min + (max - min) * (g / gridCount);
        const y = PAD_TOP + innerH - ((w - min) / (max - min)) * innerH;
        gridHtml += `<line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />`;
        gridHtml += `<text x="${(PAD_LEFT - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${w.toFixed(1)}</text>`;
    }

    function smoothPath(pts) {
        if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
        let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i === 0 ? i : i - 1];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
        }
        return d;
    }

    const linePathStr = smoothPath(points);
    let areaPathStr = '';
    if (points.length > 1) {
        areaPathStr = `${linePathStr} L ${points[points.length-1].x.toFixed(1)},${H} L ${points[0].x.toFixed(1)},${H} Z`;
    }

    let dotsHtml = '';
    let labelsHtml = '';
    points.forEach((p, idx) => {
        dotsHtml += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--bg)" stroke="var(--accent)" stroke-width="2" />`;
        dotsHtml += `<text x="${p.x.toFixed(1)}" y="${(p.y - 12).toFixed(1)}" text-anchor="middle" font-family="var(--font-mono)" font-weight="700" font-size="10" fill="var(--accent)">${p.val}</text>`;
        if (idx === 0 || idx === points.length - 1) {
            const [, m, d] = p.date.split('-');
            labelsHtml += `<text x="${p.x.toFixed(1)}" y="${H - 5}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${d}/${m}</text>`;
        }
    });

    return `
    <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); border-radius: 14px; padding: 16px 10px 8px; overflow-x: auto; scrollbar-width: none;">
        <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet" style="min-width: 280px; display: block;">
            <defs>
                <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            ${gridHtml}
            ${areaPathStr ? `<path d="${areaPathStr}" fill="url(#metricGrad)" />` : ''}
            <path d="${linePathStr}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />
            ${dotsHtml}
            ${labelsHtml}
        </svg>
    </div>`;
}

function renderBodyModal() {
    const content = document.getElementById('bodyModalContent');
    const metrics = loadBodyMetrics();
    const latest = metrics.length > 0 ? metrics[metrics.length - 1] : {};
    const first = metrics.length > 0 ? metrics[0] : {};

    function getDeltaHtml(field, invertColors = false) {
        if (!latest[field] || !first[field] || metrics.length < 2) return '<div class="body-delta flat">--</div>';
        const diff = (latest[field] - first[field]).toFixed(1);
        if (diff == 0) return `<div class="body-delta flat">Sem alteração</div>`;
        const isPos = diff > 0;
        let colorClass = isPos ? 'pos' : 'neg';
        if (invertColors) colorClass = isPos ? 'neg' : 'pos';
        return `<div class="body-delta ${colorClass}">${isPos ? '+' : ''}${diff} desde o início</div>`;
    }

    function getWeightDeltaHtml() {
        if (!latest.weight || !first.weight || metrics.length < 2) return '';
        const diff = (latest.weight - first.weight).toFixed(1);
        if (diff == 0) return `<div class="body-delta flat">= Início</div>`;
        const isPos = diff > 0;
        return `<div class="body-delta ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : ''}${Math.abs(diff)}kg desde o início</div>`;
    }

    function getMiniSpark(field) {
        const valid = metrics.filter(m => m[field]);
        if (valid.length < 2) return '';
        const vals = valid.map(m => m[field]);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = (max - min) || 1;
        const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - (((v - min) / range) * 80 + 10)}`);
        return `<div class="body-spark"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="4"/></svg></div>`;
    }

    let tabsHtml = `<div class="sheet-tabs" id="bodyChartTabs" style="margin-bottom: 8px; border: 1px solid var(--card-border); background: rgba(0,0,0,0.2);">`;
    for (const key in bodyMetricsMap) {
        tabsHtml += `<button class="sheet-tab ${activeBodyMetric === key ? 'active' : ''}" data-metric="${key}">${bodyMetricsMap[key].label}</button>`;
    }
    tabsHtml += `</div>`;

    content.innerHTML = `
        <div class="body-card" style="padding: 0; background: transparent; border: none;">
            <div class="weight-hero">
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Peso Corporal (kg)</span>
                <div class="weight-input-box">
                    <input type="number" inputmode="decimal" id="bm-weight" value="${latest.weight || ''}" placeholder="--">
                </div>
                ${getWeightDeltaHtml()}
            </div>
            
            ${tabsHtml}
            
            <div id="bodyMainChartContainer">
                ${buildMetricChartSVG(metrics, activeBodyMetric)}
            </div>
        </div>

        <div class="body-card" style="margin-top: 16px;">
            <div class="body-card-title">Circunferências</div>
            <div class="body-grid">
                <div class="body-input-group">
                    <label>Braço</label>
                    <div class="body-input-row">
                        <input type="number" inputmode="decimal" id="bm-arm" value="${latest.arm || ''}" placeholder="--">
                        <span class="body-input-unit">cm</span>
                    </div>
                    ${getDeltaHtml('arm')}
                    ${getMiniSpark('arm')}
                </div>
                <div class="body-input-group">
                    <label>Peito</label>
                    <div class="body-input-row">
                        <input type="number" inputmode="decimal" id="bm-chest" value="${latest.chest || ''}" placeholder="--">
                        <span class="body-input-unit">cm</span>
                    </div>
                    ${getDeltaHtml('chest')}
                    ${getMiniSpark('chest')}
                </div>
                <div class="body-input-group">
                    <label>Cintura</label>
                    <div class="body-input-row">
                        <input type="number" inputmode="decimal" id="bm-waist" value="${latest.waist || ''}" placeholder="--">
                        <span class="body-input-unit">cm</span>
                    </div>
                    ${getDeltaHtml('waist', true)}
                    ${getMiniSpark('waist')}
                </div>
                <div class="body-input-group">
                    <label>Coxa</label>
                    <div class="body-input-row">
                        <input type="number" inputmode="decimal" id="bm-thigh" value="${latest.thigh || ''}" placeholder="--">
                        <span class="body-input-unit">cm</span>
                    </div>
                    ${getDeltaHtml('thigh')}
                    ${getMiniSpark('thigh')}
                </div>
                <div class="body-input-group" style="grid-column: span 2;">
                    <label>Panturrilha</label>
                    <div class="body-input-row">
                        <input type="number" inputmode="decimal" id="bm-calf" value="${latest.calf || ''}" placeholder="--">
                        <span class="body-input-unit">cm</span>
                    </div>
                    ${getDeltaHtml('calf')}
                    ${getMiniSpark('calf')}
                </div>
            </div>
        </div>

        <button class="save-btn" id="saveBodyBtn" style="width: 100%; margin-top: 16px; margin-bottom: 20px;">Salvar Medidas</button>
    `;

    document.getElementById('bodyChartTabs').querySelectorAll('.sheet-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activeBodyMetric = e.target.dataset.metric;
            document.getElementById('bodyChartTabs').querySelectorAll('.sheet-tab').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('bodyMainChartContainer').innerHTML = buildMetricChartSVG(metrics, activeBodyMetric);
        });
    });

    document.getElementById('saveBodyBtn').addEventListener('click', () => {
        const data = {
            weight: parseNum(document.getElementById('bm-weight').value) || null,
            arm: parseNum(document.getElementById('bm-arm').value) || null,
            chest: parseNum(document.getElementById('bm-chest').value) || null,
            waist: parseNum(document.getElementById('bm-waist').value) || null,
            thigh: parseNum(document.getElementById('bm-thigh').value) || null,
            calf: parseNum(document.getElementById('bm-calf').value) || null
        };
        saveBodyMetrics(data);
    });
}

function bindTopBarModals() {
    document.getElementById('configBtn').addEventListener('click', () => {
        if (configModal) configModal.classList.add('visible');
    });
    document.getElementById('closeConfig').addEventListener('click', () => {
        if (configModal) configModal.classList.remove('visible');
    });
    document.getElementById('catalogBtn').addEventListener('click', () => {
        renderCatalogTab();
        if (catalogModal) catalogModal.classList.add('visible');
    });
    document.getElementById('closeCatalog').addEventListener('click', () => {
        if (catalogModal) catalogModal.classList.remove('visible');
    });
    document.getElementById('bodyBtn').addEventListener('click', () => {
        renderBodyModal();
        document.getElementById('bodyModal').classList.add('visible');
    });
    document.getElementById('closeBody').addEventListener('click', () => {
        document.getElementById('bodyModal').classList.remove('visible');
    });
}

function init() {
  checkAutoReset();
  updateHeaderTitle();
  renderDaySelectors();
  renderExercises(currentDay);
  updateSessionBar(currentDay);
  updateStreakBadge();
  updateLiveTimer();
  initRestTimer();
  bindStatsSheet();
  bindBackupSystem();
  bindInfoModal();
  bindSummaryModal();
  bindFinishDay();
  bindTopBarModals();
  bindCalendarModal();
  bindDayDetailModal();
  bindDateFixTool();
}

window.toggleAccordion = function (id, day) {
  expandedExerciseId = expandedExerciseId === id ? null : id;
  exerciseListContainer.querySelectorAll('.exercise-card').forEach(c => {
    const isOpen = c.dataset.cardId === expandedExerciseId;
    c.classList.toggle('expanded', isOpen);
    const header = c.querySelector('.exercise-header');
    if (header) header.setAttribute('aria-expanded', String(isOpen));
  });
};


function hasUnsavedInput() {
  if (!expandedExerciseId) return false;
  const card = exerciseListContainer.querySelector(`[data-card-id="${expandedExerciseId}"]`);
  if (!card) return false;
  const day = card.dataset.day;
  const exercise = card.dataset.exercise;
  const saved = loadProgress(day, exercise);
  const weightInput = card.querySelector(`#weight-${expandedExerciseId}`);
  const repsInput = card.querySelector(`#reps-${expandedExerciseId}`);
  if (!weightInput || !repsInput) return false;
  const w = weightInput.value;
  const r = repsInput.value;
  const savedW = String(saved.weight ?? '');
  const savedR = String(saved.reps ?? '');
  return (w !== '' && w !== savedW) || (r !== '' && r !== savedR);
}

function renderDaySelectors() {
  daySelectorsContainer.innerHTML = '';
  const completedDays = getCompletedDays().map(c => c.day);
  orderedDays.forEach(day => {
    const btn = document.createElement('button');
    const isCompleted = completedDays.includes(day);
    btn.className = `tab-btn ${day === currentDay ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
    btn.innerText = dayLabel(day);
    btn.onclick = () => {
      if (day === currentDay) return;
      if (hasUnsavedInput() && !confirm("Você tem carga/reps digitados que ainda não foram registrados nessa série. Trocar mesmo assim e perder esses valores?")) {
        return;
      }
      currentDay = day;
      localStorage.setItem(LAST_DAY_KEY, day);
      expandedExerciseId = null;
      updateHeaderTitle();
      renderDaySelectors();
      renderExercises(currentDay);
      updateSessionBar(currentDay);
      updateFinishButtonState();
      updateLiveTimer();
    };
    daySelectorsContainer.appendChild(btn);
  });
  updateFinishButtonState();
}

function bindFinishDay() {
  document.getElementById('finishDayBtn').addEventListener('click', () => {
    const completed = getCompletedDays();
    const isDone = completed.find(c => c && c.day === currentDay && c.date === sessionDateFor(currentDay));
    if (isDone) return;
    
    // Trava de segurança para congelar o timer
    localStorage.setItem(sessionEndKey(currentDay), String(Date.now()));
    
    try {
        saveCompletedDay(currentDay);
        renderDaySelectors();
        updateStreakBadge();
        updateFinishButtonState();
        updateLiveTimer(); // Força a atualização do relógio na tela
        showWorkoutSummary(currentDay);
    } catch(e) {
        console.error("Erro interno ao finalizar, forçando UI segura:", e);
        updateFinishButtonState();
        updateLiveTimer();
        showWorkoutSummary(currentDay);
    }
  });
}

function buildExerciseCardHTML(day, exercise) {
  const savedData = loadProgress(day, exercise);
  const currentUnit = savedData.unit || getLastUsedUnit(exercise);
  const setsCompleted = getSetsCompleted(day, exercise);
  const isDone = setsCompleted.length >= SETS_PER_EXERCISE;
  const id = safeId(exercise) + safeId(day);
  const pr = getPersonalRecord(exercise, currentUnit);
  let dotsHtml = '';
  for (let i = 0; i < SETS_PER_EXERCISE; i++) {
    const filled = setsCompleted.includes(i);
    dotsHtml += `<div class="set-dot ${filled ? 'filled' : ''}" data-set-index="${i}">${filled ? '✓' : i + 1}</div>`;
  }
  const notesDisplay = savedData.notes ? 'none' : 'flex';
  const notesVisibleClass = savedData.notes ? 'visible' : '';
  const isExpanded = expandedExerciseId === id;
  const prBadgeHtml = pr ? `<span class="pr-badge" role="button" tabindex="0" onclick="event.stopPropagation(); openEvolutionFor('${exercise.replace(/'/g, "\\'")}')">PR: ${formatLoad(pr.weight, pr.unit || 'kg')}×${pr.reps}</span>` : '';
  const unitToggleHtml = `
            <div class="unit-toggle" id="unitToggle-${id}" role="group" aria-label="Unidade de carga">
              <button type="button" class="unit-toggle-btn ${currentUnit === 'kg' ? 'active' : ''}" data-unit="kg">Kg</button>
              <button type="button" class="unit-toggle-btn ${currentUnit === 'placas' ? 'active' : ''}" data-unit="placas">Placas</button>
            </div>`;

  return `
    <div class="exercise-card ${isDone ? 'done' : ''} ${isExpanded ? 'expanded' : ''}" data-card-id="${id}" data-day="${day}" data-exercise="${exercise}">
      <div class="exercise-header" role="button" tabindex="0" aria-expanded="${isExpanded}" onclick="toggleAccordion('${id}', '${day}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAccordion('${id}', '${day}');}">
        <div class="exercise-info">
          <div class="exercise-title-row">
            <span class="exercise-title">${exercise}</span>
            <div class="exercise-title-actions">
              <button class="info-icon" aria-label="Ver evolução" onclick="event.stopPropagation(); openEvolutionFor('${exercise.replace(/'/g, "\\'")}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              </button>
              <button class="info-icon" aria-label="Ver guia do exercício" onclick="event.stopPropagation(); showExerciseGuide('${exercise.replace(/'/g, "\\'")}')">?</button>
            </div>
          </div>
          <span class="exercise-prog"><span>${setsCompleted.length}/${SETS_PER_EXERCISE} séries concluídas</span>${prBadgeHtml}</span>
        </div>
        <svg class="exercise-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="exercise-wrapper">
        <div class="exercise-body">
          <div class="exercise-inner">
            <div class="set-tracker" id="tracker-${id}">${dotsHtml}</div>
            ${unitToggleHtml}
            <div class="input-row">
              <div class="input-group"><label id="weightLabel-${id}">Carga (${unitLabel(currentUnit)})</label><input type="number" inputmode="decimal" id="weight-${id}" value="${savedData.weight}" placeholder="40"></div>
              <div class="input-group"><label>Reps</label><input type="number" inputmode="numeric" id="reps-${id}" value="${savedData.reps}" placeholder="10"></div>
            </div>
            <div class="card-actions">
              <button class="save-btn" id="save-${id}">Registrar série</button>
              <button class="rest-btn-trigger" id="rest-${id}" aria-label="Iniciar descanso"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></button>
            </div>
            <button class="add-notes-btn" style="display: ${notesDisplay};" id="toggle-notes-${id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>
              Adicionar ajustes de máquina
            </button>
            <div class="notes-row ${notesVisibleClass}" id="notes-container-${id}">
              <input type="text" id="notes-${id}" class="notes-input" placeholder="Ex: banco 4, presilha 2..." value="${savedData.notes || ''}">
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function setCardUnit(id, unit) {
  const toggle = document.getElementById(`unitToggle-${id}`);
  const label = document.getElementById(`weightLabel-${id}`);
  if (toggle) {
    toggle.querySelectorAll('.unit-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.unit === unit);
    });
  }
  if (label) label.innerText = `Carga (${unitLabel(unit)})`;
}

function bindExerciseCardEvents(day, exercise) {
  const id = safeId(exercise) + safeId(day);
  const card = exerciseListContainer.querySelector(`[data-card-id="${id}"]`);
  if (!card) return;
  const unitToggle = card.querySelector(`#unitToggle-${id}`);
  if (unitToggle) {
    unitToggle.querySelectorAll('.unit-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setCardUnit(id, btn.dataset.unit));
    });
  }
  const toggleNotesBtn = card.querySelector(`#toggle-notes-${id}`);
  const notesContainer = card.querySelector(`#notes-container-${id}`);
  if (toggleNotesBtn) {
    toggleNotesBtn.addEventListener('click', () => {
      notesContainer.classList.add('visible');
      toggleNotesBtn.style.display = 'none';
    });
  }
  card.querySelectorAll('.set-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = Number(dot.dataset.setIndex);
      const setsCompleted = getSetsCompleted(day, exercise);
      if (setsCompleted.includes(idx)) {
        toggleSet(day, exercise, idx);
      } else {
        document.getElementById(`save-${id}`).click();
      }
    });
  });
  document.getElementById(`save-${id}`).addEventListener('click', () => {
    const w = document.getElementById(`weight-${id}`).value;
    const r = document.getElementById(`reps-${id}`).value;
    if (!w || !r) return;
    const activeUnitBtn = card.querySelector(`#unitToggle-${id} .unit-toggle-btn.active`);
    const unit = activeUnitBtn ? activeUnitBtn.dataset.unit : 'kg';
    markSessionStarted(day);
    const setsCompleted = getSetsCompleted(day, exercise);
    const notesVal = document.getElementById(`notes-${id}`).value;
    const thisSetIndex = setsCompleted.length;
    const historyBefore = loadHistory(exercise).filter(h => !(h.date === sessionDateFor(day) && h.setIndex === thisSetIndex));
    saveProgressData(day, exercise, w, r, notesVal, thisSetIndex, unit);
    maybeShowSetFeedback(exercise, historyBefore, parseNum(w), parseNum(r), setsCompleted.length, unit);
    expandedExerciseId = id;
    const nextSetIndex = setsCompleted.length;
    if (nextSetIndex < SETS_PER_EXERCISE) {
      toggleSet(day, exercise, nextSetIndex);
      startRestFor(exercise);
    } else {
      updateExerciseCard(day, exercise);
      updateSessionBar(day);
      renderDaySelectors();
    }
  });
  document.getElementById(`rest-${id}`).addEventListener('click', () => { startRestFor(exercise); });
}

function updateExerciseCard(day, exercise) {
  const id = safeId(exercise) + safeId(day);
  const oldCard = exerciseListContainer.querySelector(`[data-card-id="${id}"]`);
  if (!oldCard) { renderExercises(day); return; }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildExerciseCardHTML(day, exercise).trim();
  const newCard = wrapper.firstElementChild;
  oldCard.replaceWith(newCard);
  bindExerciseCardEvents(day, exercise);
}

function renderExercises(day) {
  ensureFreshSessionAnchor(day);
  exerciseListContainer.innerHTML = '';
  const exercises = workoutData[day].exercises;
  if (exercises.length === 0) {
    exerciseListContainer.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding: 40px 0;">Treino em construção.</div>';
    return;
  }
  exerciseListContainer.innerHTML = exercises.map(ex => buildExerciseCardHTML(day, ex)).join('');
  exercises.forEach(ex => bindExerciseCardEvents(day, ex));
}

function bindStatsSheet() {
  document.getElementById('menuBtn').addEventListener('click', () => {
    renderCategorizedStats();
    renderEvolutionTab();
    volumeWeekOffset = 0;
    calculateWeeklyVolume();
    statsSheet.classList.add('visible');
    sheetBackdrop.classList.add('visible');
  });
  document.getElementById('closeStats').addEventListener('click', () => { statsSheet.classList.remove('visible'); sheetBackdrop.classList.remove('visible'); });
  sheetBackdrop.addEventListener('click', () => { statsSheet.classList.remove('visible'); sheetBackdrop.classList.remove('visible'); });
  document.querySelectorAll('.sheet-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      
      if(statsBody) statsBody.style.display = target === 'cargas' ? 'block' : 'none';
      if(evolutionBody) evolutionBody.style.display = target === 'evolucao' ? 'block' : 'none';
      if(volumeBody) volumeBody.style.display = target === 'volume' ? 'block' : 'none';
    });
  });
}

window.openEvolutionFor = function (exercise) {
  evoSelectedExercise = exercise;
  evoRangeMonths = 3;
  evoSelectedUnit = null;
  document.querySelectorAll('.sheet-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'evolucao'));
  if (statsBody) statsBody.style.display = 'none';
  if (volumeBody) volumeBody.style.display = 'none';
  if (evolutionBody) evolutionBody.style.display = 'block';
  renderEvolutionTab();
  const sheet = document.getElementById('statsSheet');
  const backdrop = document.getElementById('sheetBackdrop');
  if (sheet && backdrop) {
    sheet.classList.add('visible');
    backdrop.classList.add('visible');
  }
};

function getAllTimeCompletedDays() {
  return JSON.parse(localStorage.getItem('completedDaysAllTime') || '[]');
}

// Data -> treinos daquele dia. Inclui dias finalizados e também dias em que
// só houve séries registradas (sem apertar "Finalizar"), pra nada sumir do calendário.
function getLoggedWorkoutsByDate() {
  const map = new Map();
  const add = (date, day) => {
    if (!map.has(date)) map.set(date, new Set());
    map.get(date).add(day);
  };
  getAllTimeCompletedDays().forEach(c => { if (c && c.date && c.day) add(c.date, c.day); });
  days.forEach(day => workoutData[day].exercises.forEach(ex => loadHistory(ex).forEach(h => add(h.date, day))));
  return map;
}

function getWorkoutsForDate(dateStr) {
  const set = getLoggedWorkoutsByDate().get(dateStr);
  if (!set) return [];
  return [...set]
    .sort((a, b) => orderedDays.indexOf(a) - orderedDays.indexOf(b))
    .map(day => ({ day, date: dateStr }));
}

function getSessionTimeLabel(day, dateStr) {
  const startRaw = localStorage.getItem(`sessaoInicio:${safeId(day)}:${dateStr}`);
  const endRaw = localStorage.getItem(`sessaoFim:${safeId(day)}:${dateStr}`);
  if (!startRaw || !endRaw) return null;
  const minutes = Math.max(0, Math.round((Number(endRaw) - Number(startRaw)) / 60000));
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

function getExerciseNameFromSafeId(safeExId) {
  for (const real in db) { if (safeId(real) === safeExId) return real; }
  return null;
}

function getExercisesLoggedForDay(day, dateStr) {
  const list = workoutData[day] ? workoutData[day].exercises : Object.keys(db);
  const result = [];
  list.forEach(ex => {
    const history = loadHistory(ex);
    const sets = history.filter(h => h.date === dateStr).sort((a, b) => a.setIndex - b.setIndex);
    if (sets.length > 0) result.push({ exercise: ex, sets });
  });
  return result;
}

// Mapa dos músculos treinados no dia: principal de algum exercício = forte,
// só auxiliar = claro.
function dayMusclesHtml(exercises) {
  const infos = exercises.map(ex => db[ex]).filter(Boolean);
  if (infos.length === 0) return '';
  const primary = [...new Set(infos.map(info => info.prim))];
  const secondary = [...new Set(infos.flatMap(info => info.sec))].filter(m => !primary.includes(m));
  return `<div class="day-muscles">${musclesHtml(primary, secondary, 'Músculos do dia')}</div>`;
}

function openDayDetail(dateStr) {
  const workouts = getWorkoutsForDate(dateStr);
  if (workouts.length === 0) return;
  dayDetailTitle.innerText = formatDateBR(dateStr);
  let html = '';
  const dayPRs = [];
  const trained = [];
  workouts.forEach(w => {
    const timeLabel = getSessionTimeLabel(w.day, dateStr);
    const exercises = getExercisesLoggedForDay(w.day, dateStr);
    trained.push(...exercises.map(item => item.exercise));
    const volumeKg = getDayVolumeKg(exercises);
    html += `<div class="day-detail-meta">
      <span class="day-detail-chip workout-tag ${getDayColorClass(w.day)}">${dayLabel(w.day)}</span>
      ${timeLabel ? `<span class="day-detail-chip">⏱ ${timeLabel}</span>` : ''}
      <span class="day-detail-chip">${exercises.length} exercício${exercises.length !== 1 ? 's' : ''}</span>
      ${volumeKg > 0 ? `<span class="day-detail-chip">📦 ${volumeKg.toLocaleString('pt-BR')}kg volume</span>` : ''}
    </div>`;
    exercises.forEach(item => {
      let setsHtml = '';
      let bestIdx = 0;
      item.sets.forEach((s, i) => {
        if (estimatedMax(s.weight, s.reps) > estimatedMax(item.sets[bestIdx].weight, item.sets[bestIdx].reps)) bestIdx = i;
      });
      const progress = getDayProgress(item.exercise, dateStr);
      if (progress && progress.isPR) dayPRs.push({ exercise: item.exercise, ...progress });
      item.sets.forEach((s, i) => { setsHtml += `<span class="evo-set-chip ${i === bestIdx ? 'best' : ''}">${formatLoad(s.weight, s.unit || 'kg')} <span class="evo-set-chip-x">×</span> ${s.reps}</span>`; });
      html += `<div class="day-detail-ex">
        <div class="day-detail-ex-head">
          <div class="day-detail-ex-name">${item.exercise}</div>
          ${dayTrendHtml(progress)}
        </div>
        <div class="day-detail-sets-row">${setsHtml}</div>
      </div>`;
    });
  });
  let prsHtml = '';
  if (dayPRs.length > 0) {
    prsHtml = `
      <div class="summary-prs">
        <div class="summary-prs-label">🏆 Recordes desse dia</div>
        ${dayPRs.map(pr => `<div class="summary-pr-row"><span>${pr.exercise}</span><span class="summary-pr-value">${formatLoad(pr.best.weight, pr.unit)} × ${pr.best.reps}<span class="summary-pr-prev">antes ${formatLoad(pr.prevRecord.weight, pr.unit)} × ${pr.prevRecord.reps}</span></span></div>`).join('')}
      </div>`;
  }
  dayDetailBody.innerHTML = prsHtml + dayMusclesHtml(trained) + html;
  dayDetailModal.classList.add('visible');
}

function bindDayDetailModal() {
  document.getElementById('closeDayDetail').addEventListener('click', () => { dayDetailModal.classList.remove('visible'); });
  dayDetailModal.addEventListener('click', (e) => { if (e.target.id === 'dayDetailModal') dayDetailModal.classList.remove('visible'); });
}

const CAL_MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CAL_DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CAL_DAY_COLOR_CLASSES = ['cal-color-1', 'cal-color-2', 'cal-color-3', 'cal-color-4', 'cal-color-5'];
let calMonthOffset = 0;

function getDayColorClass(dayName) {
  const idx = days.indexOf(dayName);
  if (idx === -1) return CAL_DAY_COLOR_CLASSES[0];
  return CAL_DAY_COLOR_CLASSES[idx % CAL_DAY_COLOR_CLASSES.length];
}

function buildMonthGrid(year, month, byDate) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayString();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = dateStrFromDate(new Date(year, month, d));
    cells.push({
      day: d,
      dateStr,
      workout: byDate.has(dateStr) ? [...byDate.get(dateStr)][0] : null,
      isToday: dateStr === today,
      isFuture: dateStr > today
    });
  }
  return cells;
}

function countDatesWithPrefix(byDate, prefix) {
  let count = 0;
  byDate.forEach((_, date) => { if (date.startsWith(prefix)) count += 1; });
  return count;
}

function renderCalendarModal() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + calMonthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();

  const byDate = getLoggedWorkoutsByDate();
  const cells = buildMonthGrid(year, month, byDate);
  const monthCount = countDatesWithPrefix(byDate, `${year}-${pad2(month + 1)}-`);
  const yearCount = countDatesWithPrefix(byDate, `${year}-`);
  const isCurrentMonth = calMonthOffset === 0;

  let gridHtml = `<div class="cal-grid-labels">${CAL_DAY_LABELS.map(l => `<span>${l}</span>`).join('')}</div><div class="cal-grid">`;
  cells.forEach(cell => {
    if (!cell) { gridHtml += `<div class="cal-cell empty"></div>`; return; }
    const hasWorkout = !!cell.workout;
    const classes = ['cal-cell'];
    if (cell.isToday) classes.push('today');
    if (cell.isFuture) classes.push('future');
    if (hasWorkout) { classes.push('trained'); classes.push(getDayColorClass(cell.workout)); }
    gridHtml += `<div class="${classes.join(' ')}" ${hasWorkout ? `data-date="${cell.dateStr}"` : ''}>
      <span class="cal-cell-daynum">${cell.day}</span>
    </div>`;
  });
  gridHtml += `</div>`;

  calendarModalContent.innerHTML = `
    <div class="heatmap-summary">
      <div class="heatmap-stat"><div class="heatmap-stat-value">${monthCount}</div><div class="heatmap-stat-label">Neste mês</div></div>
      <div class="heatmap-stat"><div class="heatmap-stat-value">${yearCount}</div><div class="heatmap-stat-label">Neste ano</div></div>
    </div>
    <div class="cal-nav">
      <button class="cal-nav-btn" id="calPrevMonth" aria-label="Mês anterior">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="cal-nav-label">${CAL_MONTH_NAMES[month]} ${year}</span>
      <button class="cal-nav-btn" id="calNextMonth" aria-label="Próximo mês" ${isCurrentMonth ? 'disabled' : ''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <div class="cal-card">
      ${gridHtml}
    </div>
    <div class="cal-legend">
      ${orderedDays.map(d => `<span class="cal-legend-item"><span class="cal-legend-swatch ${getDayColorClass(d)}"></span>${dayLabel(d)}</span>`).join('')}
    </div>
  `;

  calendarModalContent.querySelectorAll('.cal-cell.trained').forEach(el => {
    el.addEventListener('click', () => openDayDetail(el.dataset.date));
  });
  const prevBtn = document.getElementById('calPrevMonth');
  const nextBtn = document.getElementById('calNextMonth');
  if (prevBtn) prevBtn.addEventListener('click', () => { calMonthOffset -= 1; renderCalendarModal(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { if (calMonthOffset < 0) { calMonthOffset += 1; renderCalendarModal(); } });
}

function bindCalendarModal() {
  document.getElementById('calendarBtn').addEventListener('click', () => {
    calMonthOffset = 0;
    renderCalendarModal();
    calendarModal.classList.add('visible');
  });
  document.getElementById('closeCalendarModal').addEventListener('click', () => {
    calendarModal.classList.remove('visible');
  });
}

function buildSparklineSVG(history) {
  const W = 72, H = 28, PAD = 4;
  const recent = history.slice(-8);
  if (recent.length < 2) return '';
  const weights = recent.map(h => h.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const usableW = W - PAD * 2;
  const usableH = H - PAD * 2;
  const points = weights.map((w, i) => {
    const x = PAD + (i / (weights.length - 1)) * usableW;
    const y = PAD + usableH - ((w - min) / range) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastX = points[points.length - 1].split(',')[0];
  const lastY = points[points.length - 1].split(',')[1];
  return `
    <svg class="sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline points="${points.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastX}" cy="${lastY}" r="2.5" fill="var(--accent)" />
    </svg>`;
}

function groupHistoryByDate(history) {
  const map = new Map();
  history.forEach(h => {
    if (!map.has(h.date)) map.set(h.date, []);
    map.get(h.date).push(h);
  });
  return [...map.entries()]
    .map(([date, sets]) => ({ date, sets }))
    .sort((a, b) => a.date.localeCompare(b.date));
}


function getExercisesWithHistoryGrouped() {
  const allEx = new Set();
  days.forEach(d => workoutData[d].exercises.forEach(ex => allEx.add(ex)));
  const grouped = {};
  allEx.forEach(ex => {
    if (loadHistory(ex).length === 0) return;
    const catName = db[ex] ? db[ex].cat : "Outros";
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(ex);
  });
  return grouped;
}

function buildEvolutionChartSVG(sessions, unit) {
  const H = 226, PAD_TOP = 34, PAD_BOTTOM = 36, PAD_LEFT = 38, PAD_RIGHT = 18;
  const W = 600;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const innerW = W - PAD_LEFT - PAD_RIGHT;

  const points = sessions.map((session, si) => {
    let bestIdx = 0;
    session.sets.forEach((s, i) => {
      if (estimatedMax(s.weight, s.reps) > estimatedMax(session.sets[bestIdx].weight, session.sets[bestIdx].reps)) bestIdx = i;
    });
    const best = session.sets[bestIdx];
    const x = sessions.length === 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + (si / (sessions.length - 1)) * innerW;
    return { x, weight: best.weight, reps: best.reps, date: session.date, setCount: session.sets.length };
  });

  const weights = points.map(p => p.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) { min -= 5; max += 5; }
  const padRatio = points.length <= 3 ? 0.12 : points.length <= 6 ? 0.18 : 0.25;
  const pad = (max - min) * padRatio;
  min -= pad; max += pad;
  if (min < 0) min = 0;
  const yFor = w => PAD_TOP + innerH - ((w - min) / (max - min)) * innerH;

  let prPoint = points[0];
  points.forEach(p => { if (estimatedMax(p.weight, p.reps) > estimatedMax(prPoint.weight, prPoint.reps)) prPoint = p; });

  let gridHtml = '';
  const gridCount = 3;
  for (let g = 0; g <= gridCount; g++) {
    const w = min + (max - min) * (g / gridCount);
    const y = yFor(w);
    gridHtml += `<line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />`;
    gridHtml += `<text x="${(PAD_LEFT - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${Math.round(w)}</text>`;
  }

  function smoothPath(pts) {
    if (pts.length < 2) return '';
    if (pts.length === 2) return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }
  const linePathStr = smoothPath(points.map(p => ({ x: p.x, y: yFor(p.weight) })));
  let areaPathStr = '';
  if (points.length > 1) {
    areaPathStr = `${linePathStr} L ${points[points.length-1].x.toFixed(1)},${H - PAD_BOTTOM + 10} L ${points[0].x.toFixed(1)},${H - PAD_BOTTOM + 10} Z`;
  }

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  let dotsHtml = '';
  let labelsHtml = '';
  points.forEach((p, idx) => {
    const y = yFor(p.weight);
    const isPR = p === prPoint;
    const r = isPR ? 6 : 3.5;
    dotsHtml += `<g class="evo-point" data-idx="${idx}" tabindex="0" role="button" aria-label="${formatDateBR(p.date)}: ${formatLoad(p.weight, unit)} por ${p.reps} reps">
      <circle class="evo-point-halo" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="transparent" />
      <circle class="evo-point-ring" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 6}" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0" />
      <circle class="evo-point-dot" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${isPR ? 'var(--accent)' : 'var(--bg)'}" stroke="var(--accent)" stroke-width="${isPR ? 0 : 2}" />
      ${isPR ? `<text x="${p.x.toFixed(1)}" y="${(y - 14).toFixed(1)}" text-anchor="middle" font-family="var(--font-mono)" font-weight="700" font-size="11" fill="var(--accent)">${p.weight}</text>` : ''}
    </g>`;
    if (idx % labelStep === 0 || idx === points.length - 1) {
      const [, m, d] = p.date.split('-');
      labelsHtml += `<text x="${p.x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-family="var(--font-mono)" font-weight="600" font-size="11" fill="var(--text-dim)">${d}/${m}</text>`;
    }
  });

  const pointsData = points.map(p => ({ date: formatDateBR(p.date), rawDate: p.date, weight: p.weight, reps: p.reps, setCount: p.setCount, isPR: p === prPoint }));
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="evo-chart-svg">
      <defs>
        <linearGradient id="evoGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridHtml}
      ${areaPathStr ? `<path d="${areaPathStr}" fill="url(#evoGradient)" />` : ''}
      <path d="${linePathStr}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />
      ${dotsHtml}
      ${labelsHtml}
    </svg>`,
    pointsData
  };
}

function renderEvolutionTab() {
  if (!evolutionBody) return;
  const grouped = getExercisesWithHistoryGrouped();
  const catNames = Object.keys(grouped);
  if (catNames.length === 0) {
    evolutionBody.innerHTML = '<div style="padding:20px;text-align:center;color:#767d83;font-size:13px;">Nenhum histórico registrado ainda. Registre suas séries para ver sua evolução aqui.</div>';
    return;
  }
  const allExercisesFlat = catNames.flatMap(c => grouped[c]);
  if (!evoSelectedExercise || !allExercisesFlat.includes(evoSelectedExercise)) {
    let latestEx = allExercisesFlat[0];
    let latestDate = '';
    allExercisesFlat.forEach(ex => {
      const h = loadHistory(ex);
      const last = h[h.length - 1];
      if (last && last.date > latestDate) { latestDate = last.date; latestEx = ex; }
    });
    evoSelectedExercise = latestEx;
  }
  let optionsHtml = '';
  catNames.forEach(cat => {
    optionsHtml += `<div class="custom-select-group">${cat}</div>`;
    grouped[cat].forEach(ex => {
      const isSelected = ex === evoSelectedExercise;
      optionsHtml += `
        <div class="custom-select-option ${isSelected ? 'selected' : ''}" data-value="${ex.replace(/"/g, '&quot;')}">
          ${ex}
          ${isSelected ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
        </div>`;
    });
  });
  evolutionBody.innerHTML = `
    <div class="custom-select-wrap" id="evoSelectWrap">
      <div class="custom-select-header" id="evoSelectHeader">
        <span id="evoSelectLabel">${evoSelectedExercise}</span>
        <svg class="custom-select-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="custom-select-options" id="evoSelectOptions">
        ${optionsHtml}
      </div>
    </div>
    <div id="evoContent"></div>
  `;
  const header = document.getElementById('evoSelectHeader');
  const options = document.getElementById('evoSelectOptions');
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = options.classList.contains('open');
    if (!isOpen) {
      options.classList.add('open');
      header.classList.add('open');
    } else {
      options.classList.remove('open');
      header.classList.remove('open');
    }
  });
  options.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.addEventListener('click', () => {
      evoSelectedExercise = opt.dataset.value;
      evoRangeMonths = 3;
      evoSelectedUnit = null;
      options.classList.remove('open');
      header.classList.remove('open');
      renderEvolutionTab();
    });
  });
  document.addEventListener('click', (e) => {
    if (options && header && !header.contains(e.target) && !options.contains(e.target)) {
      options.classList.remove('open');
      header.classList.remove('open');
    }
  });
  renderEvolutionContent(evoSelectedExercise);
}

const EVO_SESSIONS_VISIBLE = 4;

function renderEvolutionContent(exercise) {
  const content = document.getElementById('evoContent');
  if (!content) return;
  const fullHistory = loadHistory(exercise);
  const unitsAvailable = [...new Set(fullHistory.map(h => h.unit || 'kg'))];
  // Se o exercício tem registros em mais de uma unidade (ex: trocou de kg pra
  // placas), mostra o seletor e mantém a comparação de PR/gráfico só dentro
  // da unidade escolhida — misturar as duas não faz sentido.
  if (!evoSelectedUnit || !unitsAvailable.includes(evoSelectedUnit)) {
    evoSelectedUnit = fullHistory.length > 0 ? (fullHistory[fullHistory.length - 1].unit || 'kg') : 'kg';
  }
  const history = fullHistory.filter(h => (h.unit || 'kg') === evoSelectedUnit);
  const sessions = groupHistoryByDate(history);
  const totalSets = history.length;
  const unitSwitchHtml = unitsAvailable.length > 1 ? `
    <div class="unit-toggle" id="evoUnitToggle" style="margin-bottom:16px;">
      ${unitsAvailable.map(u => `<button type="button" class="unit-toggle-btn ${u === evoSelectedUnit ? 'active' : ''}" data-unit="${u}">${unitLabel(u).charAt(0).toUpperCase() + unitLabel(u).slice(1)}</button>`).join('')}
    </div>` : '';
  if (totalSets === 0) {
    content.innerHTML = unitSwitchHtml + `<div class="evo-chart-card"><div class="evo-chart-empty">Nenhum registro em ${unitLabel(evoSelectedUnit)} ainda para este exercício.</div></div>`;
    content.querySelectorAll('.unit-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => { evoSelectedUnit = btn.dataset.unit; renderEvolutionContent(exercise); });
    });
    return;
  }
  const pr = getPersonalRecord(exercise, evoSelectedUnit);
  const firstSet = sessions[0].sets[0];
  const delta = pr.weight - firstSet.weight;
  const progressClass = sessions.length < 2 ? 'flat' : (delta > 0 ? 'pos' : (delta < 0 ? 'neg' : 'flat'));
  const progressLabel = sessions.length < 2 ? '—' : `${delta > 0 ? '+' : ''}${formatLoad(delta, evoSelectedUnit)}`;
  const summaryHtml = `
    <div class="evo-summary">
      <div class="evo-stat">
        <div class="evo-stat-value">${sessions.length}</div>
        <div class="evo-stat-label">Sessões</div>
      </div>
      <div class="evo-stat evo-stat-hero">
        <div class="evo-stat-value">${pr.weight}<span class="evo-stat-unit">${unitLabel(evoSelectedUnit)}</span></div>
        <div class="evo-stat-label">PR atual · ${pr.reps} reps</div>
      </div>
      <div class="evo-stat">
        <div class="evo-stat-value ${progressClass}">${progressLabel}</div>
        <div class="evo-stat-label">Desde o início</div>
      </div>
    </div>
  `;
  let chartHtml, pointsData = [], sessionsInRange = [];
  const RANGE_OPTIONS = [
    { label: '1M', months: 1 },
    { label: '3M', months: 3 },
    { label: '6M', months: 6 },
    { label: 'Tudo', months: Infinity }
  ];
  if (totalSets >= 2) {
    if (Number.isFinite(evoRangeMonths)) {
      const cutoff = new Date(todayString());
      cutoff.setMonth(cutoff.getMonth() - evoRangeMonths);
      const cutoffStr = dateStrFromDate(cutoff);
      sessionsInRange = sessions.filter(s => s.date >= cutoffStr);
      if (sessionsInRange.length < 2) sessionsInRange = sessions.slice(-Math.min(6, sessions.length));
    } else {
      sessionsInRange = sessions;
    }
    const built = buildEvolutionChartSVG(sessionsInRange, evoSelectedUnit);
    pointsData = built.pointsData;
    const rangeBtnsHtml = `
      <div class="evo-zoom-row">
        ${RANGE_OPTIONS.map(o => {
          const isActive = o.months === Infinity ? !Number.isFinite(evoRangeMonths) : evoRangeMonths === o.months;
          return `<button class="evo-zoom-btn ${isActive ? 'active' : ''}" data-range="${o.months === Infinity ? 'all' : o.months}">${o.label}</button>`;
        }).join('')}
      </div>`;
    chartHtml = `
      <div class="evo-chart-card">
        ${rangeBtnsHtml}
        <div class="evo-chart-scroll">
          ${built.svg}
        </div>
      </div>
      <div class="evo-tooltip" id="evoTooltip">
        <div class="evo-tooltip-placeholder">Toque em um ponto do gráfico para ver os detalhes daquele dia</div>
      </div>`;
  } else {
    chartHtml = `<div class="evo-chart-card"><div class="evo-chart-empty">Registre mais uma série para começar a ver seu gráfico de evolução.</div></div>`;
  }
  const reversedSessions = [...sessions].reverse();
  const visibleSessions = reversedSessions.slice(0, EVO_SESSIONS_VISIBLE);
  const hiddenSessions = reversedSessions.slice(EVO_SESSIONS_VISIBLE);
  function renderSessionCard(session) {
    const isToday = session.date === todayString() || session.date === yesterdayString();
    let bestIdx = 0;
    session.sets.forEach((s, i) => {
      if (estimatedMax(s.weight, s.reps) > estimatedMax(session.sets[bestIdx].weight, session.sets[bestIdx].reps)) bestIdx = i;
    });
    const sessionIdxInOrder = sessions.indexOf(session);
    const prevSession = sessionIdxInOrder > 0 ? sessions[sessionIdxInOrder - 1] : null;
    let trendHtml = '';
    if (prevSession) {
      let prevBestIdx = 0;
      prevSession.sets.forEach((s, i) => {
        if (estimatedMax(s.weight, s.reps) > estimatedMax(prevSession.sets[prevBestIdx].weight, prevSession.sets[prevBestIdx].reps)) prevBestIdx = i;
      });
      const curBest = session.sets[bestIdx];
      const prevBest = prevSession.sets[prevBestIdx];
      const curEst = estimatedMax(curBest.weight, curBest.reps);
      const prevEst = estimatedMax(prevBest.weight, prevBest.reps);
      if (curEst > prevEst) trendHtml = `<span class="evo-session-trend up">↑ melhor que o treino anterior</span>`;
      else if (curEst < prevEst) trendHtml = `<span class="evo-session-trend down">↓ abaixo do treino anterior</span>`;
      else trendHtml = `<span class="evo-session-trend flat">= igual ao treino anterior</span>`;
    }
    let setsHtml = '';
    session.sets.forEach((s, i) => {
      setsHtml += `<span class="evo-set-chip ${i === bestIdx ? 'best' : ''}">${formatLoad(s.weight, evoSelectedUnit)} <span class="evo-set-chip-x">×</span> ${s.reps}</span>`;
    });
    return `
      <div class="evo-session-card">
        <div class="evo-session-header-row">
          <div class="evo-session-date">${isToday ? '<span class="evo-today-tag">HOJE</span>' : formatDateBR(session.date)}</div>
          ${trendHtml}
        </div>
        <div class="evo-sets-row">${setsHtml}</div>
      </div>`;
  }
  let listHtml = '<div class="evo-list-label">Histórico de treinos</div><div class="evo-session-list">';
  visibleSessions.forEach(session => { listHtml += renderSessionCard(session); });
  listHtml += '</div>';
  if (hiddenSessions.length > 0) {
    listHtml += `<div id="evoHiddenSessions" class="evo-session-list" style="display:none; margin-top:10px;">`;
    hiddenSessions.forEach(session => { listHtml += renderSessionCard(session); });
    listHtml += `</div>`;
    listHtml += `<button id="evoShowMoreBtn" class="evo-show-more-btn">Ver ${hiddenSessions.length} treino${hiddenSessions.length > 1 ? 's' : ''} mais antigo${hiddenSessions.length > 1 ? 's' : ''}</button>`;
  }
  content.innerHTML = unitSwitchHtml + summaryHtml + chartHtml + listHtml;
  content.querySelectorAll('#evoUnitToggle .unit-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => { evoSelectedUnit = btn.dataset.unit; renderEvolutionContent(exercise); });
  });
  const showMoreBtn = document.getElementById('evoShowMoreBtn');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      const hidden = document.getElementById('evoHiddenSessions');
      hidden.style.display = 'flex';
      showMoreBtn.remove();
    });
  }
  content.querySelectorAll('.evo-zoom-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      evoRangeMonths = btn.dataset.range === 'all' ? Infinity : Number(btn.dataset.range);
      renderEvolutionContent(exercise);
    });
  });
  if (pointsData.length > 0) {
    const tooltip = document.getElementById('evoTooltip');
    const chartCard = content.querySelector('.evo-chart-card');
    chartCard.querySelectorAll('.evo-point').forEach(pointEl => {
      const showTooltipFor = () => {
        const idx = Number(pointEl.dataset.idx);
        chartCard.querySelectorAll('.evo-point').forEach(el => el.classList.toggle('active', Number(el.dataset.idx) === idx));
        const p = pointsData[idx];
        const session = sessionsInRange[idx];
        if (!p || !tooltip || !session) return;
        let bestIdx = 0;
        session.sets.forEach((s, i) => {
          if (estimatedMax(s.weight, s.reps) > estimatedMax(session.sets[bestIdx].weight, session.sets[bestIdx].reps)) bestIdx = i;
        });
        const setsHtml = session.sets.map((s, i) => `<div class="evo-set-block ${i === bestIdx ? 'best' : ''}"><span class="evo-set-label">S${i + 1}</span><span class="evo-set-value">${formatLoad(s.weight, evoSelectedUnit)} <span class="evo-set-chip-x">×</span> ${s.reps}</span></div>`).join('');
        tooltip.innerHTML = `
          <div class="evo-tooltip-header">
            <div class="evo-tooltip-date">${p.date}</div>
            ${p.isPR ? '<span class="evo-tooltip-pr">🏆 Recorde pessoal</span>' : ''}
          </div>
          <div class="evo-tooltip-sets-row">${setsHtml}</div>
        `;
      };
      pointEl.addEventListener('click', (e) => { e.stopPropagation(); showTooltipFor(); });
      pointEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showTooltipFor(); } });
    });
    const initialEl = chartCard.querySelector(`.evo-point[data-idx="${pointsData.length - 1}"]`);
    if (initialEl) initialEl.dispatchEvent(new Event('click', { bubbles: true }));
  }
}

function renderCatalogTab() {
  if (!catalogModalContent) return;
  const grouped = {};
  for (const ex in db) {
    const cat = db[ex].cat;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ex);
  }
  let html = `
    <div class="catalog-search-wrap">
      <svg class="catalog-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="text" id="catalogSearchInput" class="catalog-search-input" placeholder="Buscar exercício...">
    </div>
    <div id="catalogList">
  `;
  for (const cat in grouped) {
    html += `<div class="catalog-category" data-cat="${cat}">
      <div class="catalog-cat-title">${cat}</div><div class="catalog-grid">`;
    grouped[cat].forEach(ex => {
      const exEsc = ex.replace(/'/g, "\\'");
      html += `
        <div class="catalog-item" data-name="${ex.toLowerCase()}" onclick="showExerciseGuide('${exEsc}')">
          <span>${ex}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>`;
    });
    html += `</div></div>`;
  }
  html += `</div>`;
  catalogModalContent.innerHTML = html;
  
  const searchInput = document.getElementById('catalogSearchInput');
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.catalog-category').forEach(catEl => {
      let hasVisible = false;
      catEl.querySelectorAll('.catalog-item').forEach(item => {
        const match = item.dataset.name.includes(term);
        item.style.display = match ? 'flex' : 'none';
        if (match) hasVisible = true;
      });
      catEl.style.display = hasVisible ? 'block' : 'none';
    });
  });
}

function renderCategorizedStats() {
  const allEx = new Set();
  days.forEach(d => workoutData[d].exercises.forEach(ex => allEx.add(ex)));
  const categories = {};
  allEx.forEach(ex => {
    const history = loadHistory(ex);
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const lastUnit = last.unit || 'kg';
    const sameUnitHistory = history.filter(h => (h.unit || 'kg') === lastUnit);
    const prev = sameUnitHistory.length > 1 ? sameUnitHistory[sameUnitHistory.length - 2] : null;
    let trend = '<span class="stat-trend">—</span>';
    if (prev) {
      const diff = last.weight - prev.weight;
      if (diff > 0) trend = `<span class="stat-trend up">↑ ${formatLoad(diff, lastUnit)}</span>`;
      else if (diff < 0) trend = `<span class="stat-trend down">↓ ${formatLoad(Math.abs(diff), lastUnit)}</span>`;
    }
    const catName = db[ex] ? db[ex].cat : "Outros";
    if (!categories[catName]) categories[catName] = [];
    categories[catName].push({ ex, last, trend, sparkline: buildSparklineSVG(sameUnitHistory) });
  });
  if (Object.keys(categories).length === 0) {
    statsBody.innerHTML = '<div style="padding:20px;text-align:center;color:#767d83;font-size:13px;">Nenhum histórico registrado.</div>';
    return;
  }
  let html = '';
  for (const cat in categories) {
    html += `
      <div class="hist-cat-card expanded">
        <div class="cat-header" onclick="this.parentElement.classList.toggle('expanded')">
          ${cat}
          <svg class="hist-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="hist-wrapper">
          <div class="hist-body">
            <div class="hist-inner">
    `;
    categories[cat].forEach(row => {
      const exEsc = row.ex.replace(/'/g, "\\'");
      html += `
        <div class="stat-row" role="button" tabindex="0" onclick="openEvolutionFor('${exEsc}')" onkeydown="if(event.key==='Enter'){openEvolutionFor('${exEsc}')}">
          <div><div class="stat-name">${row.ex}</div><div class="stat-sub">${row.trend}</div></div>
          ${row.sparkline ? `<div class="stat-spark">${row.sparkline}</div>` : ''}
          <div class="stat-value">${formatLoad(row.last.weight, row.last.unit || 'kg')} × ${row.last.reps}</div>
        </div>`;
    });
    html += `
            </div>
          </div>
        </div>
      </div>`;
  }
  statsBody.innerHTML = html;
}

function calculateWeeklyVolume() {
  const allMuscles = ["Peito", "Costas", "Quadríceps", "Posterior de Coxa", "Ombro Anterior", "Ombro Lateral", "Tríceps", "Bíceps", "Glúteo", "Adutores", "Panturrilha", "Abdômen"];
  const weekStart = getWeekStart(todayString(), volumeWeekOffset);
  const weekEnd = getWeekEnd(weekStart);
  const vol = {};
  allMuscles.forEach(m => vol[m] = 0);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith("series:")) continue;
    const parts = key.split(":");
    if (parts.length < 4) continue;
    const recordDateStr = parts[3];
    if (recordDateStr < weekStart || recordDateStr > weekEnd) continue;
    const setsArray = JSON.parse(localStorage.getItem(key));
    const numSets = setsArray.length;
    if (numSets === 0) continue;
    let realEx = null;
    for (const real in db) { if (safeId(real) === parts[2]) realEx = real; }
    if (!realEx || !db[realEx]) continue;
    if (vol[db[realEx].prim] !== undefined) vol[db[realEx].prim] += numSets;
    db[realEx].sec.forEach(s => {
      if (vol[s] !== undefined) vol[s] += (numSets * 0.5);
    });
  }
  const isCurrentWeek = volumeWeekOffset === 0;
  const weekLabel = isCurrentWeek ? 'Esta semana' : `${formatDateShortBR(weekStart)} – ${formatDateShortBR(weekEnd)}`;
  const navHtml = `
    <div class="vol-week-nav">
      <button class="vol-week-btn" id="volWeekPrev" aria-label="Semana anterior">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="vol-week-label">${weekLabel}</span>
      <button class="vol-week-btn" id="volWeekNext" aria-label="Próxima semana" ${isCurrentWeek ? 'disabled' : ''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>`;
  // Mapa do corpo com as mesmas cores da lista: forte = na meta, claro = abaixo,
  // vermelho = acima; músculo não treinado fica apagado.
  const levelByName = {};
  allMuscles.forEach(m => {
    const count = vol[m];
    if (count > 20) levelByName[m] = 'over';
    else if (count >= 12) levelByName[m] = 'primary';
    else if (count > 0) levelByName[m] = 'secondary';
  });
  let html = navHtml + `<div class="vol-map">${bodyMapHtml(regionLevels(levelByName), { fit: false })}</div>`;
  html += '<p style="font-size:12px; color:var(--text-dim); margin-bottom:16px;">Séries na semana selecionada. <strong>Meta: 12 a 20 séries.</strong></p>';
  allMuscles.forEach(m => {
    const count = vol[m];
    let color = 'var(--text-faint)';
    let status = 'Não treinado';
    if (count > 20) { color = 'var(--danger)'; status = 'Alto (risco de fadiga)'; }
    else if (count >= 12) { color = 'var(--accent)'; status = 'Ideal (hipertrofia)'; }
    else if (count > 0) { color = 'rgba(var(--accent-rgb), 0.6)'; status = 'Baixo (falta volume)'; }
    const pct = Math.min((count / 20) * 100, 100);
    html += `
      <div class="vol-card">
        <div class="vol-info">
          <div class="vol-head">
            <span class="vol-name">${m}</span>
            <span class="vol-count" style="color:${color}">${count} <span style="font-size:11px; font-weight:400; color:var(--text-faint)">séries</span></span>
          </div>
          <div class="vol-track"><div class="vol-fill" style="width:${pct}%; background:${color}"></div></div>
          <div class="vol-status" style="color:${color}">${status}</div>
        </div>
      </div>`;
  });
  volumeBody.innerHTML = html;
  const prevBtn = document.getElementById('volWeekPrev');
  const nextBtn = document.getElementById('volWeekNext');
  if (prevBtn) prevBtn.addEventListener('click', () => { volumeWeekOffset -= 1; calculateWeeklyVolume(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { if (volumeWeekOffset < 0) { volumeWeekOffset += 1; calculateWeeklyVolume(); } });
}

function migrateWorkoutDate(day, fromDate, toDate) {
  if (!day || !workoutData[day] || !fromDate || !toDate || fromDate === toDate) return false;
  const exercises = workoutData[day].exercises;
  let movedAny = false;

  exercises.forEach(ex => {
    const hKey = historyKey(ex);
    const rawHistory = JSON.parse(localStorage.getItem(hKey) || '[]');
    if (rawHistory.some(h => h.date === fromDate)) movedAny = true;
    const history = rawHistory.map(h => h.date === fromDate ? { ...h, date: toDate } : h);
    localStorage.setItem(hKey, JSON.stringify(history));

    const oldSets = `series:${safeId(day)}:${safeId(ex)}:${fromDate}`;
    const newSets = `series:${safeId(day)}:${safeId(ex)}:${toDate}`;
    const setsVal = localStorage.getItem(oldSets);
    if (setsVal !== null) {
      localStorage.setItem(newSets, setsVal);
      localStorage.removeItem(oldSets);
      movedAny = true;
    }
  });

  const oldStart = `sessaoInicio:${safeId(day)}:${fromDate}`;
  const newStart = `sessaoInicio:${safeId(day)}:${toDate}`;
  const startVal = localStorage.getItem(oldStart);
  if (startVal !== null) {
    localStorage.setItem(newStart, startVal);
    localStorage.removeItem(oldStart);
    movedAny = true;
  }

  const oldEnd = `sessaoFim:${safeId(day)}:${fromDate}`;
  const newEnd = `sessaoFim:${safeId(day)}:${toDate}`;
  const endVal = localStorage.getItem(oldEnd);
  if (endVal !== null) {
    localStorage.setItem(newEnd, endVal);
    localStorage.removeItem(oldEnd);
  }

  if (!movedAny) return false;

  const activeKey = `sessaoAtivaData:${safeId(day)}`;
  if (localStorage.getItem(activeKey) === fromDate) {
    localStorage.setItem(activeKey, toDate);
  }

  const completed = getCompletedDays().map(c => (c && c.day === day && c.date === fromDate) ? { ...c, date: toDate } : c);
  if (!completed.some(c => c && c.day === day && c.date === toDate)) {
    completed.push({ day, date: toDate });
  }
  localStorage.setItem('completedDays', JSON.stringify(completed));

  const allTime = getAllTimeCompletedDays().map(c => (c && c.day === day && c.date === fromDate) ? { ...c, date: toDate } : c);
  if (!allTime.some(c => c && c.day === day && c.date === toDate)) {
    allTime.push({ day, date: toDate });
  }
  localStorage.setItem('completedDaysAllTime', JSON.stringify(allTime.slice(-200)));

  let allDates = JSON.parse(localStorage.getItem('allCompletedDates') || '[]');
  const stillHasFrom = getCompletedDays().some(c => c && c.date === fromDate) || getAllTimeCompletedDays().some(c => c && c.date === fromDate);
  if (!stillHasFrom) allDates = allDates.filter(d => d !== fromDate);
  if (!allDates.includes(toDate)) allDates.push(toDate);
  localStorage.setItem('allCompletedDates', JSON.stringify(allDates));

  trySync();
  return true;
}

function bindDateFixTool() {
  const select = document.getElementById('fixDaySelect');
  const fromInput = document.getElementById('fixFromDate');
  const toInput = document.getElementById('fixToDate');
  const btn = document.getElementById('fixDateBtn');
  if (!select || !btn) return;
  select.innerHTML = orderedDays.map(d => `<option value="${d}">${dayLabel(d)}</option>`).join('');
  btn.addEventListener('click', () => {
    const day = select.value;
    const fromDate = fromInput.value;
    const toDate = toInput.value;
    if (!fromDate || !toDate) { alert('Preencha as duas datas.'); return; }
    if (fromDate === toDate) { alert('As datas precisam ser diferentes.'); return; }
    if (!confirm(`Mover todos os registros do treino ${dayLabel(day)} do dia ${fromDate.split('-').reverse().join('/')} para ${toDate.split('-').reverse().join('/')} e marcar como concluído no calendário?`)) return;
    const ok = migrateWorkoutDate(day, fromDate, toDate);
    if (!ok) { alert('Não encontramos nenhum registro desse treino na data informada.'); return; }
    fromInput.value = '';
    toInput.value = '';
    updateHeaderTitle();
    renderDaySelectors();
    renderExercises(currentDay);
    updateSessionBar(currentDay);
    updateStreakBadge();
    showToast('Corrigido', 'Data do treino foi atualizada com sucesso!');
  });
}

function bindBackupSystem() {
  const syncDisplay = document.getElementById('syncIdDisplay');
  if (syncDisplay) syncDisplay.innerText = syncId;
  updateSyncStatus();

  const syncNowBtn = document.getElementById('syncNowBtn');
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', () => {
      trySync();
    });
  }

  const forceUpdateBtn = document.getElementById('forceUpdateBtn');
  if (forceUpdateBtn) {
    forceUpdateBtn.addEventListener('click', async () => {
      forceUpdateBtn.disabled = true;
      forceUpdateBtn.innerText = 'Atualizando...';
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            if (reg.active) reg.active.postMessage('CLEAR_CACHE');
            await reg.unregister();
          }
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (e) {
        console.warn('Erro ao limpar cache:', e);
      }
      location.reload(true);
    });
  }

  document.getElementById('cloudRestoreBtn').addEventListener('click', async () => {
    const code = prompt("Digite o Código de Sincronização do outro celular:");
    if (!code) return;
    try {
      const docSnap = await getDoc(doc(dbFirestore, "users", code.toUpperCase()));
      if (docSnap.exists()) {
        if (confirm("Isso vai apagar os treinos deste celular e baixar os da nuvem. Continuar?")) {
          localStorage.clear();
          const data = docSnap.data();
          for (const k in data) localStorage.setItem(k, data[k]);
          setSyncId(code.toUpperCase());
          if (syncDisplay) syncDisplay.innerText = code.toUpperCase();
          trySync();
          showToast('Sucesso', 'Treinos restaurados da nuvem!');
          setTimeout(() => location.reload(), 1200);
        }
      } else {
        alert("Código não encontrado na nuvem.");
      }
    } catch (e) {
      alert("Erro ao buscar dados. Verifique a internet.");
    }
  });

  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm("Apagar TUDO permanentemente? Essa ação não pode ser desfeita.")) {
      localStorage.clear();
      trySync();
      location.reload();
    }
  });
}

window.showExerciseGuide = function (exercise) {
  const info = db[exercise];
  const modal = document.getElementById('infoModal');
  document.getElementById('infoTitle').innerText = exercise;
  document.getElementById('infoText').innerText = info ? info.tip : "Foque na contração e controle do movimento.";
  const mediaWrap = document.getElementById('infoMedia');
  if (info && info.img) {
    mediaWrap.style.display = 'block';
    mediaWrap.innerHTML = `
      <div class="info-media-frames">
        <img crossorigin="anonymous" src="${MEDIA_BASE}${info.img}/0.jpg" alt="Posição inicial: ${exercise}" loading="lazy" onerror="this.closest('.info-media').style.display='none'">
        <img crossorigin="anonymous" src="${MEDIA_BASE}${info.img}/1.jpg" alt="Posição final: ${exercise}" loading="lazy" onerror="this.remove()">
      </div>
      <div class="info-media-caption">Duas posições do movimento</div>
    `;
  } else {
    mediaWrap.style.display = 'none';
    mediaWrap.innerHTML = '';
  }
  const musclesWrap = document.getElementById('infoMuscles');
  if (info) {
    musclesWrap.style.display = '';
    musclesWrap.innerHTML = musclesHtml([info.prim], info.sec || []);
  } else {
    musclesWrap.style.display = 'none';
  }
  modal.classList.add('visible');
};

window.showToast = function (title, text) {
  const toast = document.getElementById('toastNotification');
  toast.innerHTML = `<strong style="color: var(--accent); font-size: 14px;">${title}</strong><br><span style="font-size: 12px; color: var(--text-dim); margin-top: 4px; display: inline-block;">${text}</span>`;
  toast.classList.add('show');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 4000);
};

function bindInfoModal() {
  document.getElementById('closeInfo').addEventListener('click', () => { document.getElementById('infoModal').classList.remove('visible'); });
  document.getElementById('infoModal').addEventListener('click', (e) => {
    if (e.target.id === 'infoModal') document.getElementById('infoModal').classList.remove('visible');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('infoModal').classList.remove('visible');
      document.getElementById('bodyModal').classList.remove('visible');
      document.getElementById('catalogModal').classList.remove('visible');
      document.getElementById('configModal').classList.remove('visible');
      document.getElementById('calendarModal').classList.remove('visible');
      document.getElementById('dayDetailModal').classList.remove('visible');
      closeRestOverlay();
      statsSheet.classList.remove('visible');
      sheetBackdrop.classList.remove('visible');
      const summaryModal = document.getElementById('summaryModal');
      if (summaryModal) summaryModal.classList.remove('visible');
    }
  });
}

function bindSummaryModal() {
  const modal = document.getElementById('summaryModal');
  const closeBtn = document.getElementById('closeSummary');
  if (!modal || !closeBtn) return;
  closeBtn.addEventListener('click', () => { modal.classList.remove('visible'); });
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'summaryModal') modal.classList.remove('visible');
  });
}

init();