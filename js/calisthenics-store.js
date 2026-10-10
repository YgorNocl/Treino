import { todayString, pad2, getWeekStart, getWeekEnd, readListCached } from './utils.js';
import { trySync } from './sync.js';
import { MODE_STEP_LIST } from './calisthenics-data.js';

const MODE_KEY = 'app:mode';
const REST_KEY_PREFIX = 'cali:rest:';
const PREP_KEY_PREFIX = 'cali:prep:';
const FINISHED_KEY_PREFIX = 'cali:finished:';

export const REST_OPTIONS = [60, 90, 120, 180];
export const PREP_OPTIONS = [0, 5, 10];

const logKey = stepId => `cali:log:${stepId}`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
}

function readNumber(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getMode() {
  const stored = localStorage.getItem(MODE_KEY);
  return ['gym', 'cali', 'mobi'].includes(stored) ? stored : 'gym';
}

export function setMode(mode) {
  localStorage.setItem(MODE_KEY, ['gym', 'cali', 'mobi'].includes(mode) ? mode : 'gym');
}

export function getRestSeconds(mode) {
  const value = readNumber(REST_KEY_PREFIX + mode, 90);
  return REST_OPTIONS.includes(value) ? value : 90;
}

export function setRestSeconds(mode, value) {
  localStorage.setItem(REST_KEY_PREFIX + mode, String(value));
}

export function getPrepSeconds(mode) {
  const value = readNumber(PREP_KEY_PREFIX + mode, 5);
  return PREP_OPTIONS.includes(value) ? value : 5;
}

export function setPrepSeconds(mode, value) {
  localStorage.setItem(PREP_KEY_PREFIX + mode, String(value));
}

export function isDayFinished(mode, date) {
  return localStorage.getItem(`${FINISHED_KEY_PREFIX}${mode}:${date}`) === '1';
}

export function finishDay(mode, date) {
  localStorage.setItem(`${FINISHED_KEY_PREFIX}${mode}:${date}`, '1');
  trySync();
}

// Apaga todas as séries do modo numa data e o "finalizado" dela (treino
// marcado sem querer).
export function deleteDay(mode, date) {
  (MODE_STEP_LIST[mode] || []).forEach(step => {
    const log = loadLog(step.id);
    const kept = log.filter(e => e.d !== date);
    if (kept.length !== log.length) saveLog(step.id, kept);
  });
  localStorage.removeItem(`${FINISHED_KEY_PREFIX}${mode}:${date}`);
  trySync();
}

// Lido com cache (utils.readListCached): os itens voltam congelados.
function buildLog(list) {
  return list
    .filter(e => e && typeof e.v === 'number' && e.v > 0 && typeof e.d === 'string')
    .map(e => ({ d: e.d, v: e.v, n: typeof e.n === 'string' ? e.n : '', t: Number(e.t) || 0 }));
}

export function loadLog(stepId) {
  return readListCached(logKey(stepId), buildLog);
}

// Grava sem a observação quando ela está vazia (a leitura devolve '').
function saveLog(stepId, log) {
  localStorage.setItem(logKey(stepId), JSON.stringify(log.map(e => (e.n ? e : { d: e.d, v: e.v, t: e.t }))));
}

export function addSet(stepId, value, note) {
  const log = loadLog(stepId);
  const entry = { d: todayString(), v: value, n: note || '', t: Date.now() };
  log.push(entry);
  saveLog(stepId, log);
  trySync();
  return entry;
}

export function updateSet(stepId, t, value) {
  const log = loadLog(stepId);
  if (!log.some(e => e.t === t)) return;
  saveLog(stepId, log.map(e => (e.t === t ? { ...e, v: value } : e)));
  trySync();
}

export function removeSet(stepId, t) {
  const log = loadLog(stepId);
  const index = log.findIndex(e => e.t === t);
  if (index === -1) return;
  log.splice(index, 1);
  saveLog(stepId, log);
  trySync();
}

export function setsOn(stepId, date) {
  return loadLog(stepId).filter(e => e.d === date).sort((a, b) => a.t - b.t);
}

export function sessionsOf(stepId) {
  const map = new Map();
  loadLog(stepId).forEach(entry => {
    if (!map.has(entry.d)) map.set(entry.d, []);
    map.get(entry.d).push(entry);
  });
  return [...map.entries()]
    .map(([date, sets]) => ({ date, sets: sets.sort((a, b) => a.t - b.t) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getBest(stepId) {
  const log = loadLog(stepId);
  return log.length ? Math.max(...log.map(e => e.v)) : 0;
}

export function getBestBefore(stepId, date) {
  const prior = loadLog(stepId).filter(e => e.d < date);
  return prior.length ? Math.max(...prior.map(e => e.v)) : 0;
}

export function getSeries(stepId) {
  return sessionsOf(stepId).map(session => ({
    date: session.date,
    best: Math.max(...session.sets.map(s => s.v)),
    total: session.sets.reduce((sum, s) => sum + s.v, 0),
    sets: session.sets
  }));
}

export function buildDayIndex(mode) {
  const list = MODE_STEP_LIST[mode] || [];
  const index = new Map();
  list.forEach(step => {
    loadLog(step.id).forEach(entry => {
      let day = index.get(entry.d);
      if (!day) {
        day = { date: entry.d, sets: 0, holdSeconds: 0, reps: 0, areas: new Set(), stepIds: new Set(), first: entry.t, last: entry.t };
        index.set(entry.d, day);
      }
      day.sets += 1;
      if (step.mode === 'time') day.holdSeconds += entry.v;
      else day.reps += entry.v;
      day.areas.add(step.area);
      day.stepIds.add(step.id);
      if (entry.t && (!day.first || entry.t < day.first)) day.first = entry.t;
      if (entry.t > day.last) day.last = entry.t;
    });
  });
  return index;
}

export function getWeekSessionCount(index) {
  const start = getWeekStart(todayString());
  const end = getWeekEnd(start);
  let count = 0;
  index.forEach((_, date) => {
    if (date >= start && date <= end) count += 1;
  });
  return count;
}

export function getLastTrained(mode) {
  const list = MODE_STEP_LIST[mode] || [];
  let found = null;
  list.forEach(step => {
    const log = loadLog(step.id);
    if (log.length === 0) return;
    const last = log.reduce((a, b) => (b.t >= a.t ? b : a));
    if (!found || last.t > found.entry.t) found = { step, entry: last };
  });
  return found;
}

export function getStepsWithHistory(mode) {
  const list = MODE_STEP_LIST[mode] || [];
  return list.filter(step => loadLog(step.id).length > 0);
}

export function getDayDetail(mode, date) {
  const list = MODE_STEP_LIST[mode] || [];
  const items = [];
  list.forEach(step => {
    const sets = setsOn(step.id, date);
    if (sets.length === 0) return;
    const best = Math.max(...sets.map(s => s.v));
    const before = getBestBefore(step.id, date);
    items.push({ step, sets, best, isPR: before > 0 && best > before });
  });
  return items.sort((a, b) => a.sets[0].t - b.sets[0].t);
}


export function summarizeMonth(year, month, index) {
  const prefix = `${year}-${pad2(month + 1)}-`;
  const out = { days: 0, sets: 0, holdSeconds: 0, reps: 0 };
  index.forEach((day, date) => {
    if (!date.startsWith(prefix)) return;
    out.days += 1;
    out.sets += day.sets;
    out.holdSeconds += day.holdSeconds;
    out.reps += day.reps;
  });
  return out;
}