import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

export function syncToCloud() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  return setDoc(doc(dbFirestore, "users", syncId), data).then(() => {
    lastSyncAt = Date.now();
    localStorage.setItem('lastSyncAt', String(lastSyncAt));
    return true;
  });
}

export const MEDIA_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// Adicionada a propriedade equipImg para imagens dos equipamentos/pegadas
export const db = {
  "Agachamento Hack": { cat: "Quadríceps", prim: "Quadríceps", sec: ["Glúteo"], tip: "Desça o máximo sem descolar o calcanhar da base.", img: "Hack_Squat" },
  "Leg Press Horizontal Articulado": { cat: "Quadríceps", prim: "Quadríceps", sec: ["Glúteo"], tip: "Máxima amplitude, não trave os joelhos no topo.", img: "Leg_Press" },
  "Cadeira Extensora": { cat: "Quadríceps", prim: "Quadríceps", sec: [], tip: "Pausa de 1s no topo com a perna esticada.", img: "Leg_Extensions" },
  "Cadeira Flexora": { cat: "Posterior de Coxa", prim: "Posterior de Coxa", sec: [], tip: "Puxe apertando a perna contra o assento.", img: "Seated_Leg_Curl" },
  "Mesa Flexora": { cat: "Posterior de Coxa", prim: "Posterior de Coxa", sec: [], tip: "Quadril colado na mesa durante o movimento.", img: "Lying_Leg_Curls" },
  "Cadeira Abdutora": { cat: "Glúteo", prim: "Glúteo", sec: [], tip: "Incline o tronco levemente à frente para focar no glúteo máximo.", img: "Thigh_Abductor" },
  "Cadeira Adutora": { cat: "Inferiores", prim: "Adutores", sec: [], tip: "Aperte bem no final do movimento.", img: "Thigh_Adductor" },
  "Panturrilha Sentado": { cat: "Inferiores", prim: "Panturrilha", sec: [], tip: "Alongue tudo embaixo e pause 1s no topo.", img: "Seated_Calf_Raise" },
  "Supino Máquina": { cat: "Peito / Empurrar", prim: "Peito", sec: ["Ombro Anterior", "Tríceps"], tip: "Mantenha o peito estufado e os ombros firmes para trás.", img: "Leverage_Chest_Press" },
  "Crucifixo Reto Articulado": { cat: "Peito / Empurrar", prim: "Peito", sec: [], tip: "Sinta o peito alongar ao máximo sem dobrar muito os cotovelos.", img: "Butterfly" },
  "Puxada Alta Aberta Frente": { cat: "Costas / Puxar", prim: "Costas", sec: ["Bíceps"], tip: "Não mexa as escápulas durante a puxada! Puxe com os cotovelos até a frente do peito.", img: "Wide-Grip_Lat_Pulldown" },
  "Remada Baixa com Triângulo": { cat: "Costas / Puxar", prim: "Costas", sec: ["Bíceps"], tip: "Tronco levemente inclinado, puxe no umbigo.", img: "Seated_Cable_Rows", equipImg: "./equipamentos/triangulo.png" },
  "Elevação Lateral (Máquina/Polia)": { cat: "Ombro / Empurrar", prim: "Ombro Lateral", sec: [], tip: "Empurre o peso para os lados, não para cima.", img: "Side_Lateral_Raise" },
  "Desenvolvimento Articulado Aberto": { cat: "Ombro / Empurrar", prim: "Ombro Anterior", sec: ["Tríceps"], tip: "Não estique totalmente os cotovelos no topo para manter a tensão.", img: "Standing_Military_Press" },
  "Rosca Bíceps (Máquina/Polia Baixa)": { cat: "Braços", prim: "Bíceps", sec: [], tip: "Cotovelos fixos, evite balançar o tronco para ajudar o movimento.", img: "Standing_Biceps_Cable_Curl" },
  "Tríceps Pulley Barra Reta": { cat: "Braços", prim: "Tríceps", sec: [], tip: "Mantenha os cotovelos colados ao tronco.", img: "Triceps_Pushdown", equipImg: "./equipamentos/barra-reta.png" },
  "Abdominal Máquina": { cat: "Core", prim: "Abdômen", sec: [], tip: "Enrole o tronco, não dobre apenas o quadril.", img: "Ab_Crunch_Machine" }
};

export const workoutData = {
  "Treino A": { group: "lower", exercises: ["Agachamento Hack", "Leg Press Horizontal Articulado", "Cadeira Extensora", "Cadeira Flexora", "Mesa Flexora", "Cadeira Abdutora", "Cadeira Adutora", "Panturrilha Sentado"] },
  "Treino B": { group: "upper", exercises: ["Supino Máquina", "Crucifixo Reto Articulado", "Puxada Alta Aberta Frente", "Remada Baixa com Triângulo", "Elevação Lateral (Máquina/Polia)", "Desenvolvimento Articulado Aberto", "Rosca Bíceps (Máquina/Polia Baixa)", "Tríceps Pulley Barra Reta", "Abdominal Máquina"] }
};

export const SETS_PER_EXERCISE = 3;
export const days = Object.keys(workoutData);