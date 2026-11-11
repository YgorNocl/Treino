import { syncId, setSyncId, fetchCloudBackup, snapshotLocalData, MEDIA_BASE, db, workoutData, days, activeDays, setsFor, exercisesEverIn, savePlan, addCustomExercise, MUSCLE_CATEGORIES, VOLUME_GROUP, MAX_SETS, exerciseType, createWorkout, updateWorkout, deleteWorkout, moveWorkout, WORKOUT_COLORS, formatSyncCode, normalizeSyncCode } from './data.js';
import { CATALOG_GROUPS, EXERCISE_TYPES } from './catalog.js';
import { TEMPLATES } from './templates.js';
import { MODULES, moduleOn, setModule } from './modules.js';
import { fmtSeconds } from './calisthenics-data.js';
import { openGuide as openStepGuide } from './calisthenics-panels.js';
import { primeAlert, alertTimerEnd } from './rest-timer.js';
import { thumbHtml } from './thumb.js';
import { trySync, syncNow, cancelPendingSync, updateSyncStatus } from './sync.js';
import { closeRestOverlay, initRestTimer, startRestFor } from './rest-timer.js';
import { pad2, todayString, yesterdayString, parseNum, safeId, unitLabel, formatLoad, compareSets, isBetterSet, formatDateBR, formatDateShortBR, getWeekStart, getWeekEnd, emptyStateHtml, revealCard, searchKey, niceTicks, monthsAgo, readJSON, readListCached } from './utils.js';
import { monthCalendarHtml, monthNavHtml, calendarLegendHtml, calendarStatsHtml, yearSummaryHtml, formatVolume, bindMonthCalendar } from './calendar.js';
import { musclesHtml, bodyMapHtml, regionLevels } from './body-map.js';
import { buildSummaryImage } from './share-card.js';
import { openSetEditor } from './set-editor.js';
import { confirmDialog, alertDialog, promptDialog } from './dialog.js';
import { initBackNav } from './back-nav.js';
import { showSummaryModal, longDateLabel, shareOrDownload } from './summary.js';
import { setAwake } from './wake-lock.js';
import { enableSheetDrag } from './sheet-drag.js';
import { initAutoUpdate } from './update.js';
import { initRun, renderRun, leaveRun, openRunProgress, dayRunsHtml, fmtKm, fmtDuration } from './run.js';
import { loadRuns, runsByDate, weekTotals as runWeekTotals, totals as runTotals } from './run-store.js';

// Versão carregada (js/version.js, lido antes dos módulos).
const APP_VERSION = self.APP_VERSION || '—';

// Treinos montados pelo usuário (data.js). O `id` de cada um vai no histórico e
// nas chaves da sessão; na tela aparecem o nome e a cor escolhidos.
// Corrida aparece no calendário e no detalhe do dia como mais um "treino".
const RUN_DAY = '__corrida__';
const RUN_COLOR = '#ff9f43';
function dayLabel(day) {
  if (day === RUN_DAY) return 'Corrida';
  return (workoutData[day] && workoutData[day].name) || 'Treino';
}

// Os treinos mostram os exercícios ou a Corrida (módulo opcional), escolhida no
// botão ao lado deles. Fica lembrado em gym:view.
const GYM_VIEW_KEY = 'gym:view';
let gymView = localStorage.getItem(GYM_VIEW_KEY) === 'run' && moduleOn('run') ? 'run' : 'lift';

const LAST_DAY_KEY = 'gym:lastDay';
// null quando ainda não há nenhum treino (instalação nova): aparece a tela de boas-vindas.
let currentDay = activeDays().includes(localStorage.getItem(LAST_DAY_KEY)) ? localStorage.getItem(LAST_DAY_KEY) : (activeDays()[0] || null);
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

// Data "lógica" do treino: se existe uma sessão de `day` iniciada ontem, não
// finalizada e com série registrada há pouco (ex: começou às 22h e virou
// meia-noite), o que for registrado agora continua no dia em que ela começou.
// Sem atividade recente, é um treino novo (data de hoje) — antes, um treino de
// ontem sem "Finalizar" puxava para ontem as séries do mesmo treino feitas hoje.
const SESSION_IDLE_MS = 4 * 60 * 60 * 1000;
// Sem série registrada há esse tempo, o cronômetro para na última série.
const TIMER_IDLE_MS = 90 * 60 * 1000;

function activityKey(day) { return `sessaoAtividade:${safeId(day)}`; }
function lastActivityAt(day) { return Number(localStorage.getItem(activityKey(day))) || 0; }

function sessionDateFor(day) {
  const stored = localStorage.getItem(`sessaoAtivaData:${safeId(day)}`);
  const today = todayString();
  if (!stored || stored === today) return today;
  const recent = Date.now() - lastActivityAt(day) < SESSION_IDLE_MS;
  return recent && !isWorkoutFinished(day, stored) ? stored : today;
}

function ensureFreshSessionAnchor(day) {
  const activeKey = `sessaoAtivaData:${safeId(day)}`;
  const stored = localStorage.getItem(activeKey);
  if (stored && sessionDateFor(day) !== stored) localStorage.removeItem(activeKey);
}

function setsKey(day, exercise) { return `series:${safeId(day)}:${safeId(exercise)}:${sessionDateFor(day)}`; }
function sessionStartKey(day) { return `sessaoInicio:${safeId(day)}:${sessionDateFor(day)}`; }
function sessionEndKey(day) { return `sessaoFim:${safeId(day)}:${sessionDateFor(day)}`; }

// Treinos finalizados na semana atual (domingo a sábado, igual ao calendário):
// deixam o botão Superior/Inferior verde. Antes usava um "ciclo" de 7 dias
// contado a partir do primeiro uso do app.
function getCompletedDays() {
  const weekStart = getWeekStart(todayString());
  return getAllTimeCompletedDays().filter(c => c && c.date >= weekStart);
}

function isWorkoutFinished(day, date) {
  return getAllTimeCompletedDays().some(c => c && c.day === day && c.date === date);
}

function updateHeaderTitle() {
  if (gymView === 'run') {
    headerTitle.innerText = 'Corrida';
    headerTitle.classList.remove('long');
    const week = runWeekTotals(todayString());
    headerSubtitle.innerText = `${week.count} ${week.count === 1 ? 'corrida' : 'corridas'} nesta semana`;
    return;
  }
  headerTitle.innerText = currentDay ? dayLabel(currentDay) : 'Treinos';
  headerTitle.classList.toggle('long', headerTitle.innerText.length > 14);
  if (!currentDay && activeDays().length === 0) {
    headerSubtitle.innerText = 'Monte seu primeiro treino';
    return;
  }
  // Conta os mesmos dias que aparecem marcados no calendário.
  const weekStart = getWeekStart(todayString());
  let count = 0;
  getLoggedWorkoutsByDate().forEach((_, date) => { if (date >= weekStart) count += 1; });
  headerSubtitle.innerText = `${count} treino${count !== 1 ? 's' : ''} nesta semana`;
}

function saveCompletedDay(day) {
  const logDate = sessionDateFor(day);
  const allTime = getAllTimeCompletedDays();
  if (!allTime.find(c => c && c.day === day && c.date === logDate)) {
    allTime.push({ day, date: logDate });
    localStorage.setItem('completedDaysAllTime', JSON.stringify(allTime));
  }
  trySync();
  updateHeaderTitle();
}

function markSessionStarted(day) {
  const activeKey = `sessaoAtivaData:${safeId(day)}`;
  const date = sessionDateFor(day);
  if (localStorage.getItem(activeKey) !== date) localStorage.setItem(activeKey, date);
  localStorage.setItem(activityKey(day), String(Date.now()));
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

// Mantém a tela acesa enquanto um treino da academia está em andamento (até
// 3 h, ou até ficar parado sem série). O timer de 1s atualiza o pedido.
const SCREEN_AWAKE_MAX_MS = 3 * 60 * 60 * 1000;
function setScreenAwake(on) { setAwake('gym', on); }

function isGymModeActive() {
  return !document.body.classList.contains('mode-cali') && !document.body.classList.contains('mode-mobi');
}

function updateLiveTimer() {
  const timerEl = document.getElementById('workoutTimer');
  if (!timerEl) return;
  if (!currentDay) { setScreenAwake(false); return; }
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
  const isCompletedToday = isWorkoutFinished(currentDay, sessionDateFor(currentDay));
  // Sem série registrada há um tempo (esqueceu de finalizar), o relógio para
  // na última série em vez de seguir contando por horas.
  const lastActivity = lastActivityAt(currentDay);
  const idle = lastActivity
    ? Date.now() - lastActivity > TIMER_IDLE_MS
    : Date.now() - Number(startRaw) > SCREEN_AWAKE_MAX_MS;
  const isLive = !endRaw && !isCompletedToday && !idle;
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
  } else if (idle) {
    endTime = Math.max(lastActivity, Number(startRaw));
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
  if (!btn || !currentDay) return;
  if (isWorkoutFinished(currentDay, sessionDateFor(currentDay))) {
    btn.innerText = "Treino Finalizado ✓";
    btn.disabled = true;
    btn.classList.add('finished');
  } else {
    btn.innerText = "Finalizar Treino Atual";
    // Igual à calistenia: só dá para finalizar depois da primeira série.
    btn.disabled = sessionProgress(currentDay).done === 0;
    btn.classList.remove('finished');
  }
}

// Séries feitas / previstas do treino na sessão atual. Exercício pulado hoje
// só conta as séries que chegaram a ser feitas.
function sessionProgress(day) {
  if (!workoutData[day]) return { done: 0, total: 0 };
  const skipped = getSkipped(day);
  let done = 0;
  let total = 0;
  workoutData[day].exercises.forEach(ex => {
    const n = setsFor(day, ex);
    const exDone = getSetsCompleted(day, ex).filter(i => i < n).length;
    total += skipped.includes(ex) ? exDone : n;
    done += exDone;
  });
  return { done, total };
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
    const todaySets = history.filter(h => h.date === logDate && entryInDay(h, day));
    if (todaySets.length === 0) return;
    const todayUnit = todaySets[todaySets.length - 1].unit || 'kg';
    const historyBeforeToday = history.filter(h => h.date !== logDate && (h.unit || 'kg') === todayUnit);
    if (historyBeforeToday.length === 0) return;
    const prevBest = historyBeforeToday.reduce((best, h) => isBetterSet(h, best) ? h : best);
    const bestToday = todaySets.reduce((best, h) => isBetterSet(h, best) ? h : best);
    if (isBetterSet(bestToday, prevBest)) {
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
  showSummaryModal({
    stats: [
      { value: summary.totalSets, label: 'Séries' },
      { value: summary.duration || '—', label: 'Duração' },
      { value: summary.prsToday.length, label: 'PRs' }
    ],
    prs: summary.prsToday.map(pr => ({ name: pr.exercise, value: setText(pr.exercise, pr, pr.unit) })),
    onShare: () => shareSummaryImage(day)
  });
}

async function shareSummaryImage(day) {
  const logDate = sessionDateFor(day);
  const logged = getExercisesLoggedForDay(day, logDate);
  const summary = buildWorkoutSummary(day);
  const volume = getDayVolumeKg(logged);
  const exercises = logged.map(item => {
    const progress = getDayProgress(item.exercise, logDate);
    const best = progress ? progress.best : item.sets[0];
    return {
      name: item.exercise,
      best: setText(item.exercise, best, best.unit || 'kg'),
      pr: !!(progress && progress.isPR)
    };
  });
  const levelByName = {};
  logged.forEach(item => (db[item.exercise] ? db[item.exercise].sec : []).forEach(m => { levelByName[m] = 'secondary'; }));
  logged.forEach(item => { if (db[item.exercise]) levelByName[db[item.exercise].prim] = 'primary'; });
  const blob = await buildSummaryImage({
    title: dayLabel(day),
    dateLabel: longDateLabel(logDate),
    stats: [
      { value: summary.duration || '—', label: 'Duração' },
      { value: String(summary.totalSets), label: 'Séries' },
      { value: volume > 0 ? `${Math.round(volume).toLocaleString('pt-BR')} kg` : '—', label: 'Volume' }
    ],
    exercises,
    levels: regionLevels(levelByName)
  });
  await shareOrDownload(blob, `treino-${logDate}.png`, `Treino ${dayLabel(day)}`);
}

function loadProgress(day, exercise) {
  return { weight: '', reps: '', notes: '', unit: getLastUsedUnit(exercise), ...readJSON(storageKey(day, exercise), {}) };
}

function saveProgressData(day, exercise, weight, reps, notes, setIndex, unit) {
  localStorage.setItem(storageKey(day, exercise), JSON.stringify({ weight, reps, notes, unit }));
  const history = loadHistory(exercise);
  const logDate = sessionDateFor(day);
  const entry = { date: logDate, day, weight: parseNum(weight), reps: parseNum(reps), setIndex, notes: notes || '', unit: unit || 'kg' };
  const existingIdx = history.findIndex(h => h.date === logDate && h.setIndex === setIndex && entryInDay(h, day));
  if (existingIdx >= 0) {
    history[existingIdx] = entry;
  } else {
    history.push(entry);
  }
  saveHistory(exercise, history);
  trySync();
}

// Um valor corrompido (backup restaurado com defeito, por exemplo) vira lista
// vazia em vez de travar o app inteiro na abertura. Registros antigos sem
// unidade ou sem anotação: kg e ''.
function buildHistory(list) {
  return list
    .filter(h => h && typeof h === 'object' && typeof h.date === 'string')
    .map(h => ({ unit: 'kg', notes: '', ...h }));
}
function loadHistory(exercise) { return readListCached(historyKey(exercise), buildHistory); }

// Grava sem os campos com valor padrão (unidade kg, anotação vazia): cerca de
// um quarto a menos de espaço — em anos de treino, o armazenamento do celular
// (~5 MB) chegava perto do limite. A leitura completa os campos.
function saveHistory(exercise, list) {
  const compact = list.filter(h => h && typeof h === 'object').map(({ unit, notes, ...rest }) => {
    const out = rest;
    if (unit && unit !== 'kg') out.unit = unit;
    if (notes) out.notes = notes;
    return out;
  });
  localStorage.setItem(historyKey(exercise), JSON.stringify(compact));
}
function getSetsCompleted(day, exercise) { return readJSON(setsKey(day, exercise), []).filter(Number.isInteger); }
// Primeira série ainda não feita (se você desmarcou a 2ª com a 3ª feita, é a 2ª),
// ou -1 quando todas estão concluídas.
// Com as previstas feitas, é a próxima série extra (até MAX_EXTRA_SETS a mais).
const MAX_EXTRA_SETS = 5;
function nextFreeSetIndex(day, exercise) {
  const done = getSetsCompleted(day, exercise);
  const limit = setsFor(day, exercise) + MAX_EXTRA_SETS;
  for (let i = 0; i < limit; i++) if (!done.includes(i)) return i;
  return -1;
}
// Registro do histórico pertence a esse treino? Registros antigos não guardavam o treino.
function entryInDay(h, day) { return !h.day || h.day === day; }
function bestSetOf(sets) {
  return sets.reduce((best, h) => isBetterSet(h, best) ? h : best);
}

// Uma série como texto, conforme o tipo do exercício: "40kg × 10", "12 reps" ou "30s".
function setText(exercise, s, unit) {
  const type = exerciseType(exercise);
  if (type === 'time') return fmtSeconds(s.reps);
  if (type === 'reps') return `${s.reps} rep${s.reps === 1 ? '' : 's'}`;
  return `${formatLoad(s.weight, unit || s.unit || 'kg')} × ${s.reps}`;
}

// Igual, com o "×" apagado dos chips de série.
function setChipHtml(exercise, s, unit) {
  if (exerciseType(exercise) !== 'load') return setText(exercise, s, unit);
  return `${formatLoad(s.weight, unit || s.unit || 'kg')} <span class="evo-set-chip-x">×</span> ${s.reps}`;
}

function describeLoadDelta(cur, prev, unit, type = 'load') {
  const sign = n => (n > 0 ? '+' : '-');
  if (type === 'time' && cur.reps !== prev.reps) {
    const diff = cur.reps - prev.reps;
    return { dir: diff > 0 ? 'up' : 'down', text: `${sign(diff)}${fmtSeconds(Math.abs(diff))}` };
  }
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
    isPR: isBetterSet(best, prevRecord),
    prevRecord,
    prevDate,
    delta: describeLoadDelta(best, bestSetOf(prior.filter(h => h.date === prevDate)), unit, exerciseType(exercise))
  };
}

function dayTrendHtml(progress) {
  if (!progress) return '';
  if (progress.isFirst) return '<span class="day-trend">1º registro</span>';
  if (progress.isPR) return '<span class="day-trend pr">🏆 PR</span>';
  const arrow = { up: '↑', down: '↓', same: '=' }[progress.delta.dir];
  return `<span class="day-trend ${progress.delta.dir}">${arrow} ${progress.delta.text.replace(/^[+-]/, '')} <span class="day-trend-vs">vs ${formatDateShortBR(progress.prevDate)}</span></span>`;
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
  return history.reduce((best, h) => isBetterSet(h, best) ? h : best);
}

// Só avisa recorde (fato), sem mensagens de "coaching". Precisa de treino em
// outro dia para comparar: no primeiro treino do exercício, cada série mais
// pesada que a anterior aparecia como "Novo recorde pessoal".
function maybeShowSetFeedback(exercise, historyBefore, weight, reps, unit, sessionDate) {
  if (!reps) return;
  const sameUnitHistory = historyBefore.filter(h => (h.unit || 'kg') === unit);
  if (!sameUnitHistory.some(h => h.date < sessionDate)) return;
  const prevBest = sameUnitHistory.length > 0
    ? sameUnitHistory.reduce((best, h) => isBetterSet(h, best) ? h : best)
    : null;
  const isNewPR = prevBest && isBetterSet({ weight, reps }, prevBest);
  if (isNewPR) {
    showToast('🏆 Novo recorde pessoal!', `${setText(exercise, { weight, reps }, unit)} supera seu melhor anterior (${setText(exercise, prevBest, unit)}).`);
  }
}

function toggleSet(day, exercise, index) {
  const sets = getSetsCompleted(day, exercise);
  const existing = sets.indexOf(index);
  if (existing >= 0) {
    sets.splice(existing, 1);
    const date = sessionDateFor(day);
    saveHistory(exercise, loadHistory(exercise).filter(h => !(h.date === date && h.setIndex === index && entryInDay(h, day))));
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
  if (!day) { updateHeaderTitle(); return; }
  const { done, total } = sessionProgress(day);
  sessionCountEl.innerHTML = `${done}<span class="session-total">/${total}</span>`;
  sessionFillEl.style.width = `${total > 0 ? (done / total) * 100 : 0}%`;
  updateHeaderTitle();
}

function loadBodyMetrics() {
    // Em ordem de data: "último valor" e os gráficos dependem disso.
    return readJSON('bodyMetrics', []).filter(m => m && typeof m.date === 'string').sort((a, b) => a.date.localeCompare(b.date));
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
        return `<div class="body-chart-empty">${emptyStateHtml('chart', 'Poucos registros', 'Salve essa medida em dois dias diferentes para ver o gráfico.')}</div>`;
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

    // Marcas em valores redondos (antes 79.5, 80.5, 81.6...).
    let gridHtml = '';
    niceTicks(min, max, { target: 3 }).forEach(w => {
        const y = PAD_TOP + innerH - ((w - min) / (max - min)) * innerH;
        gridHtml += `<line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />`;
        gridHtml += `<text x="${(PAD_LEFT - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${w}</text>`;
    });
    // Com muitos registros os números se atropelavam: mostra todos só até 6
    // pontos; depois, o primeiro, o último, o menor e o maior.
    const labeled = new Set(points.map((_, i) => i));
    if (points.length > 6) {
        labeled.clear();
        const vals = points.map(p => p.val);
        [0, points.length - 1, vals.indexOf(Math.min(...vals)), vals.indexOf(Math.max(...vals))].forEach(i => labeled.add(i));
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
        dotsHtml += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${points.length > 12 ? 3 : 4}" fill="var(--bg)" stroke="var(--accent)" stroke-width="2" />`;
        if (labeled.has(idx)) dotsHtml += `<text x="${p.x.toFixed(1)}" y="${(p.y - 12).toFixed(1)}" text-anchor="${idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}" font-family="var(--font-mono)" font-weight="700" font-size="10" fill="var(--accent)">${p.val}</text>`;
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

// Lista das medidas salvas, da mais recente para a mais antiga, com botão para
// apagar — um valor digitado errado (ex.: 800 em vez de 80.0) estragava o
// gráfico para sempre.
const BODY_RECORDS_VISIBLE = 6;
function bodyRecordsHtml(metrics) {
    const fields = Object.keys(bodyMetricsMap);
    const records = metrics.filter(m => m && m.date && fields.some(f => m[f])).slice().reverse();
    if (records.length === 0) return '';
    const rows = records.map((m, i) => {
        const chips = fields.filter(f => m[f]).map(f => `<span class="body-record-chip">${bodyMetricsMap[f].label} <b>${m[f]}${bodyMetricsMap[f].unit}</b></span>`).join('');
        return `<div class="body-record ${i >= BODY_RECORDS_VISIBLE ? 'hidden' : ''}">
            <div class="body-record-main">
                <span class="body-record-date">${formatDateBR(m.date)}</span>
                <div class="body-record-chips">${chips}</div>
            </div>
            <button type="button" class="body-record-del" data-record-date="${m.date}" aria-label="Apagar registro de ${formatDateBR(m.date)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
            </button>
        </div>`;
    }).join('');
    const hidden = records.length - BODY_RECORDS_VISIBLE;
    return `
        <div class="body-card" id="bodyRecords">
            <div class="body-card-title">Registros</div>
            ${rows}
            ${hidden > 0 ? `<button type="button" class="evo-show-more-btn" id="bodyRecordsMore">Ver ${hidden} registro${hidden > 1 ? 's' : ''} mais antigo${hidden > 1 ? 's' : ''}</button>` : ''}
        </div>`;
}

function renderBodyModal() {
    const content = document.getElementById('bodyModalContent');
    const metrics = loadBodyMetrics();
    // Cada medida tem sua própria história (braço pode ter sido medido há um
    // mês e o peso ontem), então primeiro/último valor são por campo.
    const withField = field => metrics.filter(m => m[field]);
    const latest = {};
    const first = {};
    Object.keys(bodyMetricsMap).forEach(field => {
        const list = withField(field);
        latest[field] = list.length ? list[list.length - 1][field] : null;
        first[field] = list.length ? list[0][field] : null;
    });

    // Diferença desde a primeira medida, com sinal e sem cor de "bom/ruim":
    // subir ou descer depende do seu objetivo.
    function deltaText(field, unit) {
        if (withField(field).length < 2) return null;
        const diff = Math.round((latest[field] - first[field]) * 10) / 10;
        if (diff === 0) return 'Igual ao início';
        return `${diff > 0 ? '+' : '−'}${Math.abs(diff)}${unit} desde o início`;
    }

    function getDeltaHtml(field) {
        const text = deltaText(field, 'cm');
        return `<div class="body-delta flat">${text || '--'}</div>`;
    }

    function getWeightDeltaHtml() {
        const text = deltaText('weight', 'kg');
        return text ? `<div class="body-delta flat">${text}</div>` : '';
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
                    ${getDeltaHtml('waist')}
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
        ${bodyRecordsHtml(metrics)}
    `;

    const recordsList = document.getElementById('bodyRecords');
    if (recordsList) {
        recordsList.addEventListener('click', async (e) => {
            const more = e.target.closest('#bodyRecordsMore');
            if (more) {
                recordsList.querySelectorAll('.body-record.hidden').forEach(el => el.classList.remove('hidden'));
                more.remove();
                return;
            }
            const del = e.target.closest('[data-record-date]');
            if (!del) return;
            const date = del.dataset.recordDate;
            const ok = await confirmDialog({
                title: 'Apagar este registro?',
                text: `As medidas salvas em ${formatDateBR(date)} saem do histórico e dos gráficos.`,
                confirmLabel: 'Apagar registro',
                danger: true
            });
            if (!ok) return;
            localStorage.setItem('bodyMetrics', JSON.stringify(loadBodyMetrics().filter(m => m.date !== date)));
            trySync();
            renderBodyModal();
            showToast('Registro apagado', `Medidas de ${formatDateBR(date)} removidas.`);
        });
    }

    document.getElementById('bodyChartTabs').querySelectorAll('.sheet-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activeBodyMetric = e.target.dataset.metric;
            document.getElementById('bodyChartTabs').querySelectorAll('.sheet-tab').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('bodyMainChartContainer').innerHTML = buildMetricChartSVG(metrics, activeBodyMetric);
        });
    });

    // Salva o peso sempre que preenchido (pesar de novo e dar igual também é um
    // registro), mas as circunferências só quando mudaram — antes cada "Salvar"
    // copiava todas as medidas para a data nova, como se tivessem sido medidas.
    document.getElementById('saveBodyBtn').addEventListener('click', () => {
        const data = {};
        const weight = parseNum(document.getElementById('bm-weight').value);
        if (weight) data.weight = weight;
        ['arm', 'chest', 'waist', 'thigh', 'calf'].forEach(field => {
            const value = parseNum(document.getElementById(`bm-${field}`).value);
            if (value && value !== latest[field]) data[field] = value;
        });
        if (Object.keys(data).length === 0) {
            showToast('Nada para salvar', 'Preencha o peso ou mude alguma medida.');
            return;
        }
        saveBodyMetrics(data);
    });
}

function bindTopMenu() {
    const btn = document.getElementById('topMenuBtn');
    const menu = document.getElementById('topMenu');
    const setOpen = (open) => {
        menu.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!menu.classList.contains('open')); });
    // Escolher uma opção ou tocar fora fecha o menu.
    menu.addEventListener('click', () => setOpen(false));
    document.addEventListener('click', (e) => { if (!e.target.closest('.top-menu-wrap')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

function bindTopBarModals() {
    document.getElementById('configBtn').addEventListener('click', () => {
        if (configModal) configModal.classList.add('visible');
    });
    document.getElementById('closeConfig').addEventListener('click', () => {
        if (configModal) configModal.classList.remove('visible');
    });
    document.getElementById('catalogBtn').addEventListener('click', () => openCatalog());
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

// ---------- Meus treinos (Configurações › Meus Treinos e o "+" ao lado dos treinos) ----------
// Criar, renomear, mudar a cor, reordenar e apagar treinos, e montar cada um com
// exercícios do catálogo. O histórico e as séries ficam nas mesmas chaves (pelo id
// do treino e o nome do exercício), então nada registrado se perde.
let planEditDay = null;

// Escolhe o treino mostrado na tela principal (ou nenhum, se não houver).
function selectDay(day) {
  currentDay = day && workoutData[day] && !workoutData[day].archived ? day : (activeDays()[0] || null);
  if (currentDay) localStorage.setItem(LAST_DAY_KEY, currentDay);
  expandedExerciseId = null;
}

function refreshGymScreen() {
  if (!currentDay || !workoutData[currentDay] || workoutData[currentDay].archived) selectDay(currentDay);
  renderExercises(currentDay);
  updateSessionBar(currentDay);
  updateLiveTimer();
  applyGymView();
}

function applyPlanChange() {
  savePlan();
  trySync();
  refreshGymScreen();
  if (document.getElementById('planModal').classList.contains('visible')) renderPlanEditor();
}

function removeFromPlan(day, exercise) {
  const plan = workoutData[day];
  plan.exercises = plan.exercises.filter(ex => ex !== exercise);
  if (!plan.retired.includes(exercise)) plan.retired.push(exercise);
}

// planSwap: exercício escolhido em "Trocar". O novo entra no lugar dele (mesma
// posição e número de séries) e o antigo sai com o histórico guardado.
let planSwap = null;
function addToPlan(day, exercise) {
  const plan = workoutData[day];
  if (plan.exercises.includes(exercise)) { planSwap = null; return; }
  const idx = plan.exercises.indexOf(planSwap);
  if (idx >= 0) {
    const old = planSwap;
    plan.exercises[idx] = exercise;
    if (plan.sets[old]) plan.sets[exercise] = plan.sets[old];
    if (!plan.retired.includes(old)) plan.retired.push(old);
  } else {
    plan.exercises.push(exercise);
  }
  planSwap = null;
  plan.retired = plan.retired.filter(ex => ex !== exercise);
}

// Tem algum registro desse treino? (decide se apagar arquiva ou remove de vez)
function workoutHasHistory(day) {
  if (getAllTimeCompletedDays().some(c => c.day === day)) return true;
  return exercisesEverIn(day).some(ex => loadHistory(ex).some(h => h.day === day));
}

const planIcon = {
  up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>',
  left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  remove: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
  swap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/></svg>'
};

const TYPE_TAG = { reps: 'reps', time: 'tempo' };

// Cartões dos modelos prontos (tela de boas-vindas e fim do editor).
function templatesHtml() {
  return `<div class="template-list">${TEMPLATES.map(t => `
    <button type="button" class="template-card" data-template="${t.id}">
      <span class="template-name">${t.name}</span>
      <span class="template-desc">${t.desc}</span>
      <span class="template-workouts">${t.workouts.map(w => `<span>${w.name} · ${w.exercises.length}</span>`).join('')}</span>
    </button>`).join('')}</div>`;
}

function applyTemplate(id) {
  const template = TEMPLATES.find(t => t.id === id);
  if (!template) return null;
  const ids = template.workouts.map(w => createWorkout(w.name, w.exercises, w.sets || {}));
  trySync();
  showToast(ids.length > 1 ? 'Treinos criados' : 'Treino criado', `${template.workouts.map(w => w.name).join(', ')}. Dá para mudar tudo em Meus Treinos.`);
  return ids[0];
}

async function newWorkoutFlow() {
  const name = await promptDialog({
    title: 'Novo treino',
    text: 'Dê um nome ao treino. Depois você escolhe os exercícios.',
    placeholder: 'Ex: Peito e Tríceps',
    confirmLabel: 'Criar treino'
  });
  if (!name) return;
  const id = createWorkout(name);
  trySync();
  selectDay(id);
  setGymView('lift');
  refreshGymScreen();
  openPlanEditor(id);
}

function openPlanEditor(day) {
  planEditDay = day && workoutData[day] && !workoutData[day].archived ? day : (currentDay || activeDays()[0] || null);
  planSwap = null;
  renderPlanEditor();
  document.getElementById('planModal').classList.add('visible');
}

function renderPlanEditor() {
  const content = document.getElementById('planModalContent');
  const active = activeDays();
  if (!planEditDay || !active.includes(planEditDay)) planEditDay = active[0] || null;
  const day = planEditDay;
  const tabs = active.map(d => `<button type="button" class="tab-btn ${d === day ? 'active' : ''}" data-plan-day="${d}" style="--tab-color:${getDayColor(d)}"><span class="tab-dot" style="background:${getDayColor(d)}"></span>${dayLabel(d)}</button>`).join('')
    + '<button type="button" class="tab-btn tab-add" data-plan-new aria-label="Criar treino">+ Novo</button>';
  if (!day) {
    content.innerHTML = `
      <nav class="selectors scroll plan-tabs">${tabs}</nav>
      <div class="plan-intro">
        <p>Você ainda não tem treinos. Crie um do zero ou comece com um modelo pronto.</p>
      </div>
      ${templatesHtml()}`;
    return;
  }
  const plan = workoutData[day];
  const position = active.indexOf(day);
  // Tocar no exercício abre a configuração dele (séries, carga, reps e descanso).
  const rows = plan.exercises.map((ex, i) => {
    const tag = TYPE_TAG[exerciseType(ex)];
    return `
      <div class="plan-row ${ex === planSwap ? 'swapping' : ''}" data-idx="${i}">
        <button type="button" class="plan-main" data-act="config" aria-label="Configurar ${ex.replace(/"/g, '&quot;')}">
          ${thumbHtml(db[ex], ex, '', { small: true, interactive: false })}
          <span class="plan-text">
            <span class="plan-name">${ex}${tag ? ` <small class="type-tag">${tag}</small>` : ''}</span>
            <span class="plan-summary">${exerciseSummary(day, ex)}</span>
          </span>
          <span class="plan-edit" aria-hidden="true">${planIcon.edit}</span>
        </button>
        <div class="plan-tools">
          <div class="plan-move">
            <button type="button" class="plan-icon" data-act="up" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${planIcon.up}</button>
            <button type="button" class="plan-icon" data-act="down" aria-label="Descer" ${i === plan.exercises.length - 1 ? 'disabled' : ''}>${planIcon.down}</button>
          </div>
          <button type="button" class="plan-icon" data-act="swap" aria-label="Trocar ${ex} por outro exercício" aria-pressed="${ex === planSwap}">${planIcon.swap}</button>
          <button type="button" class="plan-icon plan-remove" data-act="remove" aria-label="Tirar do treino">${planIcon.remove}</button>
        </div>
      </div>`;
  }).join('');
  const swatches = WORKOUT_COLORS.map(c => `<button type="button" class="color-swatch ${c === plan.color ? 'active' : ''}" data-plan-color="${c}" style="background:${c}" aria-label="Cor ${c}" aria-pressed="${c === plan.color}"></button>`).join('');
  const muscleOptions = Object.keys(MUSCLE_CATEGORIES).map(m => `<option value="${m}">${m}</option>`).join('');
  const typeOptions = Object.entries(EXERCISE_TYPES).map(([id, label]) => `<option value="${id}">${label}</option>`).join('');

  content.innerHTML = `
    <nav class="selectors scroll plan-tabs">${tabs}</nav>
    <section class="plan-head">
      <div class="plan-head-row">
        <span class="plan-head-name">${plan.name}</span>
        <button type="button" class="plan-icon" data-plan-rename aria-label="Renomear treino">${planIcon.edit}</button>
      </div>
      <div class="color-row" role="group" aria-label="Cor do treino">${swatches}</div>
      <div class="plan-head-actions">
        <button type="button" class="plan-icon" data-plan-move="-1" aria-label="Mover para a esquerda" ${position === 0 ? 'disabled' : ''}>${planIcon.left}</button>
        <button type="button" class="plan-icon" data-plan-move="1" aria-label="Mover para a direita" ${position === active.length - 1 ? 'disabled' : ''}>${planIcon.right}</button>
        <button type="button" class="set-edit-link danger" data-plan-delete>Apagar treino</button>
      </div>
    </section>
    <div class="plan-list">${rows || '<p class="plan-empty">Nenhum exercício nesse treino ainda.</p>'}</div>
    <button type="button" id="planAddBtn" class="save-btn plan-btn plan-add">${planSwap ? `Escolher exercício no lugar de ${planSwap}` : 'Adicionar exercícios'}</button>
    ${planSwap ? '<button type="button" id="planSwapCancel" class="set-edit-link plan-swap-cancel">Cancelar troca</button>'
      : plan.exercises.length ? '<button type="button" id="planConfigBtn" class="save-btn plan-btn">Configurar séries, cargas e descanso</button>' : ''}
    <div class="backup-section">
      <h3 id="planAddTitle">Criar exercício novo</h3>
      <input type="text" id="planNewName" class="plan-input" maxlength="60" placeholder="Nome do exercício">
      <label class="plan-label" for="planNewMuscle">Músculo principal</label>
      <select id="planNewMuscle" class="plan-input">${muscleOptions}</select>
      <label class="plan-label" for="planNewType">Como registrar</label>
      <select id="planNewType" class="plan-input">${typeOptions}</select>
      <button type="button" id="planNewBtn" class="save-btn plan-btn">${planSwap ? `Criar e trocar por ${planSwap}` : `Criar e adicionar ao ${dayLabel(day)}`}</button>
      <h3>Modelos prontos</h3>
      <p class="plan-intro">Cria os treinos do modelo, além dos que você já tem.</p>
      ${templatesHtml()}
    </div>`;
  revealActiveTab(content.querySelector('.plan-tabs'));
}

// Fileira rolável de treinos: deixa o botão escolhido à vista.
function revealActiveTab(row) {
  const active = row && row.querySelector('.tab-btn.active');
  if (!active) return;
  const left = active.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
  row.scrollLeft = Math.max(0, left - (row.clientWidth - active.offsetWidth) / 2);
}

function createCustomExercise(rawName, prim, type) {
  const name = rawName.trim().replace(/\s+/g, ' ');
  const invalid = text => { alertDialog({ title: 'Não deu para criar', text }); return null; };
  if (name.length < 2) return invalid('Digite o nome do exercício.');
  if (/["<>\\&]/.test(name)) return invalid('O nome não pode ter os caracteres " < > \\ &');
  // Mesmo nome de um que já existe: usa o existente (o histórico é pelo nome).
  const existing = Object.keys(db).find(ex => ex.toLowerCase() === name.toLowerCase() || safeId(ex).toLowerCase() === safeId(name).toLowerCase());
  if (existing) return existing;
  if (!safeId(name)) return invalid('Use pelo menos uma letra ou número sem acento no nome.');
  addCustomExercise(name, prim, type);
  return name;
}

function bindPlanEditor() {
  const modal = document.getElementById('planModal');
  const content = document.getElementById('planModalContent');
  document.getElementById('editPlanBtn').addEventListener('click', () => openPlanEditor(currentDay));
  document.getElementById('closePlan').addEventListener('click', () => modal.classList.remove('visible'));

  content.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-plan-day]');
    if (tab) { planEditDay = tab.dataset.planDay; planSwap = null; renderPlanEditor(); return; }
    if (e.target.closest('[data-plan-new]')) {
      const name = await promptDialog({ title: 'Novo treino', text: 'Dê um nome ao treino.', placeholder: 'Ex: Peito e Tríceps', confirmLabel: 'Criar treino' });
      if (!name) return;
      planEditDay = createWorkout(name);
      if (!currentDay) selectDay(planEditDay);
      applyPlanChange();
      return;
    }
    const templateBtn = e.target.closest('[data-template]');
    if (templateBtn) {
      const first = applyTemplate(templateBtn.dataset.template);
      if (!first) return;
      planEditDay = first;
      if (!currentDay) selectDay(first);
      applyPlanChange();
      return;
    }
    if (e.target.closest('#planSwapCancel')) { planSwap = null; renderPlanEditor(); return; }
    const day = planEditDay;
    if (!day) return;
    const plan = workoutData[day];
    if (e.target.closest('[data-plan-rename]')) {
      const name = await promptDialog({ title: 'Renomear treino', text: `Nome atual: ${plan.name}`, placeholder: plan.name, confirmLabel: 'Salvar nome' });
      if (!name) return;
      updateWorkout(day, { name });
      applyPlanChange();
      return;
    }
    const color = e.target.closest('[data-plan-color]');
    if (color) { updateWorkout(day, { color: color.dataset.planColor }); applyPlanChange(); return; }
    const move = e.target.closest('[data-plan-move]');
    if (move && !move.disabled) { moveWorkout(day, Number(move.dataset.planMove)); applyPlanChange(); return; }
    if (e.target.closest('[data-plan-delete]')) {
      const hasHistory = workoutHasHistory(day);
      const ok = await confirmDialog({
        title: `Apagar o treino ${plan.name}?`,
        text: hasHistory
          ? 'Ele sai da lista de treinos. Os dias já treinados continuam no calendário e nas estatísticas.'
          : 'Ele sai da lista de treinos. Não dá para desfazer.',
        confirmLabel: 'Apagar treino',
        danger: true
      });
      if (!ok) return;
      deleteWorkout(day, hasHistory);
      if (currentDay === day) selectDay(null);
      planEditDay = null;
      applyPlanChange();
      return;
    }

    if (e.target.closest('#planAddBtn')) {
      // Escolhe vários de uma vez; no fim pergunta se quer configurar agora.
      const swapping = !!planSwap;
      openCatalog({
        pickFor: day,
        title: swapping ? `Trocar ${planSwap}` : `Adicionar ao ${plan.name}`,
        multi: !swapping,
        onConfigure: ex => openExerciseConfig(day, [ex]),
        onPick: async list => {
          list.forEach(ex => addToPlan(day, ex));
          applyPlanChange();
          if (swapping) return;
          const ok = await confirmDialog({
            title: list.length === 1 ? 'Exercício adicionado' : `${list.length} exercícios adicionados`,
            text: 'Quer configurar agora as séries, a carga e o descanso? Dá para mudar depois tocando no exercício.',
            confirmLabel: 'Configurar agora',
            cancelLabel: 'Depois'
          });
          if (ok) openExerciseConfig(day, list);
        }
      });
      return;
    }
    if (e.target.closest('#planConfigBtn')) { openExerciseConfig(day, plan.exercises); return; }
    if (e.target.closest('#planNewBtn')) {
      const name = createCustomExercise(document.getElementById('planNewName').value, document.getElementById('planNewMuscle').value, document.getElementById('planNewType').value);
      if (!name) return;
      addToPlan(day, name);
      applyPlanChange();
      return;
    }

    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const idx = Number(btn.closest('.plan-row').dataset.idx);
    const ex = plan.exercises[idx];
    const act = btn.dataset.act;
    if (act === 'config') { openExerciseConfig(day, [ex]); return; }
    if (act === 'swap') {
      planSwap = planSwap === ex ? null : ex;
      renderPlanEditor();
      if (planSwap) document.getElementById('planAddBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (act === 'up' || act === 'down') {
      const to = act === 'up' ? idx - 1 : idx + 1;
      [plan.exercises[idx], plan.exercises[to]] = [plan.exercises[to], plan.exercises[idx]];
    } else if (act === 'remove') {
      const ok = await confirmDialog({
        title: `Tirar do ${dayLabel(day)}?`,
        text: `${ex} sai do treino. O histórico dele continua salvo e você pode adicioná-lo de volta quando quiser.`,
        confirmLabel: 'Tirar do treino',
        danger: true
      });
      if (!ok) return;
      removeFromPlan(day, ex);
    }
    applyPlanChange();
  });
}

// ---------- Configurar exercícios: séries, carga, repetições e descanso ----------
// Grava nas mesmas chaves que o app já usava (e a versão 2.6 também): séries no
// treino, treino:<dia>:<exercício> (o que o card traz preenchido) e
// rest:ex:<exercício> (descanso do cronômetro). Cada mudança já fica salva.
const REST_CHOICES = [60, 90, 120, 180];
const exConfigModal = document.getElementById('exConfigModal');
const exConfigContent = document.getElementById('exConfigContent');
let exConfigDay = null;

function fmtRest(s) { return s % 60 ? `${Math.floor(s / 60)}:${pad2(s % 60)}` : `${s / 60} min`; }
function restFor(ex) { return Number(localStorage.getItem(`rest:ex:${ex}`)) || 0; }

// "3 séries · 40 kg × 10 · descanso 1:30" (linha embaixo do nome em Meus Treinos).
function exerciseSummary(day, ex) {
  const n = setsFor(day, ex);
  const type = exerciseType(ex);
  const p = loadProgress(day, ex);
  const parts = [`${n} ${n === 1 ? 'série' : 'séries'}`];
  if (type === 'load' && p.weight !== '') parts.push(formatLoad(p.weight, p.unit) + (p.reps !== '' ? ` × ${p.reps}` : ''));
  else if (type !== 'load' && p.reps !== '') parts.push(type === 'time' ? fmtSeconds(Number(p.reps)) : `${p.reps} reps`);
  const rest = restFor(ex);
  if (rest) parts.push(`descanso ${fmtRest(rest)}`);
  return parts.join(' · ');
}

function exConfigCardHtml(day, ex) {
  const type = exerciseType(ex);
  const p = loadProgress(day, ex);
  const n = setsFor(day, ex);
  const rest = restFor(ex);
  const value = ex.replace(/"/g, '&quot;');
  const attr = v => String(v).replace(/"/g, '&quot;');
  return `
    <section class="cfg-card" data-ex="${value}">
      <div class="cfg-head">${thumbHtml(db[ex], ex, `data-guide="${value}"`, { small: true })}<span class="cfg-name">${ex}</span></div>
      <div class="cfg-line">
        <span class="cfg-label">Séries</span>
        <div class="plan-sets">
          <button type="button" class="plan-icon" data-cfg="less" aria-label="Menos uma série" ${n <= 1 ? 'disabled' : ''}>−</button>
          <span class="plan-sets-num">${n}</span>
          <button type="button" class="plan-icon" data-cfg="more" aria-label="Mais uma série" ${n >= MAX_SETS ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="input-row">
        ${type === 'load' ? `<div class="input-group"><label>Carga (${unitLabel(p.unit)})</label><input type="number" inputmode="decimal" min="0" data-cfg-field="weight" value="${attr(p.weight)}" placeholder="—"></div>` : ''}
        <div class="input-group"><label>${REPS_LABEL[type]}</label><input type="number" inputmode="numeric" min="0" data-cfg-field="reps" value="${attr(p.reps)}" placeholder="—"></div>
      </div>
      <div class="cfg-line">
        <span class="cfg-label">Descanso</span>
        <div class="cfg-rest" role="group" aria-label="Descanso">${REST_CHOICES.map(s => `<button type="button" class="cfg-chip ${s === rest ? 'active' : ''}" data-cfg-rest="${s}" aria-pressed="${s === rest}">${fmtRest(s)}</button>`).join('')}</div>
      </div>
    </section>`;
}

function openExerciseConfig(day, list) {
  const plan = workoutData[day];
  const exercises = plan ? list.filter(ex => plan.exercises.includes(ex)) : [];
  if (!exercises.length) return;
  exConfigDay = day;
  document.getElementById('exConfigTitle').textContent = exercises.length === 1 ? 'Configurar exercício' : `Configurar ${plan.name}`;
  exConfigContent.innerHTML = exercises.map(ex => exConfigCardHtml(day, ex)).join('')
    + '<button type="button" class="save-btn cfg-done" data-cfg-done>Pronto</button>';
  exConfigContent.scrollTop = 0;
  exConfigModal.classList.add('visible');
}

function bindExerciseConfig() {
  const close = () => exConfigModal.classList.remove('visible');
  document.getElementById('closeExConfig').addEventListener('click', close);
  exConfigContent.addEventListener('click', e => {
    if (e.target.closest('[data-cfg-done]')) { close(); return; }
    const guide = e.target.closest('[data-guide]');
    if (guide) { showExerciseGuide(guide.dataset.guide); return; }
    const card = e.target.closest('.cfg-card');
    const plan = workoutData[exConfigDay];
    if (!card || !plan) return;
    const ex = card.dataset.ex;
    const step = e.target.closest('[data-cfg]');
    if (step && !step.disabled) {
      const n = Math.max(1, Math.min(MAX_SETS, setsFor(exConfigDay, ex) + (step.dataset.cfg === 'more' ? 1 : -1)));
      plan.sets[ex] = n;
      card.querySelector('.plan-sets-num').textContent = n;
      card.querySelector('[data-cfg="less"]').disabled = n <= 1;
      card.querySelector('[data-cfg="more"]').disabled = n >= MAX_SETS;
      applyPlanChange();
      return;
    }
    const chip = e.target.closest('[data-cfg-rest]');
    if (chip) {
      localStorage.setItem(`rest:ex:${ex}`, chip.dataset.cfgRest);
      card.querySelectorAll('[data-cfg-rest]').forEach(c => {
        c.classList.toggle('active', c === chip);
        c.setAttribute('aria-pressed', String(c === chip));
      });
      applyPlanChange();
    }
  });
  exConfigContent.addEventListener('change', e => {
    const field = e.target.dataset.cfgField;
    if (!field || !exConfigDay) return;
    const ex = e.target.closest('.cfg-card').dataset.ex;
    const p = loadProgress(exConfigDay, ex);
    const v = e.target.value.trim();
    p[field] = v === '' || !(Number(v) >= 0) ? '' : v;
    e.target.value = p[field];
    localStorage.setItem(storageKey(exConfigDay, ex), JSON.stringify({ weight: p.weight, reps: p.reps, notes: p.notes, unit: p.unit }));
    applyPlanChange();
  });
}

// Marcas de "série feita" (series:) e de "pulado" (pulados:) só valem para a
// sessão em andamento; o histórico guarda todas as séries. As de dias antigos
// eram peso morto no armazenamento e no backup (~13% do espaço em 3 anos).
const STALE_SESSION_DAYS = 7;
function pruneStaleSessionKeys() {
  const d = new Date();
  d.setDate(d.getDate() - STALE_SESSION_DAYS);
  const cutoff = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const stale = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const m = /^(?:series|pulados):.+:(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (m && m[1] < cutoff) stale.push(key);
  }
  stale.forEach(key => localStorage.removeItem(key));
}

function init() {
  pruneStaleSessionKeys();
  updateHeaderTitle();
  renderDaySelectors();
  renderExercises(currentDay);
  updateSessionBar(currentDay);
  updateLiveTimer();
  initRestTimer();
  bindStatsSheet();
  bindBackupSystem();
  bindInfoModal();
  bindSummaryModal();
  bindFinishDay();
  bindTopBarModals();
  bindTopMenu();
  bindCalendarModal();
  bindDayDetailModal();
  bindDateFixTool();
  bindPlanEditor();
  bindExerciseConfig();
  initBackNav();
  initVersionInfo();
  requestPersistentStorage();
  bindStorageFullWarning();
  initAutoUpdate();
  initRun({ onChange: onRunsChanged });
  bindWelcome();
  bindCatalog();
  bindModuleSettings();
  applyGymView();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshIfNewDay(); });
  // Abriu: desliga a tela de resgate (js/rescue.js).
  if (window.treinoReady) window.treinoReady();
}

// Versão em Configurações > App. Na primeira vez que uma versão nova abre,
// um aviso curto confirma que a atualização chegou.
const VERSION_SEEN_KEY = 'app:version';
function initVersionInfo() {
  document.getElementById('appVersion').textContent = APP_VERSION;
  const seen = localStorage.getItem(VERSION_SEEN_KEY);
  if (seen === APP_VERSION) return;
  localStorage.setItem(VERSION_SEEN_KEY, APP_VERSION);
  // Instalação nova não tem o que avisar; quem já usava (tem backup) vê o aviso.
  if (seen || localStorage.getItem('lastSyncAt')) setTimeout(() => showToast(`Atualizado para a versão ${APP_VERSION}`, 'O app já está com as novidades.'), 800);
}

// Espaço do app no navegador esgotado (~5 MB): a gravação falha e a série não
// aparecia, sem explicação. Agora avisa.
function bindStorageFullWarning() {
  const isQuotaError = e => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);
  const warn = () => showToast('Não deu para salvar', 'O espaço do app neste celular acabou. Salve um backup em arquivo nas Configurações.');
  window.addEventListener('error', (e) => { if (isQuotaError(e.error)) warn(); });
  window.addEventListener('unhandledrejection', (e) => { if (isQuotaError(e.reason)) warn(); });
}

// Pede ao navegador para não apagar os dados do app quando o celular estiver
// com pouco espaço (sem isso, o armazenamento é "temporário" para ele).
function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return;
  navigator.storage.persisted()
    .then(already => (already ? true : navigator.storage.persist()))
    .catch(() => {});
}

window.toggleAccordion = function (id, day) {
  expandedExerciseId = expandedExerciseId === id ? null : id;
  exerciseListContainer.querySelectorAll('.exercise-card').forEach(c => {
    const isOpen = c.dataset.cardId === expandedExerciseId;
    c.classList.toggle('expanded', isOpen);
    const header = c.querySelector('.exercise-header');
    if (header) header.setAttribute('aria-expanded', String(isOpen));
  });
  const opened = expandedExerciseId && exerciseListContainer.querySelector(`[data-card-id="${expandedExerciseId}"]`);
  if (opened) revealCard(opened);
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
  // Só repetições/tempo: a carga é um campo escondido com 0, não conta.
  const weightChanged = exerciseType(exercise) === 'load' && w !== '' && w !== savedW;
  return weightChanged || (r !== '' && r !== savedR);
}

function renderDaySelectors() {
  daySelectorsContainer.innerHTML = '';
  // Fileira rolável: com muitos treinos os botões não espremem.
  daySelectorsContainer.classList.add('scroll');
  const completedDays = getCompletedDays().map(c => c.day);
  activeDays().forEach(day => {
    const btn = document.createElement('button');
    const isCompleted = completedDays.includes(day);
    btn.type = 'button';
    btn.className = `tab-btn ${day === currentDay && gymView === 'lift' ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
    btn.style.setProperty('--tab-color', getDayColor(day));
    btn.innerHTML = `<span class="tab-dot" style="background:${getDayColor(day)}"></span>`;
    btn.append(dayLabel(day));
    btn.onclick = async () => {
      if (day === currentDay && gymView === 'lift') return;
      if (gymView === 'lift' && hasUnsavedInput() && !(await confirmDialog({
        title: `Trocar para ${dayLabel(day)}?`,
        text: 'A carga/reps que você digitou ainda não foi registrada e vai se perder.',
        confirmLabel: 'Trocar mesmo assim'
      }))) {
        return;
      }
      selectDay(day);
      setGymView('lift');
      renderExercises(currentDay);
      updateSessionBar(currentDay);
      updateFinishButtonState();
      updateLiveTimer();
    };
    daySelectorsContainer.appendChild(btn);
  });
  // Corrida (módulo opcional): verde quando teve corrida nesta semana.
  if (moduleOn('run')) {
    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = `tab-btn ${gymView === 'run' ? 'active' : ''} ${runWeekTotals(todayString()).count > 0 ? 'completed' : ''}`;
    runBtn.style.setProperty('--tab-color', RUN_COLOR);
    runBtn.innerHTML = `<span class="tab-dot" style="background:${RUN_COLOR}"></span>`;
    runBtn.append('Corrida');
    runBtn.onclick = async () => {
      if (gymView === 'run') return;
      if (hasUnsavedInput() && !(await confirmDialog({
        title: 'Trocar para Corrida?',
        text: 'A carga/reps que você digitou ainda não foi registrada e vai se perder.',
        confirmLabel: 'Trocar mesmo assim'
      }))) return;
      expandedExerciseId = null;
      setGymView('run');
    };
    daySelectorsContainer.appendChild(runBtn);
  }
  if (activeDays().length > 0) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tab-btn tab-add';
    addBtn.setAttribute('aria-label', 'Criar treino');
    addBtn.textContent = '+';
    addBtn.onclick = newWorkoutFlow;
    daySelectorsContainer.appendChild(addBtn);
  }
  revealActiveTab(daySelectorsContainer);
  updateFinishButtonState();
}

// Troca entre os exercícios e a Corrida.
function setGymView(view) {
  if (gymView === 'run' && view !== 'run') leaveRun();
  gymView = view;
  localStorage.setItem(GYM_VIEW_KEY, view);
  applyGymView();
  window.scrollTo(0, 0);
}

// Exercícios do treino escolhido, Corrida, ou a tela de boas-vindas quando
// ainda não há treino nenhum.
function applyGymView() {
  if (gymView === 'run' && !moduleOn('run')) gymView = 'lift';
  const run = gymView === 'run';
  const empty = !run && !currentDay;
  document.getElementById('sessionBar').hidden = run || empty;
  document.getElementById('exerciseList').hidden = run || empty;
  document.getElementById('gymFinishWrap').hidden = run || empty;
  document.getElementById('runRoot').hidden = !run;
  document.getElementById('gymWelcome').hidden = !empty;
  document.getElementById('menuBtn').setAttribute('aria-label', run ? 'Progresso da corrida' : 'Menu e Estatísticas');
  if (run) renderRun();
  if (empty) renderWelcome();
  updateHeaderTitle();
  renderDaySelectors();
}

// Instalação nova: escolher um modelo pronto ou criar do zero, e ligar os
// módulos opcionais.
function renderWelcome() {
  document.getElementById('gymWelcome').innerHTML = `
    <section class="welcome">
      <h2>Monte seu treino</h2>
      <p>Comece com um modelo pronto ou crie do zero. Depois dá para mudar tudo: nome, cor, exercícios e séries.</p>
      ${templatesHtml()}
      <button type="button" class="save-btn welcome-new" data-welcome-new>Criar treino do zero</button>
      <div class="welcome-modules">
        <span class="welcome-modules-title">Também quer usar?</span>
        ${MODULES.map(m => `<button type="button" class="module-chip ${moduleOn(m.id) ? 'on' : ''}" data-module-toggle="${m.id}" aria-pressed="${moduleOn(m.id)}">${m.name}</button>`).join('')}
      </div>
    </section>`;
}

function bindWelcome() {
  document.getElementById('gymWelcome').addEventListener('click', e => {
    const template = e.target.closest('[data-template]');
    if (template) {
      const first = applyTemplate(template.dataset.template);
      if (!first) return;
      selectDay(first);
      refreshGymScreen();
      return;
    }
    if (e.target.closest('[data-welcome-new]')) { newWorkoutFlow(); return; }
    const mod = e.target.closest('[data-module-toggle]');
    if (mod) setModule(mod.dataset.moduleToggle, !moduleOn(mod.dataset.moduleToggle));
  });
  // Módulo ligado/desligado (aqui ou em Configurações): redesenha o que depende dele.
  document.addEventListener('treino:modules', () => {
    applyGymView();
    renderModuleSettings();
  });
}

// Corrida registrada, corrigida ou apagada.
function onRunsChanged() {
  updateHeaderTitle();
  renderDaySelectors();
  if (calendarModal.classList.contains('visible')) renderCalendarModal();
}

function bindFinishDay() {
  document.getElementById('finishDayBtn').addEventListener('click', async () => {
    if (isWorkoutFinished(currentDay, sessionDateFor(currentDay))) return;
    const { done, total } = sessionProgress(currentDay);
    if (done === 0) return;
    // Toque sem querer no fim da lista: confirma quando ainda faltam séries.
    if (done < total && !(await confirmDialog({
      title: 'Finalizar treino?',
      text: `Ainda ${total - done === 1 ? 'falta 1 série' : `faltam ${total - done} séries`} de ${dayLabel(currentDay)}.`,
      confirmLabel: 'Finalizar mesmo assim'
    }))) return;

    // Congela o cronômetro. Se a última série foi há muito tempo (esqueceu de
    // finalizar), a duração termina nela, não agora.
    const lastActivity = lastActivityAt(currentDay);
    const endAt = lastActivity && Date.now() - lastActivity > TIMER_IDLE_MS ? lastActivity : Date.now();
    localStorage.setItem(sessionEndKey(currentDay), String(endAt));
    
    try {
        saveCompletedDay(currentDay);
        renderDaySelectors();
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

// Séries de hoje registradas no histórico, por índice (para mostrar "45×10"
// dentro da bolinha e abrir o editor com os valores certos).
function todaySetEntries(day, exercise) {
  const date = sessionDateFor(day);
  const map = new Map();
  loadHistory(exercise).forEach(h => { if (h.date === date && entryInDay(h, day)) map.set(h.setIndex, h); });
  return map;
}

// Com muitas séries a bolinha fica estreita demais para "45×10": mostra só o ✓.
const DOT_VALUES_MAX_SETS = 5;

function setDotContent(entry, totalSets, type = 'load') {
  if (!entry || totalSets > DOT_VALUES_MAX_SETS) return '✓';
  if (type === 'time') return `<span class="set-dot-value">${entry.reps}s</span>`;
  if (type === 'reps') return `<span class="set-dot-value">${entry.reps}</span>`;
  const load = entry.unit === 'placas' ? `${entry.weight}pl` : `${entry.weight}`;
  // Fonte menor com 4 ou 5 bolinhas, para "42.5×10" caber numa linha só.
  return `<span class="set-dot-value ${totalSets > 3 ? 'small' : ''}">${load}×${entry.reps}</span>`;
}

// "Pular hoje": exercício fica fora da conta de séries do dia (máquina ocupada,
// dor, falta de tempo). Vale só para a data da sessão atual.
function skippedKey(day) { return `pulados:${safeId(day)}:${sessionDateFor(day)}`; }
function getSkipped(day) { return readJSON(skippedKey(day), []); }
function isSkipped(day, exercise) { return getSkipped(day).includes(exercise); }

function setSkipped(day, exercise, skipped) {
  const list = getSkipped(day).filter(ex => ex !== exercise);
  if (skipped) list.push(exercise);
  if (list.length) localStorage.setItem(skippedKey(day), JSON.stringify(list));
  else localStorage.removeItem(skippedKey(day));
  trySync();
  updateExerciseCard(day, exercise);
  updateSessionBar(day);
}

const REGISTER_DEBOUNCE_MS = 700;
const lastRegisterAt = new Map();

function buildExerciseCardHTML(day, exercise) {
  // load: carga × reps; reps: só repetições; time: segundos (com contagem).
  const type = exerciseType(exercise);
  const savedData = loadProgress(day, exercise);
  const currentUnit = savedData.unit || getLastUsedUnit(exercise);
  const setsCompleted = getSetsCompleted(day, exercise);
  const totalSets = setsFor(day, exercise);
  const doneCount = setsCompleted.filter(i => i < totalSets).length;
  const isDone = doneCount >= totalSets;
  const skipped = !isDone && isSkipped(day, exercise);
  const id = safeId(exercise) + safeId(day);
  const exArg = exercise.replace(/'/g, "\\'");
  const pr = getPersonalRecord(exercise, currentUnit);
  const entries = todaySetEntries(day, exercise);
  let dotsHtml = '';
  // Séries extras (feitas depois das previstas) aparecem como bolinhas a mais.
  const dotCount = Math.max(totalSets, ...setsCompleted.map(i => i + 1));
  for (let i = 0; i < dotCount; i++) {
    const filled = setsCompleted.includes(i);
    dotsHtml += filled
      ? `<button type="button" class="set-dot filled" data-set-index="${i}" aria-label="Editar série ${i + 1}">${setDotContent(entries.get(i), dotCount, type)}</button>`
      : `<button type="button" class="set-dot" data-set-index="${i}" aria-label="Registrar série ${i + 1}">${i + 1}</button>`;
  }
  // Previstas feitas: o botão vira "Série extra" (antes travava em "Séries concluídas").
  const canRegister = nextFreeSetIndex(day, exercise) >= 0;
  const notesDisplay = savedData.notes ? 'none' : 'flex';
  const notesVisibleClass = savedData.notes ? 'visible' : '';
  const notesValue = String(savedData.notes || '').replace(/"/g, '&quot;');
  const isExpanded = expandedExerciseId === id;
  const prText = type === 'load' ? `${formatLoad(pr ? pr.weight : 0, pr ? pr.unit || 'kg' : 'kg')}×${pr ? pr.reps : 0}` : pr ? setText(exercise, pr) : '';
  const prBadgeHtml = pr ? `<span class="pr-badge" role="button" tabindex="0" onclick="event.stopPropagation(); openEvolutionFor('${exArg}')">PR: ${prText}</span>` : '';
  // Gráfico de evolução do exercício (só aparece depois do primeiro registro).
  const evoBtnHtml = loadHistory(exercise).length ? `<button type="button" class="info-icon evo-icon" aria-label="Evolução de ${exercise}" onclick="event.stopPropagation(); openEvolutionFor('${exArg}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg></button>` : '';
  const progText = skipped ? 'Pulado hoje' : `${doneCount}/${totalSets} séries concluídas`;
  const unitToggleHtml = `
            <div class="unit-toggle" id="unitToggle-${id}" role="group" aria-label="Unidade de carga">
              <button type="button" class="unit-toggle-btn ${currentUnit === 'kg' ? 'active' : ''}" data-unit="kg">Kg</button>
              <button type="button" class="unit-toggle-btn ${currentUnit === 'placas' ? 'active' : ''}" data-unit="placas">Placas</button>
            </div>`;

  const bodyHtml = skipped
    ? `<button type="button" class="save-btn secondary-btn" id="unskip-${id}">Voltar para o treino</button>`
    : `
            <div class="set-tracker" id="tracker-${id}">${dotsHtml}</div>
            ${type === 'load' ? unitToggleHtml : ''}
            <div class="input-row">
              ${type === 'load'
                ? `<div class="input-group"><label id="weightLabel-${id}">Carga (${unitLabel(currentUnit)})</label><input type="number" inputmode="decimal" enterkeyhint="next" id="weight-${id}" value="${savedData.weight}" placeholder="40"></div>`
                : `<input type="hidden" id="weight-${id}" value="0">`}
              <div class="input-group"><label id="repsLabel-${id}">${REPS_LABEL[type]}</label><input type="number" inputmode="numeric" enterkeyhint="done" id="reps-${id}" value="${savedData.reps}" placeholder="${type === 'time' ? '30' : '10'}"></div>
            </div>
            <div class="card-actions">
              <button class="save-btn ${isDone ? 'extra-set-btn' : ''}" id="save-${id}" ${canRegister ? '' : 'disabled'}>${!isDone ? 'Registrar série' : canRegister ? 'Série extra' : 'Séries concluídas'}</button>
              ${type === 'time' ? `<button type="button" class="rest-btn-trigger count-btn" id="count-${id}" aria-label="Contar o tempo e registrar">${COUNT_ICON.play}</button>` : ''}
              <button class="rest-btn-trigger" id="rest-${id}" aria-label="Iniciar descanso"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></button>
            </div>
            <div class="card-links">
              <button class="add-notes-btn" style="display: ${notesDisplay};" id="toggle-notes-${id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>
                ${type === 'load' ? 'Ajustes de máquina' : 'Anotação'}
              </button>
              ${isDone ? '' : `<button type="button" class="skip-btn" id="skip-${id}">Pular hoje</button>`}
            </div>
            <div class="notes-row ${notesVisibleClass}" id="notes-container-${id}">
              <input type="text" id="notes-${id}" class="notes-input" placeholder="Ex: banco 4, presilha 2..." value="${notesValue}">
            </div>`;

  return `
    <div class="exercise-card ${isDone ? 'done' : ''} ${skipped ? 'skipped' : ''} ${isExpanded ? 'expanded' : ''}" data-card-id="${id}" data-day="${day}" data-exercise="${exercise}">
      <div class="exercise-header" role="button" tabindex="0" aria-expanded="${isExpanded}" onclick="toggleAccordion('${id}', '${day}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAccordion('${id}', '${day}');}">
        ${thumbHtml(db[exercise], exercise, 'data-ex-guide')}
        <div class="exercise-info">
          <span class="exercise-title">${exercise}</span>
          <span class="exercise-prog"><span>${progText}</span>${skipped ? `<button type="button" class="unskip-chip" id="unskipChip-${id}">Voltar para o treino</button>` : prBadgeHtml}</span>
        </div>
        ${evoBtnHtml}
        <svg class="exercise-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="exercise-wrapper">
        <div class="exercise-body">
          <div class="exercise-inner">${bodyHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

const REPS_LABEL = { load: 'Reps', reps: 'Repetições', time: 'Tempo (segundos)' };
const COUNT_ICON = {
  play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  stop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
};

// Exercício de tempo (prancha, alongamento): ▶ dá 5 s para se posicionar, conta
// o tempo do campo e registra a série sozinho no fim, com bipe e vibração.
const GYM_COUNT_PREP_MS = 5000;
const gymCountdown = { id: null, handle: null };

function stopGymCountdown() {
  if (gymCountdown.handle) clearInterval(gymCountdown.handle);
  const { id } = gymCountdown;
  gymCountdown.id = null;
  gymCountdown.handle = null;
  setAwake('gym-count', false);
  if (!id) return;
  const label = document.getElementById(`repsLabel-${id}`);
  const btn = document.getElementById(`count-${id}`);
  if (label) label.textContent = REPS_LABEL.time;
  if (btn) { btn.innerHTML = COUNT_ICON.play; btn.setAttribute('aria-label', 'Contar o tempo e registrar'); }
  const card = btn && btn.closest('.exercise-card');
  if (card) delete card.dataset.counting;
}

function startGymCountdown(id) {
  stopGymCountdown();
  const input = document.getElementById(`reps-${id}`);
  const target = Math.round(parseNum(input.value)) || Math.round(parseNum(input.placeholder));
  if (!(target > 0)) return;
  input.value = String(target);
  primeAlert();
  setAwake('gym-count', true);
  const prepEnd = Date.now() + GYM_COUNT_PREP_MS;
  const end = prepEnd + target * 1000;
  gymCountdown.id = id;
  const btn = document.getElementById(`count-${id}`);
  btn.innerHTML = COUNT_ICON.stop;
  btn.setAttribute('aria-label', 'Parar a contagem');
  btn.closest('.exercise-card').dataset.counting = '1';
  const tick = () => {
    const label = document.getElementById(`repsLabel-${id}`);
    if (!label) { stopGymCountdown(); return; }
    const now = Date.now();
    if (now < prepEnd) { label.textContent = `Prepare-se · ${Math.ceil((prepEnd - now) / 1000)}`; return; }
    const left = Math.ceil((end - now) / 1000);
    if (left > 0) { label.textContent = `Segure · ${left}s`; return; }
    stopGymCountdown();
    alertTimerEnd();
    document.getElementById(`reps-${id}`).value = String(target);
    document.getElementById(`save-${id}`).click();
  };
  gymCountdown.handle = setInterval(tick, 200);
  tick();
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

// Corrige carga/reps de uma série já feita hoje. Se for a última série
// registrada, os campos do card também passam a mostrar o valor corrigido.
function updateLoggedSet(day, exercise, setIndex, weight, reps, unit) {
  const date = sessionDateFor(day);
  const history = loadHistory(exercise);
  const idx = history.findIndex(h => h.date === date && h.setIndex === setIndex && entryInDay(h, day));
  if (idx >= 0) history[idx] = { ...history[idx], weight, reps };
  else history.push({ date, day, weight, reps, setIndex, notes: '', unit });
  saveHistory(exercise, history);
  const lastIndex = Math.max(...getSetsCompleted(day, exercise));
  if (setIndex === lastIndex) {
    const saved = loadProgress(day, exercise);
    localStorage.setItem(storageKey(day, exercise), JSON.stringify({ ...saved, weight: String(weight), reps: String(reps) }));
  }
  trySync();
  updateExerciseCard(day, exercise);
}

function openLoggedSetEditor(day, exercise, setIndex) {
  const entry = todaySetEntries(day, exercise).get(setIndex);
  const unit = entry ? entry.unit || 'kg' : getLastUsedUnit(exercise);
  const type = exerciseType(exercise);
  const repsField = { key: 'reps', label: REPS_LABEL[type], value: entry ? entry.reps : '', inputmode: 'numeric' };
  openSetEditor({
    title: `Série ${setIndex + 1}`,
    subtitle: exercise,
    fields: type === 'load'
      ? [{ key: 'weight', label: `Carga (${unitLabel(unit)})`, value: entry ? entry.weight : '', inputmode: 'decimal' }, repsField]
      : [repsField],
    onSave: ({ weight = '0', reps }) => {
      const w = parseNum(weight);
      const r = Math.round(parseNum(reps));
      // Carga 0 vale (peso do corpo), igual ao registrar — antes a série com
      // 0 kg não podia ser corrigida.
      if (String(weight).trim() === '' || w < 0) return 'weight';
      if (!(r > 0)) return 'reps';
      updateLoggedSet(day, exercise, setIndex, w, r, unit);
    },
    onDelete: () => toggleSet(day, exercise, setIndex)
  });
}

function bindExerciseCardEvents(day, exercise) {
  const id = safeId(exercise) + safeId(day);
  const card = exerciseListContainer.querySelector(`[data-card-id="${id}"]`);
  if (!card) return;
  const thumb = card.querySelector('[data-ex-guide]');
  if (thumb) {
    thumb.addEventListener('click', e => { e.stopPropagation(); showExerciseGuide(exercise); });
    thumb.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      showExerciseGuide(exercise);
    });
  }
  const unskip = () => setSkipped(day, exercise, false);
  const unskipChip = card.querySelector(`#unskipChip-${id}`);
  if (unskipChip) unskipChip.addEventListener('click', (e) => { e.stopPropagation(); unskip(); });
  const unskipBtn = card.querySelector(`#unskip-${id}`);
  if (unskipBtn) {
    unskipBtn.addEventListener('click', unskip);
    return;
  }
  // Teclado do celular: "próximo" na carga vai para reps; "ok" em reps registra.
  // Tocar num campo seleciona o valor, para digitar por cima sem apagar antes.
  const weightInput = card.querySelector(`#weight-${id}`);
  const repsInput = card.querySelector(`#reps-${id}`);
  [weightInput, repsInput].forEach(input => {
    input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
    input.addEventListener('input', () => input.classList.remove('input-missing'));
  });
  weightInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); repsInput.focus(); } });
  repsInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    repsInput.blur();
    document.getElementById(`save-${id}`).click();
  });
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
      card.querySelector(`#notes-${id}`).focus();
    });
  }
  // Ajuste de máquina fica salvo ao sair do campo (antes só era gravado junto
  // com uma série; digitar e fechar o card perdia a anotação).
  const notesInput = card.querySelector(`#notes-${id}`);
  if (notesInput) {
    notesInput.addEventListener('change', () => {
      const saved = loadProgress(day, exercise);
      const notes = notesInput.value.trim();
      if (notes === (saved.notes || '')) return;
      localStorage.setItem(storageKey(day, exercise), JSON.stringify({ ...saved, notes }));
      trySync();
    });
  }
  const skipBtn = card.querySelector(`#skip-${id}`);
  if (skipBtn) {
    skipBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Pular hoje?',
        text: `${exercise} sai da conta de séries de hoje.\nSe mudar de ideia, toque em "Voltar para o treino" no card.`,
        confirmLabel: 'Pular exercício'
      });
      if (!ok) return;
      expandedExerciseId = null;
      setSkipped(day, exercise, true);
    });
  }
  card.querySelectorAll('.set-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = Number(dot.dataset.setIndex);
      if (getSetsCompleted(day, exercise).includes(idx)) {
        // Série já feita: abre para corrigir ou apagar (antes apagava com um toque).
        openLoggedSetEditor(day, exercise, idx);
      } else {
        document.getElementById(`save-${id}`).click();
      }
    });
  });
  document.getElementById(`save-${id}`).addEventListener('click', () => {
    const w = document.getElementById(`weight-${id}`).value;
    const r = document.getElementById(`reps-${id}`).value;
    // Campo vazio: antes o toque não fazia nada. Agora mostra qual falta.
    const weightOk = String(w).trim() !== '' && parseNum(w) >= 0;
    if (!weightOk || !(parseNum(r) > 0)) {
      const missing = !weightOk ? weightInput : repsInput;
      missing.classList.remove('input-missing');
      void missing.offsetWidth;
      missing.classList.add('input-missing');
      missing.focus();
      showToast('Falta preencher', missing === weightInput ? 'Digite a carga da série.' : exerciseType(exercise) === 'time' ? 'Digite o tempo em segundos.' : 'Digite quantas repetições fez.');
      return;
    }
    if (gymCountdown.id === id) stopGymCountdown();
    // Toque duplo sem querer registrava duas séries de uma vez.
    if (Date.now() - (lastRegisterAt.get(exercise) || 0) < REGISTER_DEBOUNCE_MS) return;
    lastRegisterAt.set(exercise, Date.now());
    const activeUnitBtn = card.querySelector(`#unitToggle-${id} .unit-toggle-btn.active`);
    const unit = activeUnitBtn ? activeUnitBtn.dataset.unit : 'kg';
    // Com todas as séries feitas não há o que registrar (antes isso gravava uma
    // série "fantasma" no histórico, sem bolinha na tela).
    const thisSetIndex = nextFreeSetIndex(day, exercise);
    if (thisSetIndex < 0) return;
    markSessionStarted(day);
    const notesVal = document.getElementById(`notes-${id}`).value;
    const sessionDate = sessionDateFor(day);
    const historyBefore = loadHistory(exercise).filter(h => !(h.date === sessionDate && h.setIndex === thisSetIndex && entryInDay(h, day)));
    saveProgressData(day, exercise, w, r, notesVal, thisSetIndex, unit);
    maybeShowSetFeedback(exercise, historyBefore, parseNum(w), parseNum(r), unit, sessionDate);
    expandedExerciseId = id;
    toggleSet(day, exercise, thisSetIndex);
    // Resposta ao registrar: a bolinha "enche" e o celular vibra de leve.
    const newDot = exerciseListContainer.querySelector(`[data-card-id="${id}"] .set-dot[data-set-index="${thisSetIndex}"]`);
    if (newDot) newDot.classList.add('pop');
    if (navigator.vibrate) navigator.vibrate(40);
    startRestFor(exercise);
  });
  document.getElementById(`rest-${id}`).addEventListener('click', () => { startRestFor(exercise); });
  const countBtn = card.querySelector(`#count-${id}`);
  if (countBtn) countBtn.addEventListener('click', () => (gymCountdown.id === id ? stopGymCountdown() : startGymCountdown(id)));
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

// Data em que a lista foi desenhada. App que ficou em segundo plano de um dia
// para o outro voltava mostrando as séries, o cronômetro e a contagem da véspera.
let renderedDate = todayString();

function refreshIfNewDay() {
  if (todayString() === renderedDate) return;
  if (gymView === 'run') renderRun();
  expandedExerciseId = null;
  updateHeaderTitle();
  renderDaySelectors();
  renderExercises(currentDay);
  updateSessionBar(currentDay);
  updateLiveTimer();
}

function renderExercises(day) {
  renderedDate = todayString();
  exerciseListContainer.innerHTML = '';
  if (!day || !workoutData[day]) return;
  ensureFreshSessionAnchor(day);
  const exercises = workoutData[day].exercises;
  if (exercises.length === 0) {
    exerciseListContainer.innerHTML = `<div class="workout-empty">
      <p>Esse treino ainda não tem exercícios.</p>
      <button type="button" class="save-btn" data-edit-workout>Escolher exercícios</button>
    </div>`;
    exerciseListContainer.querySelector('[data-edit-workout]').addEventListener('click', () => openPlanEditor(day));
    return;
  }
  exerciseListContainer.innerHTML = exercises.map(ex => buildExerciseCardHTML(day, ex)).join('');
  exercises.forEach(ex => bindExerciseCardEvents(day, ex));
}

function bindStatsSheet() {
  document.getElementById('menuBtn').addEventListener('click', () => {
    if (gymView === 'run') { openRunProgress(); return; }
    renderCategorizedStats();
    renderEvolutionTab();
    volumeWeekOffset = 0;
    calculateWeeklyVolume();
    statsSheet.classList.add('visible');
    sheetBackdrop.classList.add('visible');
  });
  document.getElementById('closeStats').addEventListener('click', () => { statsSheet.classList.remove('visible'); sheetBackdrop.classList.remove('visible'); });
  // Fecha o seletor de exercício da Evolução ao tocar fora dele. Registrado uma
  // vez só (antes cada troca de exercício acumulava mais um listener).
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('evoSelectWrap');
    if (!wrap || wrap.contains(e.target)) return;
    wrap.querySelectorAll('.open').forEach(el => el.classList.remove('open'));
  });
  sheetBackdrop.addEventListener('click', () => { statsSheet.classList.remove('visible'); sheetBackdrop.classList.remove('visible'); });
  enableSheetDrag(statsSheet, () => { statsSheet.classList.remove('visible'); sheetBackdrop.classList.remove('visible'); });
  // Só as abas das Estatísticas (as abas de Medidas usam a mesma classe).
  statsSheet.querySelectorAll('.sheet-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      statsSheet.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
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
  statsSheet.querySelectorAll('.sheet-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'evolucao'));
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

const buildCompletedDays = list => list.filter(c => c && typeof c.date === 'string' && typeof c.day === 'string');
// Lido a cada segundo pelo cronômetro: com cache.
function getAllTimeCompletedDays() { return readListCached('completedDaysAllTime', buildCompletedDays); }

// Data -> treinos daquele dia. Inclui dias finalizados e também dias em que
// só houve séries registradas (sem apertar "Finalizar"), pra nada sumir do calendário.
function getLoggedWorkoutsByDate() {
  const map = new Map();
  const add = (date, day) => {
    if (!map.has(date)) map.set(date, new Set());
    map.get(date).add(day);
  };
  getAllTimeCompletedDays().forEach(c => { if (c && c.date && c.day) add(c.date, c.day); });
  runsByDate().forEach((_, date) => add(date, RUN_DAY));
  days.forEach(day => exercisesEverIn(day).forEach(ex => loadHistory(ex).forEach(h => { if (entryInDay(h, day)) add(h.date, day); })));
  return map;
}

// Ordem no calendário e no detalhe do dia: Superior, Inferior, Corrida.
function dayOrder(day) { return day === RUN_DAY ? days.length : days.indexOf(day); }

function getWorkoutsForDate(dateStr) {
  const set = getLoggedWorkoutsByDate().get(dateStr);
  if (!set) return [];
  return [...set]
    .sort((a, b) => dayOrder(a) - dayOrder(b))
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
  const list = workoutData[day] ? exercisesEverIn(day) : Object.keys(db);
  const result = [];
  list.forEach(ex => {
    const history = loadHistory(ex);
    const sets = history.filter(h => h.date === dateStr && entryInDay(h, day)).sort((a, b) => a.setIndex - b.setIndex);
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
  dayDetailTitle.innerText = longDateLabel(dateStr);
  let html = '';
  const dayPRs = [];
  const trained = [];
  workouts.forEach(w => {
    if (w.day === RUN_DAY) {
      const day = runTotals(loadRuns(), r => r.d === dateStr);
      html += `<div class="day-detail-meta">
        <span class="day-detail-chip workout-tag" style="--day-color: ${RUN_COLOR}">Corrida</span>
        <span class="day-detail-chip">${fmtKm(day.km)} km</span>
        <span class="day-detail-chip">${fmtDuration(day.run + day.walk)}</span>
      </div>${dayRunsHtml(dateStr)}`;
      return;
    }
    const timeLabel = getSessionTimeLabel(w.day, dateStr);
    const exercises = getExercisesLoggedForDay(w.day, dateStr);
    trained.push(...exercises.map(item => item.exercise));
    const volumeKg = getDayVolumeKg(exercises);
    const setCount = exercises.reduce((sum, item) => sum + item.sets.length, 0);
    html += `<div class="day-detail-meta">
      <span class="day-detail-chip workout-tag" style="--day-color: ${getDayColor(w.day)}">${dayLabel(w.day)}</span>
      <span class="day-detail-chip">${setCount} ${setCount === 1 ? 'série' : 'séries'}</span>
      ${volumeKg > 0 ? `<span class="day-detail-chip">${Math.round(volumeKg).toLocaleString('pt-BR')} kg</span>` : ''}
      ${timeLabel ? `<span class="day-detail-chip">${timeLabel}</span>` : ''}
    </div>`;
    exercises.forEach(item => {
      let setsHtml = '';
      let bestIdx = 0;
      item.sets.forEach((s, i) => {
        if (isBetterSet(s, item.sets[bestIdx])) bestIdx = i;
      });
      const progress = getDayProgress(item.exercise, dateStr);
      if (progress && progress.isPR) dayPRs.push({ exercise: item.exercise, ...progress });
      item.sets.forEach((s, i) => { setsHtml += `<span class="evo-set-chip ${i === bestIdx ? 'best' : ''}">${setChipHtml(item.exercise, s)}</span>`; });
      html += `<div class="day-detail-ex" style="--day-color: ${getDayColor(w.day)}">
        <div class="day-detail-ex-head">
          <div class="day-detail-ex-name">${item.exercise}</div>
          ${dayTrendHtml(progress)}
        </div>
        <div class="day-detail-sets-row">${setsHtml}</div>
      </div>`;
    });
    html += `<button type="button" class="day-delete-btn" data-delete-day="${w.day}">Apagar treino de ${dayLabel(w.day)} deste dia</button>`;
  });
  let prsHtml = '';
  if (dayPRs.length > 0) {
    prsHtml = `
      <div class="summary-prs">
        <div class="summary-prs-label">🏆 Recordes desse dia</div>
        ${dayPRs.map(pr => `<div class="summary-pr-row"><span>${pr.exercise}</span><span class="summary-pr-value">${setText(pr.exercise, pr.best, pr.unit)}<span class="summary-pr-prev">antes ${setText(pr.exercise, pr.prevRecord, pr.unit)}</span></span></div>`).join('')}
      </div>`;
  }
  dayDetailBody.innerHTML = prsHtml + dayMusclesHtml(trained) + html;
  dayDetailBody.querySelectorAll('[data-delete-day]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const day = btn.dataset.deleteDay;
      const ok = await confirmDialog({
        title: 'Apagar este treino?',
        text: `Todas as séries de ${dayLabel(day)} do dia ${formatDateBR(dateStr)} serão apagadas e o dia sai do calendário. Não dá para desfazer.`,
        confirmLabel: 'Apagar treino',
        danger: true
      });
      if (!ok) return;
      deleteWorkoutDay(day, dateStr);
      dayDetailModal.classList.remove('visible');
      if (calendarModal.classList.contains('visible')) renderCalendarModal();
      showToast('Treino apagado', `${dayLabel(day)} de ${formatDateBR(dateStr)} saiu do calendário.`);
    });
  });
  dayDetailModal.classList.add('visible');
}

// Apaga tudo de um treino numa data (série marcada sem querer, treino
// finalizado por engano): histórico, séries, horários, "finalizado" e pulados.
function deleteWorkoutDay(day, date) {
  exercisesEverIn(day).forEach(ex => {
    const history = readJSON(historyKey(ex), []);
    const kept = history.filter(h => !(h && h.date === date && entryInDay(h, day)));
    if (kept.length !== history.length) saveHistory(ex, kept);
    localStorage.removeItem(`series:${safeId(day)}:${safeId(ex)}:${date}`);
  });
  localStorage.removeItem(`sessaoInicio:${safeId(day)}:${date}`);
  localStorage.removeItem(`sessaoFim:${safeId(day)}:${date}`);
  localStorage.removeItem(`pulados:${safeId(day)}:${date}`);
  const allTime = getAllTimeCompletedDays().filter(c => !(c && c.day === day && c.date === date));
  localStorage.setItem('completedDaysAllTime', JSON.stringify(allTime));
  const activeKey = `sessaoAtivaData:${safeId(day)}`;
  if (localStorage.getItem(activeKey) === date) {
    localStorage.removeItem(activeKey);
    localStorage.removeItem(activityKey(day));
  }
  trySync();
  if (day === currentDay) {
    renderExercises(currentDay);
    updateSessionBar(currentDay);
    updateLiveTimer();
  }
  renderDaySelectors();
  updateHeaderTitle();
}

function bindDayDetailModal() {
  document.getElementById('closeDayDetail').addEventListener('click', () => { dayDetailModal.classList.remove('visible'); });
  enableSheetDrag(dayDetailModal.querySelector('.day-detail-content'), () => dayDetailModal.classList.remove('visible'));
  dayDetailModal.addEventListener('click', (e) => { if (e.target.id === 'dayDetailModal') dayDetailModal.classList.remove('visible'); });
}

// Cor de cada treino no calendário, no detalhe do dia e na legenda.
function getDayColor(dayName) {
  if (dayName === RUN_DAY) return RUN_COLOR;
  return (workoutData[dayName] && workoutData[dayName].color) || WORKOUT_COLORS[0];
}
let calMonthOffset = 0;

function calendarBaseMonth() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + calMonthOffset);
  return { year: base.getFullYear(), month: base.getMonth() };
}

// Séries e volume (kg) registrados nas datas que começam com o prefixo (mês).
function monthTotals(prefix) {
  let sets = 0;
  let volume = 0;
  allKnownExercises().forEach(ex => loadHistory(ex).forEach(h => {
    if (!h.date.startsWith(prefix)) return;
    sets += 1;
    if ((h.unit || 'kg') === 'kg') volume += h.weight * h.reps;
  }));
  return { sets, volume };
}

function renderCalendarModal() {
  const { year, month } = calendarBaseMonth();
  const byDate = getLoggedWorkoutsByDate();
  const prefix = `${year}-${pad2(month + 1)}-`;
  let monthDays = 0;
  let yearDays = 0;
  const calDays = new Map();
  byDate.forEach((set, date) => {
    if (date.startsWith(`${year}-`)) yearDays += 1;
    if (!date.startsWith(prefix)) return;
    monthDays += 1;
    const workouts = [...set].sort((a, b) => dayOrder(a) - dayOrder(b));
    calDays.set(date, { colors: workouts.map(getDayColor), label: workouts.map(dayLabel).join(' e ') });
  });
  const totals = monthTotals(prefix);

  calendarModalContent.innerHTML = `
    ${calendarStatsHtml([
      { value: monthDays, label: monthDays === 1 ? 'Dia treinado' : 'Dias treinados' },
      { value: totals.sets, label: 'Séries' },
      { value: totals.volume > 0 ? formatVolume(totals.volume) : '—', label: 'Volume' }
    ])}
    ${monthNavHtml(year, month, calMonthOffset === 0)}
    ${monthCalendarHtml(year, month, calDays)}
    ${calendarLegendHtml([...activeDays(), ...(moduleOn('run') ? [RUN_DAY] : [])].map(d => ({ color: getDayColor(d), label: dayLabel(d) })))}
    ${yearSummaryHtml(year, yearDays)}
  `;
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
  bindMonthCalendar(calendarModalContent, {
    onMonth: step => {
      if (step > 0 && calMonthOffset >= 0) return;
      calMonthOffset += step;
      renderCalendarModal();
    },
    onDay: date => openDayDetail(date)
  });
}

function buildSparklineSVG(history) {
  const W = 72, H = 28, PAD = 4;
  const recent = history.slice(-8);
  if (recent.length < 2) return '';
  const weights = recent.every(h => !h.weight) ? recent.map(h => h.reps) : recent.map(h => h.weight);
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
  // Séries na ordem em que foram feitas (S1, S2, S3), mesmo depois de corrigir ou
  // apagar e registrar de novo uma delas.
  return [...map.entries()]
    .map(([date, sets]) => ({ date, sets: sets.sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}


// Todos os exercícios que podem ter histórico: catálogo, criados por você e os
// que já saíram de algum treino.
function allKnownExercises() {
  const all = new Set(Object.keys(db));
  days.forEach(d => exercisesEverIn(d).forEach(ex => all.add(ex)));
  return all;
}

function getExercisesWithHistoryGrouped() {
  const allEx = allKnownExercises();
  const grouped = {};
  allEx.forEach(ex => {
    if (loadHistory(ex).length === 0) return;
    const catName = db[ex] ? db[ex].cat : "Outros";
    if (!grouped[catName]) grouped[catName] = [];
    grouped[catName].push(ex);
  });
  return grouped;
}

// record: melhor série de todo o histórico (mesma unidade). Só o ponto que a
// alcança ganha o destaque de recorde — antes o melhor ponto do período
// escolhido (ex.: 1M) aparecia como "Recorde pessoal" mesmo sem ser.
// metric: 'weight' (carga) ou 'reps' (exercício só com peso do corpo, carga 0 —
// a linha da carga ficava reta no zero).
function buildEvolutionChartSVG(sessions, unit, record, metric = 'weight') {
  // Desenhado no tamanho real do celular (antes 600 de largura, encolhia pela metade).
  const W = 340, H = 190, PAD_TOP = 24, PAD_BOTTOM = 26, PAD_LEFT = 32, PAD_RIGHT = 18;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const innerW = W - PAD_LEFT - PAD_RIGHT;

  const points = sessions.map((session, si) => {
    let bestIdx = 0;
    session.sets.forEach((s, i) => {
      if (isBetterSet(s, session.sets[bestIdx])) bestIdx = i;
    });
    const best = session.sets[bestIdx];
    const x = sessions.length === 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + (si / (sessions.length - 1)) * innerW;
    return { x, weight: best.weight, reps: best.reps, date: session.date, setCount: session.sets.length };
  });

  const val = p => (metric === 'reps' ? p.reps : p.weight);
  const weights = points.map(val);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) { min -= metric === 'reps' ? 2 : 5; max += metric === 'reps' ? 2 : 5; }
  const padRatio = points.length <= 3 ? 0.12 : points.length <= 6 ? 0.18 : 0.25;
  const pad = (max - min) * padRatio;
  min -= pad; max += pad;
  if (min < 0) min = 0;
  const yFor = w => PAD_TOP + innerH - ((w - min) / (max - min)) * innerH;

  let prPoint = points[0];
  points.forEach(p => { if (isBetterSet(p, prPoint)) prPoint = p; });
  if (record && isBetterSet(record, prPoint)) prPoint = null;

  let gridHtml = '';
  niceTicks(min, max, { minStep: metric === 'reps' ? 1 : 0 }).forEach(w => {
    const y = yFor(w);
    gridHtml += `<line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />`;
    gridHtml += `<text x="${(PAD_LEFT - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="var(--text-faint)">${w}</text>`;
  });

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
  const linePathStr = smoothPath(points.map(p => ({ x: p.x, y: yFor(val(p)) })));
  let areaPathStr = '';
  if (points.length > 1) {
    areaPathStr = `${linePathStr} L ${points[points.length-1].x.toFixed(1)},${H - PAD_BOTTOM + 10} L ${points[0].x.toFixed(1)},${H - PAD_BOTTOM + 10} Z`;
  }

  const labelStep = Math.max(1, Math.ceil(points.length / 5));
  let dotsHtml = '';
  let labelsHtml = '';
  points.forEach((p, idx) => {
    const y = yFor(val(p));
    const isPR = p === prPoint;
    const r = isPR ? 5.5 : 3.5;
    dotsHtml += `<g class="evo-point" data-idx="${idx}" tabindex="0" role="button" aria-label="${formatDateBR(p.date)}: ${formatLoad(p.weight, unit)} por ${p.reps} reps">
      <circle class="evo-point-halo" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="transparent" />
      <circle class="evo-point-ring" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 5}" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0" />
      <circle class="evo-point-dot" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${isPR ? 'var(--accent)' : 'var(--bg)'}" stroke="var(--accent)" stroke-width="${isPR ? 0 : 2}" />
      ${isPR ? `<text x="${p.x.toFixed(1)}" y="${(y - 11).toFixed(1)}" text-anchor="middle" font-family="var(--font-mono)" font-weight="700" font-size="11" fill="var(--accent)">${val(p)}</text>` : ''}
    </g>`;
    if (idx % labelStep === 0 || idx === points.length - 1) {
      const [, m, d] = p.date.split('-');
      labelsHtml += `<text x="${p.x.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-family="var(--font-mono)" font-weight="600" font-size="10" fill="var(--text-dim)">${d}/${m}</text>`;
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
    evolutionBody.innerHTML = emptyStateHtml('chart', 'Sem evolução ainda', 'Registre suas séries para ver sua evolução aqui.');
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
    content.innerHTML = unitSwitchHtml + `<div class="evo-chart-card">${emptyStateHtml('chart', `Nenhum registro em ${unitLabel(evoSelectedUnit)} ainda`)}</div>`;
    content.querySelectorAll('.unit-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => { evoSelectedUnit = btn.dataset.unit; renderEvolutionContent(exercise); });
    });
    return;
  }
  const pr = getPersonalRecord(exercise, evoSelectedUnit);
  // "Desde o início": recorde de hoje vs a melhor série do primeiro treino
  // (antes comparava com a 1ª série, geralmente o aquecimento).
  const firstSet = bestSetOf(sessions[0].sets);
  // Só peso do corpo (carga 0 em tudo): a evolução é em repetições.
  const bodyweight = history.every(h => !h.weight);
  const delta = bodyweight ? pr.reps - firstSet.reps : Math.round((pr.weight - firstSet.weight) * 100) / 100;
  const progressClass = sessions.length < 2 ? 'flat' : (delta > 0 ? 'pos' : (delta < 0 ? 'neg' : 'flat'));
  const isTime = exerciseType(exercise) === 'time';
  const deltaText = isTime ? fmtSeconds(Math.abs(delta)) : bodyweight ? `${Math.abs(delta)} rep${Math.abs(delta) === 1 ? '' : 's'}` : formatLoad(Math.abs(delta), evoSelectedUnit);
  const progressLabel = sessions.length < 2 ? '—' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${deltaText}`;
  const heroHtml = isTime
    ? `<div class="evo-stat-value">${fmtSeconds(pr.reps)}</div>
        <div class="evo-stat-label">PR atual</div>`
    : bodyweight
    ? `<div class="evo-stat-value">${pr.reps}<span class="evo-stat-unit">reps</span></div>
        <div class="evo-stat-label">PR atual · peso do corpo</div>`
    : `<div class="evo-stat-value">${pr.weight}<span class="evo-stat-unit">${unitLabel(evoSelectedUnit)}</span></div>
        <div class="evo-stat-label">PR atual · ${pr.reps} reps</div>`;
  const summaryHtml = `
    <div class="evo-summary">
      <div class="evo-stat">
        <div class="evo-stat-value">${sessions.length}</div>
        <div class="evo-stat-label">Sessões</div>
      </div>
      <div class="evo-stat evo-stat-hero">
        ${heroHtml}
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
      const cutoffStr = monthsAgo(todayString(), evoRangeMonths);
      sessionsInRange = sessions.filter(s => s.date >= cutoffStr);
      if (sessionsInRange.length < 2) sessionsInRange = sessions.slice(-Math.min(6, sessions.length));
    } else {
      sessionsInRange = sessions;
    }
    const built = buildEvolutionChartSVG(sessionsInRange, evoSelectedUnit, pr, bodyweight ? 'reps' : 'weight');
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
    chartHtml = `<div class="evo-chart-card">${emptyStateHtml('chart', 'Falta pouco', 'Registre mais uma série para começar a ver seu gráfico de evolução.')}</div>`;
  }
  const reversedSessions = [...sessions].reverse();
  const visibleSessions = reversedSessions.slice(0, EVO_SESSIONS_VISIBLE);
  const hiddenSessions = reversedSessions.slice(EVO_SESSIONS_VISIBLE);
  function renderSessionCard(session) {
    // Antes o treino de ontem também aparecia como "HOJE".
    const dayTag = session.date === todayString() ? 'HOJE' : session.date === yesterdayString() ? 'ONTEM' : null;
    let bestIdx = 0;
    session.sets.forEach((s, i) => {
      if (isBetterSet(s, session.sets[bestIdx])) bestIdx = i;
    });
    const sessionIdxInOrder = sessions.indexOf(session);
    const prevSession = sessionIdxInOrder > 0 ? sessions[sessionIdxInOrder - 1] : null;
    let trendHtml = '';
    if (prevSession) {
      let prevBestIdx = 0;
      prevSession.sets.forEach((s, i) => {
        if (isBetterSet(s, prevSession.sets[prevBestIdx])) prevBestIdx = i;
      });
      const curBest = session.sets[bestIdx];
      const prevBest = prevSession.sets[prevBestIdx];
      const diff = compareSets(curBest, prevBest);
      if (diff > 0) trendHtml = `<span class="evo-session-trend up">↑ melhor que o treino anterior</span>`;
      else if (diff < 0) trendHtml = `<span class="evo-session-trend down">↓ abaixo do treino anterior</span>`;
      else trendHtml = `<span class="evo-session-trend flat">= igual ao treino anterior</span>`;
    }
    let setsHtml = '';
    session.sets.forEach((s, i) => {
      setsHtml += `<span class="evo-set-chip ${i === bestIdx ? 'best' : ''}">${setChipHtml(exercise, s, evoSelectedUnit)}</span>`;
    });
    return `
      <div class="evo-session-card">
        <div class="evo-session-header-row">
          <div class="evo-session-date">${dayTag ? `<span class="evo-today-tag">${dayTag}</span>` : formatDateBR(session.date)}</div>
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
          if (isBetterSet(s, session.sets[bestIdx])) bestIdx = i;
        });
        const setsHtml = session.sets.map((s, i) => `<div class="evo-set-block ${i === bestIdx ? 'best' : ''}"><span class="evo-set-label">S${i + 1}</span><span class="evo-set-value">${setChipHtml(exercise, s, evoSelectedUnit)}</span></div>`).join('');
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

// Catálogo: navegar (tocar abre o guia) ou escolher um exercício para um
// treino (pickFor + onPick, vindo de Meus Treinos). Busca sem acento e filtro
// por grupo; cada item mostra como é registrado (carga, reps ou tempo).
// multi: tocar marca/desmarca e a barra "Adicionar N" entrega a lista em onPick
// (sem multi, o toque já escolhe). onConfigure: toque num exercício que já está no treino.
let catalogState = { pickFor: null, onPick: null, group: 'Todos', multi: false, selected: [], onConfigure: null };

function openCatalog({ pickFor = null, title = 'Catálogo', onPick = null, multi = false, onConfigure = null } = {}) {
  catalogState = { pickFor, onPick, group: 'Todos', multi, selected: [], onConfigure };
  document.getElementById('catalogTitle').textContent = title;
  renderCatalogTab();
  catalogModal.classList.add('visible');
  catalogModalContent.scrollTop = 0;
}

function catalogGroupOf(ex) { return db[ex].custom ? 'Meus' : db[ex].cat; }

function renderCatalogTab() {
  if (!catalogModalContent) return;
  const { pickFor } = catalogState;
  const inWorkout = new Set(pickFor && workoutData[pickFor] ? workoutData[pickFor].exercises : []);
  const grouped = {};
  Object.keys(db).forEach(ex => { (grouped[catalogGroupOf(ex)] = grouped[catalogGroupOf(ex)] || []).push(ex); });
  const groups = [...CATALOG_GROUPS, 'Meus', ...Object.keys(grouped)].filter((g, i, all) => grouped[g] && all.indexOf(g) === i);
  const chips = ['Todos', ...groups].map(g => `<button type="button" class="catalog-chip ${g === catalogState.group ? 'active' : ''}" data-catalog-group="${g}">${g === 'Meus' ? 'Criados por você' : g}</button>`).join('');
  const chevron = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
  const itemHtml = ex => {
    const tag = TYPE_TAG[exerciseType(ex)];
    const added = inWorkout.has(ex);
    const value = ex.replace(/"/g, '&quot;');
    const configurable = added && catalogState.onConfigure;
    const side = !pickFor ? chevron
      : added ? `<span class="catalog-added">no treino${configurable ? planIcon.edit : ''}</span>`
      : '<span class="catalog-plus" aria-hidden="true">+</span>';
    const label = !pickFor ? `Ver ${value}`
      : configurable ? `Configurar ${value}, já está no treino`
      : added ? `${value}, já está no treino` : `Adicionar ${value}`;
    return `
      <div class="catalog-item ${added ? 'added' : ''} ${configurable ? 'configurable' : ''}" data-ex="${value}" data-name="${searchKey(ex)}" role="button" tabindex="0" aria-label="${label}"${pickFor && !added && catalogState.multi ? ' aria-pressed="false"' : ''}>
        ${thumbHtml(db[ex], ex, pickFor ? `data-guide="${value}"` : '', { small: true, interactive: !!pickFor })}
        <span class="catalog-item-name">${ex}${tag ? ` <small class="type-tag">${tag}</small>` : ''}</span>
        ${side}
      </div>`;
  };
  catalogModalContent.innerHTML = `
    <div class="catalog-search-wrap">
      <svg class="catalog-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="text" id="catalogSearchInput" class="catalog-search-input" placeholder="Buscar exercício..." autocomplete="off">
    </div>
    <nav class="catalog-chips" aria-label="Grupos">${chips}</nav>
    <div id="catalogList">
      ${groups.map(g => `<div class="catalog-category" data-cat="${g}">
        <div class="catalog-cat-title">${g === 'Meus' ? 'Criados por você' : g}</div>
        <div class="catalog-grid">${grouped[g].map(itemHtml).join('')}</div>
      </div>`).join('')}
    </div>
    <p class="plan-empty" id="catalogEmpty" hidden>Nenhum exercício encontrado.</p>
    ${catalogState.multi ? '<div class="catalog-pick-bar" hidden><button type="button" id="catalogPickDone" class="save-btn"></button></div>' : ''}`;
  document.getElementById('catalogSearchInput').addEventListener('input', filterCatalog);
  filterCatalog();
}

function filterCatalog() {
  const input = document.getElementById('catalogSearchInput');
  const term = searchKey(input ? input.value.trim() : '');
  let anyVisible = false;
  catalogModalContent.querySelectorAll('.catalog-category').forEach(catEl => {
    const groupOk = catalogState.group === 'Todos' || catEl.dataset.cat === catalogState.group;
    let hasVisible = false;
    catEl.querySelectorAll('.catalog-item').forEach(item => {
      const match = groupOk && item.dataset.name.includes(term);
      item.style.display = match ? 'flex' : 'none';
      if (match) hasVisible = true;
    });
    catEl.style.display = hasVisible ? 'block' : 'none';
    if (hasVisible) anyVisible = true;
  });
  document.getElementById('catalogEmpty').hidden = anyVisible;
}

function bindCatalog() {
  const activate = (e) => {
    const chip = e.target.closest('[data-catalog-group]');
    if (chip) {
      catalogState.group = chip.dataset.catalogGroup;
      catalogModalContent.querySelectorAll('.catalog-chip').forEach(c => c.classList.toggle('active', c === chip));
      filterCatalog();
      return;
    }
    const guide = e.target.closest('[data-guide]');
    if (guide) { showExerciseGuide(guide.dataset.guide); return; }
    const { onPick, onConfigure, selected } = catalogState;
    if (e.target.closest('#catalogPickDone')) {
      catalogModal.classList.remove('visible');
      if (onPick && selected.length) onPick([...selected]);
      return;
    }
    const item = e.target.closest('.catalog-item');
    if (!item) return;
    const ex = item.dataset.ex;
    if (!catalogState.pickFor) { showExerciseGuide(ex); return; }
    if (item.classList.contains('added')) { if (onConfigure) onConfigure(ex); return; }
    if (catalogState.multi) {
      const i = selected.indexOf(ex);
      if (i >= 0) selected.splice(i, 1); else selected.push(ex);
      item.classList.toggle('selected', i < 0);
      item.setAttribute('aria-pressed', String(i < 0));
      item.querySelector('.catalog-plus').textContent = i < 0 ? '✓' : '+';
      const bar = catalogModalContent.querySelector('.catalog-pick-bar');
      bar.hidden = !selected.length;
      bar.querySelector('button').textContent = `Adicionar ${selected.length} ${selected.length === 1 ? 'exercício' : 'exercícios'}`;
      return;
    }
    catalogModal.classList.remove('visible');
    if (onPick) onPick([ex]);
  };
  catalogModalContent.addEventListener('click', activate);
  catalogModalContent.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('catalog-item')) { e.preventDefault(); activate(e); }
  });
}

function renderCategorizedStats() {
  const allEx = allKnownExercises();
  const categories = {};
  allEx.forEach(ex => {
    const history = loadHistory(ex);
    if (history.length === 0) return;
    const lastUnit = history[history.length - 1].unit || 'kg';
    // Melhor série de cada treino. Antes comparava a última série com a
    // penúltima do mesmo treino, então quase sempre mostrava "↑".
    const sessionBests = groupHistoryByDate(history.filter(h => (h.unit || 'kg') === lastUnit)).map(s => bestSetOf(s.sets));
    const last = sessionBests[sessionBests.length - 1];
    const prev = sessionBests.length > 1 ? sessionBests[sessionBests.length - 2] : null;
    let trend = '<span class="stat-trend">1º treino</span>';
    if (prev) {
      const delta = describeLoadDelta(last, prev, lastUnit, exerciseType(ex));
      const arrow = { up: '↑', down: '↓', same: '=' }[delta.dir];
      trend = `<span class="stat-trend ${delta.dir === 'same' ? '' : delta.dir}">${delta.dir === 'same' ? '= igual ao anterior' : `${arrow} ${delta.text.replace(/^[+-]/, '')} vs anterior`}</span>`;
    }
    const catName = db[ex] ? db[ex].cat : "Outros";
    if (!categories[catName]) categories[catName] = [];
    categories[catName].push({ ex, last, trend, sparkline: buildSparklineSVG(sessionBests) });
  });
  if (Object.keys(categories).length === 0) {
    statsBody.innerHTML = emptyStateHtml('list', 'Nenhum histórico ainda', 'Suas cargas aparecem aqui assim que você registrar a primeira série.');
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
          <div class="stat-value">${setText(row.ex, row.last, row.last.unit || 'kg')}</div>
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
  // Conta pelo histórico, a mesma fonte do calendário (antes usava as marcas
  // "series:", que podiam não bater com o que o calendário mostrava).
  const group = m => VOLUME_GROUP[m] || m;
  allKnownExercises().forEach(ex => {
    const info = db[ex];
    if (!info) return;
    const numSets = loadHistory(ex).filter(h => h.date >= weekStart && h.date <= weekEnd).length;
    if (numSets === 0) return;
    const prim = group(info.prim);
    if (vol[prim] !== undefined) vol[prim] += numSets;
    // Auxiliar do mesmo grupo do principal (ex.: glúteo máximo na abdutora) não soma de novo.
    [...new Set(info.sec.map(group))].filter(s => s !== prim).forEach(s => {
      if (vol[s] !== undefined) vol[s] += (numSets * 0.5);
    });
  });
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
  const exercises = exercisesEverIn(day);
  let movedAny = false;

  exercises.forEach(ex => {
    const rawHistory = readJSON(historyKey(ex), []);
    const isMoved = h => h && h.date === fromDate && entryInDay(h, day);
    const movedIndexes = rawHistory.filter(isMoved).map(h => h.setIndex);
    if (movedIndexes.length) {
      movedAny = true;
      saveHistory(ex, rawHistory.map(h => isMoved(h) ? { ...h, date: toDate } : h));
    }

    // Marcas de "série feita" da data nova: as que já havia + as da data antiga
    // + as das séries movidas (as marcas de dias antigos são apagadas na
    // abertura do app, o histórico é que guarda tudo).
    const oldSets = `series:${safeId(day)}:${safeId(ex)}:${fromDate}`;
    const newSets = `series:${safeId(day)}:${safeId(ex)}:${toDate}`;
    if (localStorage.getItem(oldSets) !== null) movedAny = true;
    const marks = [...readJSON(newSets, []), ...readJSON(oldSets, []), ...movedIndexes].filter(Number.isInteger);
    if (marks.length) localStorage.setItem(newSets, JSON.stringify([...new Set(marks)].sort((a, b) => a - b)));
    localStorage.removeItem(oldSets);
  });

  const oldStart = `sessaoInicio:${safeId(day)}:${fromDate}`;
  const newStart = `sessaoInicio:${safeId(day)}:${toDate}`;
  const startVal = localStorage.getItem(oldStart);
  if (startVal !== null) {
    localStorage.setItem(newStart, startVal);
    localStorage.removeItem(oldStart);
    movedAny = true;
  }

  // Horário de fim e exercícios pulados acompanham a data nova.
  ['sessaoFim', 'pulados'].forEach(prefix => {
    const oldKey = `${prefix}:${safeId(day)}:${fromDate}`;
    const value = localStorage.getItem(oldKey);
    if (value === null) return;
    localStorage.setItem(`${prefix}:${safeId(day)}:${toDate}`, value);
    localStorage.removeItem(oldKey);
  });

  if (!movedAny) return false;

  const activeKey = `sessaoAtivaData:${safeId(day)}`;
  if (localStorage.getItem(activeKey) === fromDate) {
    localStorage.setItem(activeKey, toDate);
  }

  const allTime = getAllTimeCompletedDays().map(c => (c && c.day === day && c.date === fromDate) ? { ...c, date: toDate } : c);
  if (!allTime.some(c => c && c.day === day && c.date === toDate)) {
    allTime.push({ day, date: toDate });
  }
  localStorage.setItem('completedDaysAllTime', JSON.stringify(allTime));

  trySync();
  return true;
}

// Lista de treinos do "Corrigir data" (muda quando o usuário cria ou apaga treinos).
function refreshFixDaySelect() {
  const select = document.getElementById('fixDaySelect');
  if (!select) return;
  const keep = select.value;
  select.innerHTML = activeDays().map(d => `<option value="${d}">${dayLabel(d)}</option>`).join('');
  if (activeDays().includes(keep)) select.value = keep;
}

// Configurações › Módulos: liga e desliga Calistenia, Mobilidade e Corrida.
function renderModuleSettings() {
  const box = document.getElementById('moduleSettings');
  if (!box) return;
  box.innerHTML = MODULES.map(m => `
    <label class="module-row">
      <span class="module-text"><strong>${m.name}</strong><small>${m.desc}</small></span>
      <input type="checkbox" class="module-switch" data-module="${m.id}" ${moduleOn(m.id) ? 'checked' : ''}>
    </label>`).join('');
}

function bindModuleSettings() {
  const box = document.getElementById('moduleSettings');
  if (!box) return;
  renderModuleSettings();
  box.addEventListener('change', e => {
    const input = e.target.closest('[data-module]');
    if (!input) return;
    setModule(input.dataset.module, input.checked);
    trySync();
    showToast(input.checked ? 'Módulo ligado' : 'Módulo desligado', input.checked
      ? 'Ele aparece no topo da tela.'
      : 'Os registros dele continuam guardados; é só ligar de novo para ver.');
  });
}

function bindDateFixTool() {
  const select = document.getElementById('fixDaySelect');
  const fromInput = document.getElementById('fixFromDate');
  const toInput = document.getElementById('fixToDate');
  const btn = document.getElementById('fixDateBtn');
  if (!select || !btn) return;
  refreshFixDaySelect();
  btn.addEventListener('click', async () => {
    const day = select.value;
    const fromDate = fromInput.value;
    const toDate = toInput.value;
    const fail = text => alertDialog({ title: 'Corrigir data', text });
    if (!fromDate || !toDate) return fail('Preencha as duas datas.');
    if (fromDate === toDate) return fail('As datas precisam ser diferentes.');
    const ok = await confirmDialog({
      title: 'Mover o treino?',
      text: `Todos os registros de ${dayLabel(day)} do dia ${formatDateBR(fromDate)} vão para ${formatDateBR(toDate)}, e o dia fica marcado como concluído no calendário.`,
      confirmLabel: 'Mover registros'
    });
    if (!ok) return;
    if (!migrateWorkoutDate(day, fromDate, toDate)) return fail('Não encontramos nenhum registro desse treino na data informada.');
    fromInput.value = '';
    toInput.value = '';
    updateHeaderTitle();
    renderDaySelectors();
    renderExercises(currentDay);
    updateSessionBar(currentDay);
    showToast('Corrigido', 'Data do treino foi atualizada com sucesso!');
  });
}

function bindBackupSystem() {
  const syncDisplay = document.getElementById('syncIdDisplay');
  if (syncDisplay) syncDisplay.innerText = formatSyncCode(syncId);
  // Quem tinha um código curto (até a 2.6) ganhou um novo: avisa qual era.
  const oldCode = localStorage.getItem('syncId:antigo');
  const oldNote = document.getElementById('syncOldCode');
  if (oldCode && oldNote) {
    oldNote.hidden = false;
    oldNote.textContent = `Código antigo: ${oldCode}. O backup agora vai para o código novo, mais seguro; o antigo ainda pode ser baixado.`;
  }
  updateSyncStatus();

  // Tocar no código copia (para anotar ou mandar para o outro celular).
  document.getElementById('syncCodeBox').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(formatSyncCode(syncId));
      showToast('Código copiado', `${formatSyncCode(syncId)} está na área de transferência.`);
    } catch (e) {
      showToast('Seu código', formatSyncCode(syncId));
    }
  });
  // Abrir as Configurações mostra o estado atual do backup (pendente, último
  // envio...), o espaço usado, os módulos e os treinos do "Corrigir data".
  document.getElementById('configBtn').addEventListener('click', () => {
    updateSyncStatus();
    updateStorageUsage();
    renderModuleSettings();
    refreshFixDaySelect();
  });

  const syncNowBtn = document.getElementById('syncNowBtn');
  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', () => {
      syncNow();
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
        // Apaga só os arquivos do app; fotos dos exercícios e Firebase ficam
        // (não mudam e seriam baixados de novo à toa).
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(k => k.startsWith('treino-cache-')).map(k => caches.delete(k)));
        }
      } catch (e) {
        console.warn('Erro ao limpar cache:', e);
      }
      location.reload(true);
    });
  }

  document.getElementById('cloudRestoreBtn').addEventListener('click', async () => {
    const code = await promptDialog({
      title: 'Baixar de outro código',
      text: 'Digite o código de sincronização do outro celular (aparece em Configurações nele).',
      placeholder: 'ABCD-EFGH-JKLM',
      confirmLabel: 'Buscar backup'
    });
    if (!code) return;
    const upper = normalizeSyncCode(code);
    let data;
    try {
      data = await fetchCloudBackup(upper);
    } catch (e) {
      alertDialog({ title: 'Sem conexão', text: 'Não deu para buscar o backup. Verifique a internet e tente de novo.' });
      return;
    }
    if (!data) { alertDialog({ title: 'Código não encontrado', text: `Não existe backup na nuvem com o código ${upper}.` }); return; }
    const ok = await confirmDialog({
      title: 'Substituir os treinos?',
      text: 'Os treinos deste celular serão apagados e trocados pelos do backup na nuvem.',
      confirmLabel: 'Baixar e substituir',
      danger: true
    });
    if (!ok) return;
    replaceLocalData(data);
    setSyncId(upper);
    localStorage.setItem('syncId', upper);
    showToast('Sucesso', 'Treinos restaurados da nuvem!');
    setTimeout(() => location.reload(), 1200);
  });

  document.getElementById('exportFileBtn').addEventListener('click', exportBackupFile);
  const importInput = document.getElementById('importFileInput');
  document.getElementById('importFileBtn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = '';
    if (!file) return;
    const notBackup = () => alertDialog({ title: 'Arquivo inválido', text: 'Esse arquivo não é um backup do Treino.' });
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      notBackup();
      return;
    }
    const data = parsed && parsed.app === 'treino' && parsed.data;
    if (!data || typeof data !== 'object' || Object.values(data).some(v => typeof v !== 'string')) {
      notBackup();
      return;
    }
    const when = parsed.exportedAt ? ` de ${new Date(parsed.exportedAt).toLocaleDateString('pt-BR')}` : '';
    const ok = await confirmDialog({
      title: 'Restaurar backup?',
      text: `Os treinos deste celular serão trocados pelos do backup${when}.`,
      confirmLabel: 'Restaurar',
      danger: true
    });
    if (!ok) return;
    replaceLocalData(data);
    showToast('Sucesso', 'Backup restaurado do arquivo!');
    setTimeout(() => location.reload(), 1200);
  });

  document.getElementById('clearDataBtn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Apagar tudo deste celular?',
      text: `Essa ação não pode ser desfeita.\n\nO backup na nuvem NÃO é apagado: anote o código ${syncId} para recuperar depois em "Baixar de outro código".`,
      confirmLabel: 'Apagar tudo',
      danger: true
    });
    if (ok) {
      // Sem sincronizar depois: antes isso subia um backup vazio por cima do da nuvem.
      // Ao recarregar, este celular ganha um código novo.
      cancelPendingSync();
      localStorage.clear();
      location.reload();
    }
  });
}

// Espaço usado pelos dados do app. Os navegadores guardam no máximo ~5 MB por
// site (menos no iPhone); acima de 2 milhões de caracteres, avisa.
const STORAGE_WARN_CHARS = 2000000;
function updateStorageUsage() {
  let chars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    chars += key.length + (localStorage.getItem(key) || '').length;
  }
  document.getElementById('storageUsed').textContent = chars < 1e5
    ? `${Math.max(1, Math.round(chars / 1000))} KB`
    : `${(chars / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  document.getElementById('storageWarn').hidden = chars < STORAGE_WARN_CHARS;
}

function replaceLocalData(data) {
  cancelPendingSync();
  localStorage.clear();
  for (const k in data) localStorage.setItem(k, data[k]);
}

async function exportBackupFile() {
  const payload = { app: 'treino', version: 1, exportedAt: new Date().toISOString(), data: snapshotLocalData() };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  await shareOrDownload(blob, `treino-backup-${todayString()}.json`, 'Backup do Treino');
}


window.showExerciseGuide = function (exercise) {
  const info = db[exercise];
  // Exercício de calistenia/mobilidade: o guia deles (instruções passo a passo e ilustração).
  if (info && info.step) { openStepGuide(info.step); return; }
  const modal = document.getElementById('infoModal');
  document.getElementById('infoTitle').innerText = exercise;
  document.getElementById('infoText').innerText = info && info.tip ? info.tip : "Foque na contração e controle do movimento.";
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
      document.getElementById('planModal').classList.remove('visible');
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