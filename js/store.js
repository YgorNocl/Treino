import { db, workoutData, days } from './data.js';
import { trySync } from './sync.js';
import { pad2, todayString, yesterdayString, safeId, formatLoad, estimatedMax, dateStrFromDate, parseNum } from './utils.js';

export function storageKey(day, exercise) { return `treino:${safeId(day)}:${safeId(exercise)}`; }
export function historyKey(exercise) { return `historico:${safeId(exercise)}`; }

export function sessionDateFor(day) {
  const yesterdayStartRaw = localStorage.getItem(`sessaoInicio:${safeId(day)}:${yesterdayString()}`);
  if (yesterdayStartRaw) {
    const yesterdayEndRaw = localStorage.getItem(`sessaoFim:${safeId(day)}:${yesterdayString()}`);
    if (!yesterdayEndRaw) return yesterdayString();
  }
  return todayString();
}

export function setsKey(day, exercise) { return `series:${safeId(day)}:${safeId(exercise)}:${sessionDateFor(day)}`; }
export function sessionStartKey(day) { return `sessaoInicio:${safeId(day)}:${sessionDateFor(day)}`; }
export function sessionEndKey(day) { return `sessaoFim:${safeId(day)}:${sessionDateFor(day)}`; }

export function checkAutoReset() {
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

export function getCompletedDays() { return JSON.parse(localStorage.getItem('completedDays') || '[]'); }

export function calculateStreak() {
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

export function saveCompletedDay(day) {
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
}

export function markSessionStarted(day) {
  const key = sessionStartKey(day);
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, String(Date.now()));
    trySync();
  }
}

export function getSessionDurationLabel(day) {
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

export function getSessionTimeLabel(day, dateStr) {
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

export function buildWorkoutSummary(day) {
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

export function loadProgress(day, exercise) {
  const raw = localStorage.getItem(storageKey(day, exercise));
  return raw ? JSON.parse(raw) : { weight: '', reps: '', notes: '', unit: getLastUsedUnit(exercise) };
}

export function saveProgressData(day, exercise, weight, reps, notes, setIndex, unit) {
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

export function loadHistory(exercise) {
  const history = JSON.parse(localStorage.getItem(historyKey(exercise)) || '[]');
  return history.map(h => ({ unit: 'kg', ...h }));
}

export function getSetsCompleted(day, exercise) { return JSON.parse(localStorage.getItem(setsKey(day, exercise)) || '[]'); }

export function toggleSetCompletion(day, exercise, index) {
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
}

export function getLastUsedUnit(exercise) {
  const history = loadHistory(exercise);
  if (history.length === 0) return 'kg';
  return history[history.length - 1].unit || 'kg';
}

export function getPersonalRecord(exercise, unit) {
  const targetUnit = unit || getLastUsedUnit(exercise);
  const history = loadHistory(exercise).filter(h => (h.unit || 'kg') === targetUnit);
  if (history.length === 0) return null;
  return history.reduce((best, h) => estimatedMax(h.weight, h.reps) > estimatedMax(best.weight, best.reps) ? h : best);
}

export function getProgressionHint(exercise) {
  const history = loadHistory(exercise);
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  if (!last.weight || !last.reps) return null;
  const unit = last.unit || 'kg';
  if (last.reps >= 12) {
    const nextWeight = Math.round((last.weight * 1.05) * 2) / 2;
    return { weight: nextWeight, reps: Math.max(8, last.reps - 4), unit, label: `Última vez: ${formatLoad(last.weight, unit)}×${last.reps}. Tente ${formatLoad(nextWeight, unit)} hoje.` };
  }
  return { weight: last.weight, reps: last.reps + 1, unit, label: `Última vez: ${formatLoad(last.weight, unit)}×${last.reps}. Tente 1 rep a mais.` };
}

export function getNextExercise(day, currentExercise) {
  const list = workoutData[day].exercises;
  const idx = list.indexOf(currentExercise);
  if (idx === -1 || idx === list.length - 1) return null;
  return list[idx + 1];
}

export function loadBodyMetrics() {
  return JSON.parse(localStorage.getItem('bodyMetrics') || '[]');
}

export function saveBodyMetrics(dataObj) {
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
}

export function getAllTimeCompletedDays() {
  return JSON.parse(localStorage.getItem('completedDaysAllTime') || '[]');
}

export function getWorkoutsForDate(dateStr) {
  const allTime = getAllTimeCompletedDays();
  return allTime.filter(c => c && c.date === dateStr);
}

export function getExerciseNameFromSafeId(safeExId) {
  for (const real in db) { if (safeId(real) === safeExId) return real; }
  return null;
}

export function getExercisesLoggedForDay(day, dateStr) {
  const list = workoutData[day] ? workoutData[day].exercises : Object.keys(db);
  const result = [];
  list.forEach(ex => {
    const history = loadHistory(ex);
    const sets = history.filter(h => h.date === dateStr).sort((a, b) => a.setIndex - b.setIndex);
    if (sets.length > 0) result.push({ exercise: ex, sets });
  });
  return result;
}

export function groupHistoryByDate(history) {
  const map = new Map();
  history.forEach(h => {
    if (!map.has(h.date)) map.set(h.date, []);
    map.get(h.date).push(h);
  });
  return [...map.entries()]
    .map(([date, sets]) => ({ date, sets }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getExercisesWithHistoryGrouped() {
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

export function buildMonthGrid(year, month) {
  const allTime = getAllTimeCompletedDays();
  const byDate = new Map();
  allTime.forEach(c => {
    if (!c || !c.date) return;
    byDate.set(c.date, c.day);
  });

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
      workout: byDate.get(dateStr) || null,
      isToday: dateStr === today,
      isFuture: dateStr > today
    });
  }
  return cells;
}

export function getMonthTrainedCount(year, month) {
  const allTime = getAllTimeCompletedDays();
  const prefix = `${year}-${pad2(month + 1)}-`;
  const uniqueDates = new Set(allTime.filter(c => c && c.date && c.date.startsWith(prefix)).map(c => c.date));
  return uniqueDates.size;
}

export function getYearTrainedCount(year) {
  const allTime = getAllTimeCompletedDays();
  const prefix = `${year}-`;
  const uniqueDates = new Set(allTime.filter(c => c && c.date && c.date.startsWith(prefix)).map(c => c.date));
  return uniqueDates.size;
}