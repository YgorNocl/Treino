// Firebase só é carregado na hora do primeiro backup: antes, o import no topo
// fazia o app inteiro depender de baixar o Firebase para abrir (sem internet e
// sem o arquivo em cache, nada funcionava).
const FIREBASE_VERSION = '10.12.0';
const firebaseConfig = {
  apiKey: "AIzaSyDCCFIgHfNM7mZ3dMDbEkNPBVnDB0HW7vE",
  authDomain: "treino-d6ddf.firebaseapp.com",
  projectId: "treino-d6ddf",
  storageBucket: "treino-d6ddf.firebasestorage.app",
  messagingSenderId: "676526646442",
  appId: "1:676526646442:web:ab9fb417c0c10b6eebdcd3",
  measurementId: "G-RSJREM8Z47"
};

let firestorePromise = null;
function loadFirestore() {
  // Servidor de teste (.claude/serve.js ... test): sem nuvem, para os testes não
  // gravarem backups de mentira no Firestore.
  if (self.TREINO_NO_CLOUD) return Promise.reject(new Error('Nuvem desligada (teste)'));
  if (!firestorePromise) {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    firestorePromise = Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-firestore.js`)
    ]).then(([{ initializeApp }, fs]) => {
      const app = initializeApp(firebaseConfig);
      const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
      return { db, doc: fs.doc, setDoc: fs.setDoc, getDoc: fs.getDoc, Bytes: fs.Bytes };
    }).catch(e => {
      firestorePromise = null; // sem internet agora: tenta de novo no próximo backup
      throw e;
    });
  }
  return firestorePromise;
}

// Código do backup: 12 caracteres sem letras/números parecidos (0/O, 1/I/L),
// ~59 bits — impossível de adivinhar. Os antigos tinham 6 (dava para tentar
// todos); quem ainda tem um curto ganha um novo e o backup passa a ir para ele.
// As regras do Firestore (ver MUDANCAS.md) só aceitam gravar em códigos de 12+.
const SYNC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SYNC_ID_LENGTH = 12;
function newSyncId() {
  const bytes = crypto.getRandomValues(new Uint8Array(SYNC_ID_LENGTH));
  return Array.from(bytes, b => SYNC_ALPHABET[b % SYNC_ALPHABET.length]).join('');
}

export let syncId = localStorage.getItem('syncId');
if (!syncId || syncId.length < SYNC_ID_LENGTH) {
  if (syncId) {
    localStorage.setItem('syncId:antigo', syncId);
    localStorage.setItem('sync:pending', '1'); // cria o backup no código novo
  }
  syncId = newSyncId();
  localStorage.setItem('syncId', syncId);
}

// "ABCD-EFGH-JKLM" na tela; ao digitar, aceita com ou sem traços/espaços.
export function formatSyncCode(code) { return (String(code).match(/.{1,4}/g) || []).join('-'); }
export function normalizeSyncCode(text) { return String(text).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

export function setSyncId(newId) {
  syncId = newId;
}

export let lastSyncAt = Number(localStorage.getItem('lastSyncAt')) || null;

// Chaves que só fazem sentido neste aparelho (não vão para o backup).
const DEVICE_ONLY_KEYS = new Set(['sync:pending']);

// Cópia de todo o localStorage, usada no backup da nuvem e no arquivo.
export function snapshotLocalData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!DEVICE_ONLY_KEYS.has(key)) data[key] = localStorage.getItem(key);
  }
  return data;
}

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

// Um documento do Firestore aceita no máximo 1 MB. O backup vai compactado
// (gzip), o que cabe com folga o localStorage inteiro (limite ~5 MB). Em
// navegador sem CompressionStream, cai no formato antigo (uma chave por campo).
const FIRESTORE_DOC_LIMIT = 1000000;

export async function syncToCloud() {
  const { db, doc, setDoc, Bytes } = await loadFirestore();
  const data = snapshotLocalData();
  let payload = data;
  if (typeof CompressionStream !== 'undefined') {
    const bytes = await gzip(JSON.stringify(data));
    if (bytes.length > FIRESTORE_DOC_LIMIT) throw new Error(`Backup grande demais (${bytes.length} bytes)`);
    payload = { v: 2, enc: 'gzip', data: Bytes.fromUint8Array(bytes), updatedAt: Date.now() };
  }
  await setDoc(doc(db, "users", syncId), payload);
  lastSyncAt = Date.now();
  localStorage.setItem('lastSyncAt', String(lastSyncAt));
  return true;
}

// Lê o backup de um código. Retorna o objeto chave -> valor, ou null se não existir.
export async function fetchCloudBackup(code) {
  const { db, doc, getDoc } = await loadFirestore();
  const snap = await getDoc(doc(db, "users", code));
  if (!snap.exists()) return null;
  const raw = snap.data();
  if (raw.v === 2 && raw.enc === 'gzip') return JSON.parse(await gunzip(raw.data.toUint8Array()));
  return raw;
}

import { CATALOG, MUSCLE_CATEGORIES, VOLUME_GROUP, MEDIA_BASE } from './catalog.js';
import { CALI_STEP_LIST, stepMuscles } from './calisthenics-data.js';

export { MEDIA_BASE, MUSCLE_CATEGORIES, VOLUME_GROUP };

// Catálogo para montar treinos: os exercícios de academia (catalog.js) + os de
// calistenia e mobilidade (mesmo guia com instruções e ilustração; `step` é o
// id deles em calisthenics-data.js) + os criados pelo usuário.
export const db = { ...CATALOG };
CALI_STEP_LIST.forEach(step => {
  if (db[step.name]) return;
  const muscles = stepMuscles(step) || { prim: ['Core'], sec: [] };
  db[step.name] = {
    cat: step.area === 'mobilidade' ? 'Mobilidade' : 'Peso do corpo',
    prim: muscles.prim[0],
    sec: [...muscles.prim.slice(1), ...muscles.sec],
    img: step.img,
    tip: step.tip,
    type: step.mode === 'time' ? 'time' : 'reps',
    step: step.id
  };
});

export function exerciseType(name) { return (db[name] && db[name].type) || 'load'; }

const CUSTOM_EXERCISES_KEY = 'gym:customExercises';
const EXERCISE_TYPE_IDS = ['load', 'reps', 'time'];

function customEntry({ prim, type }) {
  return { cat: MUSCLE_CATEGORIES[prim] || 'Outros', prim, sec: [], tip: '', custom: true, type: EXERCISE_TYPE_IDS.includes(type) ? type : 'load' };
}

function loadCustomExercises() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_EXERCISES_KEY) || '{}');
    for (const name in saved) db[name] = customEntry(saved[name]);
  } catch (e) { /* lista corrompida: segue só com o catálogo padrão */ }
}
loadCustomExercises();

export function addCustomExercise(name, prim, type = 'load') {
  const saved = JSON.parse(localStorage.getItem(CUSTOM_EXERCISES_KEY) || '{}');
  saved[name] = { prim, type };
  localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(saved));
  db[name] = customEntry(saved[name]);
}

export const SETS_PER_EXERCISE = 3;
export const MAX_SETS = 10;

// ---------- Treinos ----------
// Lista ordenada em `gym:workouts`, cada treino:
//   { id, name, color, exercises: [nomes], sets: { nome: n }, retired: [nomes], archived? }
// - `id` é gravado no histórico (campo `day`) e nas chaves da sessão
//   (series:<id>:..., sessaoInicio:<id>:...): nunca muda, mesmo renomeando.
// - `retired`: exercícios que já estiveram no treino e saíram — o calendário e
//   o histórico continuam atribuindo os registros antigos a ele.
// - `archived`: treino apagado que tinha histórico; some da tela, mas o
//   calendário ainda mostra os dias dele com o nome e a cor.
const WORKOUTS_KEY = 'gym:workouts';
export const WORKOUT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#22c55e', '#06b6d4'];

export const workoutData = {};
export const days = [];

function addLoaded(w) {
  if (!w || typeof w.id !== 'string' || !w.id || workoutData[w.id]) return;
  workoutData[w.id] = {
    id: w.id,
    name: typeof w.name === 'string' && w.name.trim() ? w.name.trim() : 'Treino',
    color: typeof w.color === 'string' ? w.color : WORKOUT_COLORS[days.length % WORKOUT_COLORS.length],
    exercises: Array.isArray(w.exercises) ? w.exercises.filter(ex => db[ex]) : [],
    sets: w.sets && typeof w.sets === 'object' ? { ...w.sets } : {},
    retired: Array.isArray(w.retired) ? w.retired.filter(ex => typeof ex === 'string') : [],
    archived: !!w.archived
  };
  days.push(w.id);
}

export function savePlan() {
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(days.map(id => {
    const { name, color, exercises, sets, retired, archived } = workoutData[id];
    return archived ? { id, name, color, exercises, sets, retired, archived } : { id, name, color, exercises, sets, retired };
  })));
}

// Treinos que aparecem na tela (sem os apagados que só guardam histórico).
export function activeDays() { return days.filter(id => !workoutData[id].archived); }

function newWorkoutId() {
  let id;
  do { id = `w${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`; } while (workoutData[id]);
  return id;
}

export function createWorkout(name, exercises = [], sets = {}) {
  const used = new Set(activeDays().map(id => workoutData[id].color));
  const color = WORKOUT_COLORS.find(c => !used.has(c)) || WORKOUT_COLORS[days.length % WORKOUT_COLORS.length];
  const id = newWorkoutId();
  addLoaded({ id, name: String(name).slice(0, 30), color, exercises: [...new Set(exercises)].filter(ex => db[ex]), sets });
  savePlan();
  return id;
}

export function updateWorkout(id, changes) {
  const w = workoutData[id];
  if (!w) return;
  if (typeof changes.name === 'string' && changes.name.trim()) w.name = changes.name.trim().slice(0, 30);
  if (typeof changes.color === 'string') w.color = changes.color;
  savePlan();
}

// Apagar: sem histórico some de vez; com histórico vira "arquivado" (os dias
// continuam no calendário com o nome e a cor).
export function deleteWorkout(id, hasHistory) {
  if (!workoutData[id]) return;
  if (hasHistory) {
    workoutData[id].archived = true;
  } else {
    delete workoutData[id];
    days.splice(days.indexOf(id), 1);
  }
  savePlan();
}

export function moveWorkout(id, step) {
  const active = activeDays();
  const from = active.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= active.length) return;
  const a = days.indexOf(id);
  const b = days.indexOf(active[to]);
  [days[a], days[b]] = [days[b], days[a]];
  savePlan();
}

export function setsFor(day, exercise) {
  const n = workoutData[day] && workoutData[day].sets[exercise];
  return Number.isInteger(n) && n > 0 ? n : SETS_PER_EXERCISE;
}

// Exercícios atuais + os que já saíram desse treino (para o histórico).
export function exercisesEverIn(day) {
  if (!workoutData[day]) return [];
  return [...new Set([...workoutData[day].exercises, ...workoutData[day].retired])];
}

// ---------- Migração da versão 2.x ----------
// Até a 2.6 havia dois treinos fixos: "Treino A" (Inferior) e "Treino B"
// (Superior), em `gym:plan`. Quem já usava o app continua com eles — mesmos ids,
// então todo o histórico continua ligado —, com o nome e a cor de antes.
// Instalação nova começa sem nenhum treino.
const LEGACY_PLAN_KEY = 'gym:plan';
const LEGACY_DEFAULT = {
  'Treino B': { name: 'Superior', color: '#3b82f6', exercises: ['Supino Máquina', 'Crucifixo Reto Articulado', 'Puxada Alta Aberta Frente', 'Remada Baixa com Triângulo', 'Elevação Lateral (Máquina/Polia)', 'Desenvolvimento Articulado Aberto', 'Rosca Bíceps (Máquina/Polia Baixa)', 'Tríceps Pulley Barra Reta', 'Abdominal Máquina'] },
  'Treino A': { name: 'Inferior', color: '#8b5cf6', exercises: ['Agachamento Hack', 'Leg Press Horizontal Articulado', 'Cadeira Extensora', 'Cadeira Flexora', 'Mesa Flexora', 'Cadeira Abdutora', 'Cadeira Adutora', 'Panturrilha Sentado'] }
};

export function hasLegacyData() {
  if (localStorage.getItem(LEGACY_PLAN_KEY) || localStorage.getItem('completedDaysAllTime')) return true;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith('historico:')) return true;
  }
  return false;
}

function migrateLegacyPlan() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LEGACY_PLAN_KEY) || 'null'); } catch (e) { saved = null; }
  Object.entries(LEGACY_DEFAULT).forEach(([id, def]) => {
    const s = (saved && typeof saved[id] === 'object' && saved[id]) || {};
    const w = {
      id,
      name: def.name,
      color: def.color,
      exercises: Array.isArray(s.exercises) ? [...s.exercises] : [...def.exercises],
      sets: s.sets && typeof s.sets === 'object' ? s.sets : {},
      retired: Array.isArray(s.retired) ? [...s.retired] : []
    };
    // Pedido de 2026-10-16 (v2.6), para quem ainda não tinha recebido: o Hack
    // sai do treino de perna e a Extensora Unilateral entra depois da Flexora.
    if (!localStorage.getItem('plan:perna-sem-hack') && w.exercises.includes('Agachamento Hack')) {
      w.exercises = w.exercises.filter(ex => ex !== 'Agachamento Hack');
      if (!w.retired.includes('Agachamento Hack')) w.retired.push('Agachamento Hack');
      if (!w.exercises.includes('Cadeira Extensora Unilateral')) {
        const after = ['Cadeira Flexora', 'Cadeira Extensora'].map(ex => w.exercises.indexOf(ex)).find(i => i >= 0);
        w.exercises.splice(after >= 0 ? after + 1 : w.exercises.length, 0, 'Cadeira Extensora Unilateral');
      }
      w.retired = w.retired.filter(ex => ex !== 'Cadeira Extensora Unilateral');
    }
    addLoaded(w);
  });
}

(function loadWorkouts() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(WORKOUTS_KEY) || 'null'); } catch (e) { saved = null; }
  if (Array.isArray(saved)) {
    saved.forEach(addLoaded);
    return;
  }
  if (hasLegacyData()) migrateLegacyPlan();
  savePlan();
})();
