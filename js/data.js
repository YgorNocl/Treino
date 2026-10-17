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

// Código de 6 caracteres sem letras/números parecidos (0/O, 1/I/L).
const SYNC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newSyncId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => SYNC_ALPHABET[b % SYNC_ALPHABET.length]).join('');
}

export let syncId = localStorage.getItem('syncId');
if (!syncId) {
  syncId = newSyncId();
  localStorage.setItem('syncId', syncId);
}

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

export const MEDIA_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// Catálogo de exercícios da academia: grupo, músculos, dica e foto (free-exercise-db).
export const db = {
  "Agachamento Hack": { cat: "Quadríceps", prim: "Quadríceps", sec: ["Glúteo", "Adutores"], tip: "Desça o máximo sem descolar o calcanhar da base.", img: "Hack_Squat" },
  "Leg Press Horizontal Articulado": { cat: "Quadríceps", prim: "Quadríceps", sec: ["Glúteo", "Adutores"], tip: "Máxima amplitude, não trave os joelhos no topo.", img: "Leg_Press" },
  // Alternativas ao Hack e ao Leg Press, sem agachamento (o usuário não gosta de
  // agachar). Entram pelo "Trocar" em Editar Exercícios.
  "Subida no Banco": { cat: "Quadríceps", prim: "Quadríceps", sec: ["Glúteo"], tip: "Halteres nas mãos, pé inteiro no banco; suba empurrando pelo calcanhar da perna de cima, sem impulso da de baixo. Registre as repetições de uma perna (faça as duas).", img: "Dumbbell_Step_Ups" },
  "Cadeira Extensora Unilateral": { cat: "Quadríceps", prim: "Quadríceps", sec: [], tip: "Uma perna por vez, pausa de 1s com a perna esticada. Registre as repetições de uma perna (faça as duas).", img: "Single-Leg_Leg_Extension" },
  "Elevação Pélvica": { cat: "Glúteo", prim: "Glúteo", sec: ["Posterior de Coxa"], tip: "Costas apoiadas no banco, barra (com proteção) no quadril; suba até o tronco ficar reto e aperte o glúteo 1s no topo.", img: "Barbell_Hip_Thrust" },
  "Stiff com Halteres": { cat: "Posterior de Coxa", prim: "Posterior de Coxa", sec: ["Glúteo", "Lombar"], tip: "Joelhos quase esticados, desça os halteres rente às pernas jogando o quadril para trás, coluna reta.", img: "Stiff-Legged_Dumbbell_Deadlift" },
  "Glúteo na Polia (Coice)": { cat: "Glúteo", prim: "Glúteo", sec: ["Posterior de Coxa"], tip: "Tornozeleira na polia baixa; leve a perna para trás sem arquear a lombar.", img: "Glute_Kickback" },
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

// Pedido de 2026-10-16: o Agachamento Hack sai do treino de perna (o usuário não
// gosta de agachar); o Leg Press fica. A Extensora Unilateral (3 séries) entra
// para manter o volume de quadríceps (9 séries, como antes), depois da Cadeira
// Flexora: o quadríceps descansa entre as duas extensoras. O Hack vai para `retired`, então o histórico continua no calendário.
// Roda uma vez por aparelho.
const LEG_CHANGE_KEY = 'plan:perna-sem-hack';
if (!localStorage.getItem(LEG_CHANGE_KEY)) {
  days.forEach(day => {
    const plan = workoutData[day];
    if (!plan.exercises.includes('Agachamento Hack')) return;
    plan.exercises = plan.exercises.filter(ex => ex !== 'Agachamento Hack');
    if (!plan.retired.includes('Agachamento Hack')) plan.retired.push('Agachamento Hack');
    const add = 'Cadeira Extensora Unilateral';
    if (days.some(d => workoutData[d].exercises.includes(add))) return;
    const after = ['Cadeira Flexora', 'Cadeira Extensora'].map(ex => plan.exercises.indexOf(ex)).find(i => i >= 0);
    plan.exercises.splice(after >= 0 ? after + 1 : plan.exercises.length, 0, add);
    plan.retired = plan.retired.filter(ex => ex !== add);
  });
  savePlan();
  localStorage.setItem(LEG_CHANGE_KEY, '1');
}
