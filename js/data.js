import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache, doc, setDoc, getDoc, Bytes } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCCFIgHfNM7mZ3dMDbEkNPBVnDB0HW7vE",
  authDomain: "treino-d6ddf.firebaseapp.com",
  projectId: "treino-d6ddf",
  storageBucket: "treino-d6ddf.firebasestorage.app",
  messagingSenderId: "676526646442",
  appId: "1:676526646442:web:ab9fb417c0c10b6eebdcd3",
  measurementId: "G-RSJREM8Z47"
};

const app = initializeApp(firebaseConfig);
export const dbFirestore = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export let syncId = localStorage.getItem('syncId');
if (!syncId) {
  syncId = Math.random().toString(36).substring(2, 8).toUpperCase();
  localStorage.setItem('syncId', syncId);
}

export function setSyncId(newId) {
  syncId = newId;
}

export let lastSyncAt = Number(localStorage.getItem('lastSyncAt')) || null;

// Cópia de todo o localStorage, usada no backup da nuvem e no arquivo.
export function snapshotLocalData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
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
  const data = snapshotLocalData();
  let payload = data;
  if (typeof CompressionStream !== 'undefined') {
    const bytes = await gzip(JSON.stringify(data));
    if (bytes.length > FIRESTORE_DOC_LIMIT) throw new Error(`Backup grande demais (${bytes.length} bytes)`);
    payload = { v: 2, enc: 'gzip', data: Bytes.fromUint8Array(bytes), updatedAt: Date.now() };
  }
  await setDoc(doc(dbFirestore, "users", syncId), payload);
  lastSyncAt = Date.now();
  localStorage.setItem('lastSyncAt', String(lastSyncAt));
  return true;
}

// Lê o backup de um código. Retorna o objeto chave -> valor, ou null se não existir.
export async function fetchCloudBackup(code) {
  const snap = await getDoc(doc(dbFirestore, "users", code));
  if (!snap.exists()) return null;
  const raw = snap.data();
  if (raw.v === 2 && raw.enc === 'gzip') return JSON.parse(await gunzip(raw.data.toUint8Array()));
  return raw;
}

export const MEDIA_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// Catálogo de exercícios da academia: grupo, músculos, dica e foto (free-exercise-db).
export const db = {
  "Agachamento Hack": { cat: "Quadríceps", prim: "Quadríceps", sec: ["Glúteo", "Adutores"], tip: "Desça o máximo sem descolar o calcanhar da base.", img: "Hack_Squat" },
  "Leg Press Horizontal Articulado": { cat: "Quadríceps", prim: "Quadríceps", sec: ["Glúteo", "Adutores"], tip: "Máxima amplitude, não trave os joelhos no topo.", img: "Leg_Press" },
  "Cadeira Extensora": { cat: "Quadríceps", prim: "Quadríceps", sec: [], tip: "Pausa de 1s no topo com a perna esticada.", img: "Leg_Extensions" },
  "Cadeira Flexora": { cat: "Posterior de Coxa", prim: "Posterior de Coxa", sec: ["Panturrilha"], tip: "Puxe apertando a perna contra o assento.", img: "Seated_Leg_Curl" },
  "Mesa Flexora": { cat: "Posterior de Coxa", prim: "Posterior de Coxa", sec: ["Panturrilha"], tip: "Quadril colado na mesa durante o movimento.", img: "Lying_Leg_Curls" },
  "Cadeira Abdutora": { cat: "Glúteo", prim: "Glúteo Médio", sec: ["Glúteo Máximo", "Lateral do Quadril"], tip: "Incline o tronco levemente à frente para focar no glúteo máximo.", img: "Thigh_Abductor" },
  "Cadeira Adutora": { cat: "Inferiores", prim: "Adutores", sec: [], tip: "Aperte bem no final do movimento.", img: "Thigh_Adductor" },
  "Panturrilha Sentado": { cat: "Inferiores", prim: "Panturrilha", sec: [], tip: "Alongue tudo embaixo e pause 1s no topo.", img: "Seated_Calf_Raise" },
  "Supino Máquina": { cat: "Peito / Empurrar", prim: "Peito", sec: ["Ombro Anterior", "Tríceps"], tip: "Mantenha o peito estufado e os ombros firmes para trás.", img: "Leverage_Chest_Press" },
  "Crucifixo Reto Articulado": { cat: "Peito / Empurrar", prim: "Peito", sec: ["Ombro Anterior"], tip: "Sinta o peito alongar ao máximo sem dobrar muito os cotovelos.", img: "Butterfly" },
  "Puxada Alta Aberta Frente": { cat: "Costas / Puxar", prim: "Costas", sec: ["Bíceps", "Ombro Posterior"], tip: "Não mexa as escápulas durante a puxada! Puxe com os cotovelos até a frente do peito.", img: "Wide-Grip_Lat_Pulldown" },
  "Remada Baixa com Triângulo": { cat: "Costas / Puxar", prim: "Costas", sec: ["Bíceps", "Ombro Posterior"], tip: "Tronco levemente inclinado, puxe no umbigo.", img: "Seated_Cable_Rows" },
  "Elevação Lateral (Máquina/Polia)": { cat: "Ombro / Empurrar", prim: "Ombro Lateral", sec: ["Trapézio"], tip: "Empurre o peso para os lados, não para cima.", img: "Side_Lateral_Raise" },
  "Desenvolvimento Articulado Aberto": { cat: "Ombro / Empurrar", prim: "Ombro Anterior", sec: ["Ombro Lateral", "Tríceps"], tip: "Não estique totalmente os cotovelos no topo para manter a tensão.", img: "Standing_Military_Press" },
  "Rosca Bíceps (Máquina/Polia Baixa)": { cat: "Braços", prim: "Bíceps", sec: ["Antebraço"], tip: "Cotovelos fixos, evite balançar o tronco para ajudar o movimento.", img: "Standing_Biceps_Cable_Curl" },
  "Tríceps Pulley Barra Reta": { cat: "Braços", prim: "Tríceps", sec: [], tip: "Mantenha os cotovelos colados ao tronco.", img: "Triceps_Pushdown" },
  "Abdominal Máquina": { cat: "Core", prim: "Abdômen", sec: [], tip: "Enrole o tronco, não dobre apenas o quadril.", img: "Ab_Crunch_Machine" }
};

// Músculos que o volume semanal e o mapa do corpo reconhecem, com a categoria
// usada no catálogo/histórico para exercícios criados pelo usuário.
export const MUSCLE_CATEGORIES = {
  "Peito": "Peito / Empurrar",
  "Costas": "Costas / Puxar",
  "Ombro Anterior": "Ombro / Empurrar",
  "Ombro Lateral": "Ombro / Empurrar",
  "Bíceps": "Braços",
  "Tríceps": "Braços",
  "Abdômen": "Core",
  "Quadríceps": "Quadríceps",
  "Posterior de Coxa": "Posterior de Coxa",
  "Glúteo": "Glúteo",
  "Glúteo Médio": "Glúteo",
  "Adutores": "Inferiores",
  "Panturrilha": "Inferiores"
};

// Músculos mais específicos que o mapa mostra separados, mas que no volume
// semanal somam no grupo principal.
export const VOLUME_GROUP = {
  "Glúteo Médio": "Glúteo",
  "Glúteo Máximo": "Glúteo",
  "Reto Femoral": "Quadríceps"
};

const CUSTOM_EXERCISES_KEY = 'gym:customExercises';

function loadCustomExercises() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_EXERCISES_KEY) || '{}');
    for (const name in saved) {
      const prim = saved[name].prim;
      db[name] = { cat: MUSCLE_CATEGORIES[prim] || 'Outros', prim, sec: [], tip: '', custom: true };
    }
  } catch (e) { /* lista corrompida: segue só com o catálogo padrão */ }
}
loadCustomExercises();

export function addCustomExercise(name, prim) {
  const saved = JSON.parse(localStorage.getItem(CUSTOM_EXERCISES_KEY) || '{}');
  saved[name] = { prim };
  localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(saved));
  db[name] = { cat: MUSCLE_CATEGORIES[prim] || 'Outros', prim, sec: [], tip: '', custom: true };
}

export const SETS_PER_EXERCISE = 3;

const DEFAULT_PLAN = {
  "Treino A": { group: "lower", exercises: ["Agachamento Hack", "Leg Press Horizontal Articulado", "Cadeira Extensora", "Cadeira Flexora", "Mesa Flexora", "Cadeira Abdutora", "Cadeira Adutora", "Panturrilha Sentado"] },
  "Treino B": { group: "upper", exercises: ["Supino Máquina", "Crucifixo Reto Articulado", "Puxada Alta Aberta Frente", "Remada Baixa com Triângulo", "Elevação Lateral (Máquina/Polia)", "Desenvolvimento Articulado Aberto", "Rosca Bíceps (Máquina/Polia Baixa)", "Tríceps Pulley Barra Reta", "Abdominal Máquina"] }
};

// O treino editado pelo usuário fica em `gym:plan`. Por dia:
// - exercises: ordem atual
// - sets: número de séries por exercício (sem valor = SETS_PER_EXERCISE)
// - retired: exercícios que já estiveram nesse treino e foram tirados — o
//   calendário e o histórico continuam atribuindo os registros antigos a ele.
const PLAN_KEY = 'gym:plan';

function loadPlan() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch (e) { saved = null; }
  const plan = {};
  for (const day in DEFAULT_PLAN) {
    const s = (saved && saved[day]) || {};
    plan[day] = {
      group: DEFAULT_PLAN[day].group,
      exercises: Array.isArray(s.exercises) ? s.exercises.filter(ex => db[ex]) : [...DEFAULT_PLAN[day].exercises],
      sets: s.sets && typeof s.sets === 'object' ? s.sets : {},
      retired: Array.isArray(s.retired) ? s.retired : []
    };
  }
  return plan;
}

export const workoutData = loadPlan();
export const days = Object.keys(workoutData);

export function savePlan() {
  const out = {};
  for (const day in workoutData) {
    const { exercises, sets, retired } = workoutData[day];
    out[day] = { exercises, sets, retired };
  }
  localStorage.setItem(PLAN_KEY, JSON.stringify(out));
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
