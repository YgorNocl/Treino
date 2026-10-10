// Cronômetro de descanso entre séries — um só para academia, calistenia e
// mobilidade (antes cada modo tinha o seu painel, e os dois podiam aparecer
// empilhados ao trocar de modo). Contagem regressiva, anel de progresso e o
// alerta de fim de descanso (som + vibração + notificação do sistema).

const restOverlay = document.getElementById('restOverlay');
const restTimeEl = document.getElementById('restTime');
const restProgressEl = document.getElementById('restProgress');
const restTagEl = restOverlay.querySelector('.rest-tag');

let lastBaseSeconds = 90;   // último tempo escolhido (vale quando o exercício não tem um salvo)
let totalSeconds = 90;      // total do descanso atual, para o anel (+15s aumenta)
let restEndTimestamp = null;
let restInterval = null;
let restEndAlertFired = false;
let restAudioCtx = null;
let current = { key: null, onPreset: null };

// Cria (ou acorda) o AudioContext dentro do gesto de clique que inicia o
// descanso, pra já ficar liberado pra tocar sozinho quando o tempo acabar.
function ensureRestAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!restAudioCtx) restAudioCtx = new Ctx();
  if (restAudioCtx.state === 'suspended') restAudioCtx.resume();
  return restAudioCtx;
}

// Toca um "bip" curto e suave (dois tons ascendentes) sem precisar de arquivo de áudio.
function playRestEndChime() {
  const ctx = ensureRestAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [[880, now], [1174.66, now + 0.16]].forEach(([freq, start]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  });
}

// Pede permissão de notificação uma única vez (se o usuário negar, não insiste).
function maybeRequestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (localStorage.getItem('notifPermRequested') === '1') return;
  if (Notification.permission === 'default') {
    localStorage.setItem('notifPermRequested', '1');
    Notification.requestPermission();
  }
}

// Notificação do sistema — funciona mesmo com o app em outra aba/tela
// (dentro dos limites que o navegador permite pra páginas em segundo plano).
function fireRestEndNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const title = '⏱️ Descanso finalizado';
  const options = { body: 'Hora de voltar pro treino!', icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', vibrate: [200, 100, 200], tag: 'rest-timer', renotify: true };
  // Só usa o Service Worker se ele já estiver ativo controlando a página — caso
  // contrário a promise "ready" pode nunca resolver (ex.: registro ainda pendente/falhou).
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(() => { try { new Notification(title, options); } catch (e) {} });
  } else {
    try { new Notification(title, options); } catch (e) {}
  }
}

function alertRestEnd() {
  playRestEndChime();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (document.hidden) fireRestEndNotification();
}

function remainingSeconds() {
  return Math.max(0, Math.round((restEndTimestamp - Date.now()) / 1000));
}

function updateRestDisplay() {
  const remaining = remainingSeconds();
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  restTimeEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  restProgressEl.style.setProperty('--p', Math.max(0, Math.min(remaining / totalSeconds, 1)));
}

function finishRest() {
  clearInterval(restInterval);
  restInterval = null;
  restOverlay.classList.remove('visible');
  if (restEndAlertFired) return;
  restEndAlertFired = true;
  alertRestEnd();
}

function tick() {
  if (remainingSeconds() <= 0) {
    restTimeEl.textContent = '0:00';
    restProgressEl.style.setProperty('--p', 0);
    finishRest();
    return;
  }
  updateRestDisplay();
}

function run(seconds) {
  lastBaseSeconds = seconds;
  totalSeconds = seconds;
  restEndTimestamp = Date.now() + seconds * 1000;
  restEndAlertFired = false;
  ensureRestAudioContext();
  maybeRequestNotificationPermission();
  restOverlay.classList.add('visible');
  restOverlay.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.time) === seconds);
  });
  updateRestDisplay();
  clearInterval(restInterval);
  restInterval = setInterval(tick, 250);
}

// Outros cronômetros (regressivo da mobilidade) usam o mesmo bipe: primeAlert()
// no toque que inicia (libera o som), alertTimerEnd() quando acaba.
export function primeAlert() {
  ensureRestAudioContext();
}

export function alertTimerEnd() {
  playRestEndChime();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// Inicia um descanso. O tempo escolhido nos atalhos (1m, 1.5m…) fica salvo em
// `key` (por exercício); sem valor salvo, usa `fallback` ou o último tempo usado.
// onPreset(segundos): chamado quando um atalho é escolhido (ex.: padrão do modo).
export function startRest({ key = null, label = '', fallback = 0, onPreset = null } = {}) {
  current = { key, onPreset };
  restTagEl.textContent = label ? `Descanso · ${label}` : 'Descanso';
  const saved = key ? Number(localStorage.getItem(key)) : 0;
  run(saved > 0 ? saved : fallback > 0 ? fallback : lastBaseSeconds);
}

// Descanso de um exercício da academia.
export function startRestFor(exercise) {
  startRest({ key: `rest:ex:${exercise}`, label: exercise });
}

export function closeRestOverlay() {
  clearInterval(restInterval);
  restInterval = null;
  restOverlay.classList.remove('visible');
}

export function initRestTimer() {
  document.getElementById('restSkip').addEventListener('click', closeRestOverlay);
  document.getElementById('restPlus15').addEventListener('click', () => {
    restEndTimestamp += 15000;
    totalSeconds += 15;
    updateRestDisplay();
  });
  document.getElementById('restMinus15').addEventListener('click', () => {
    restEndTimestamp = Math.max(Date.now(), restEndTimestamp - 15000);
    tick();
  });
  restOverlay.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const seconds = Number(btn.dataset.time);
      if (current.key) localStorage.setItem(current.key, String(seconds));
      if (current.onPreset) current.onPreset(seconds);
      run(seconds);
    });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRestOverlay(); });
  // De volta ao app depois do fim do descanso: fecha e avisa na hora, em vez de
  // esperar o próximo "tick" (que o navegador atrasa em segundo plano).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && restInterval) tick();
  });
}
