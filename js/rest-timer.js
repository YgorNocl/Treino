// Cronômetro de descanso entre séries: contagem regressiva, barra de progresso e o
// alerta de fim de descanso (som + vibração + notificação do sistema).

const restOverlay = document.getElementById('restOverlay');
const restTimeEl = document.getElementById('restTime');
const restProgressEl = document.getElementById('restProgress');

let restSecondsCurrent = 90;
let restInterval = null;
let restRemaining = restSecondsCurrent;
let restEndTimestamp = null;
let restEndAlertFired = false;
let restAudioCtx = null;

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

// Chamado dentro do clique que inicia um descanso (academia ou calistenia),
// pra liberar o áudio e pedir permissão de notificação.
export function primeRestAlert() {
  ensureRestAudioContext();
  maybeRequestNotificationPermission();
}

export function alertRestEnd() {
  playRestEndChime();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  if (document.hidden) fireRestEndNotification();
}

function handleRestEnd() {
  if (restEndAlertFired) return;
  restEndAlertFired = true;
  alertRestEnd();
}

export function startRest(seconds) {
  restSecondsCurrent = seconds;
  restRemaining = seconds;
  restEndTimestamp = Date.now() + seconds * 1000;
  restEndAlertFired = false;
  primeRestAlert();
  restOverlay.classList.add('visible');
  updateRestDisplay();
  clearInterval(restInterval);
  document.querySelectorAll('.preset-btn').forEach(btn => { btn.classList.toggle('active', parseInt(btn.dataset.time, 10) === seconds); });
  restInterval = setInterval(() => {
    const remaining = Math.max(0, Math.round((restEndTimestamp - Date.now()) / 1000));
    if (remaining <= 0) {
      clearInterval(restInterval);
      restRemaining = 0;
      updateRestDisplay();
      restOverlay.classList.remove('visible');
      handleRestEnd();
      return;
    }
    restRemaining = remaining;
    updateRestDisplay();
  }, 250);
}

// Descanso por exercício: o tempo escolhido nos atalhos (1m, 1.5m…) fica salvo
// para aquele exercício; sem escolha salva, usa o último tempo usado.
const REST_EXERCISE_PREFIX = 'rest:ex:';
let restExercise = null;
const restTagEl = restOverlay.querySelector('.rest-tag');

export function startRestFor(exercise) {
  restExercise = exercise;
  const saved = Number(localStorage.getItem(REST_EXERCISE_PREFIX + exercise));
  restTagEl.textContent = `Descanso · ${exercise}`;
  startRest(saved > 0 ? saved : restSecondsCurrent);
}

export function closeRestOverlay() {
  clearInterval(restInterval);
  restOverlay.classList.remove('visible');
}

function updateRestDisplay() {
  const m = Math.floor(restRemaining / 60);
  const s = restRemaining % 60;
  restTimeEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  restProgressEl.style.setProperty('--p', Math.max(0, Math.min(restRemaining / restSecondsCurrent, 1)));
}

export function initRestTimer() {
  document.getElementById('restSkip').addEventListener('click', closeRestOverlay);
  document.getElementById('restPlus15').addEventListener('click', () => {
    restEndTimestamp += 15000;
    restSecondsCurrent += 15;
    restRemaining = Math.max(0, Math.round((restEndTimestamp - Date.now()) / 1000));
    updateRestDisplay();
  });
  document.getElementById('restMinus15').addEventListener('click', () => {
    restEndTimestamp = Math.max(Date.now(), restEndTimestamp - 15000);
    restRemaining = Math.max(0, Math.round((restEndTimestamp - Date.now()) / 1000));
    updateRestDisplay();
  });
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const seconds = parseInt(btn.dataset.time, 10);
      if (restExercise) localStorage.setItem(REST_EXERCISE_PREFIX + restExercise, String(seconds));
      startRest(seconds);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && restEndTimestamp && restOverlay.classList.contains('visible')) {
      restRemaining = Math.max(0, Math.round((restEndTimestamp - Date.now()) / 1000));
      updateRestDisplay();
      if (restRemaining <= 0) {
        clearInterval(restInterval);
        restOverlay.classList.remove('visible');
        handleRestEnd();
      }
    }
  });
}
