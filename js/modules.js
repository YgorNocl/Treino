// Partes opcionais do app, ligadas em Configurações › Módulos:
//   cali  Calistenia (programa de progressões)
//   mobi  Mobilidade (2 treinos prontos com cronômetro)
//   run   Corrida (botão ao lado dos treinos)
// Quem já usava o app (versão 2.x) começa com tudo ligado, como estava; uma
// instalação nova começa com tudo desligado. Ligar/desligar não apaga dados.
import { hasLegacyData } from './data.js';

const KEYS = { cali: 'mod:cali', mobi: 'mod:mobi', run: 'mod:run' };
export const MODULES = [
  { id: 'cali', name: 'Calistenia', desc: 'Progressões de flexão, core, L-Sit e Elbow Lever, com cronômetro de sustentação.' },
  { id: 'mobi', name: 'Mobilidade', desc: 'Dois treinos curtos de mobilidade (superior e inferior), com contagem regressiva.' },
  { id: 'run', name: 'Corrida', desc: 'Registro de corridas (distância, tempo correndo e andando, ritmo) ao lado dos treinos.' }
];

export function moduleOn(id) { return localStorage.getItem(KEYS[id]) === '1'; }

export function setModule(id, on) {
  localStorage.setItem(KEYS[id], on ? '1' : '0');
  document.dispatchEvent(new CustomEvent('treino:modules', { detail: { id, on } }));
}

(function initModules() {
  if (localStorage.getItem(KEYS.cali) !== null) return;
  let legacy = hasLegacyData();
  for (let i = 0; i < localStorage.length && !legacy; i++) {
    const key = localStorage.key(i);
    legacy = key.startsWith('cali:log:') || key === 'run:log';
  }
  Object.values(KEYS).forEach(key => localStorage.setItem(key, legacy ? '1' : '0'));
})();
