import {
  MODE_SKILLS,
  fmtShort,
  fmtValue,
  fmtSeconds,
  fmtClock,
  fmtStopwatch,
  escapeHtml,
  CALI_SKILL_MAP
} from './calisthenics-data.js';
import * as store from './calisthenics-store.js';
import { initPanels, openCalendar, openProgress, openGuide, openDay, closePanels, sessionRowHtml } from './calisthenics-panels.js';
import { todayString, parseNum } from './utils.js';
import { primeRestAlert, alertRestEnd } from './rest-timer.js';
import { openSetEditor } from './set-editor.js';
import { confirmDialog } from './dialog.js';
import { showSummaryModal, longDateLabel, shareOrDownload } from './summary.js';
import { buildSummaryImage } from './share-card.js';
import { regionLevels } from './body-map.js';

const $ = id => document.getElementById(id);
const root = $('caliRoot');

const MODE_META = {
  cali: { title: 'Calistenia', subtitleEl: 'caliSubtitle', bodyClass: 'mode-cali' },
  mobi: { title: 'Mobilidade', subtitleEl: 'mobiSubtitle', bodyClass: 'mode-mobi' }
};

const state = {
  mode: 'cali',
  skillId: null,
  openStepId: null,
  today: null
};

// Skill selecionada nos botões do topo, lembrada por modo (como Superior/Inferior na academia).
const SKILL_KEY_PREFIX = 'cali:skill:';

function selectedSkill() {
  const skills = skillsOfMode();
  return skills.find(s => s.id === state.skillId) || skills[0];
}

function restoreSkill() {
  const stored = localStorage.getItem(SKILL_KEY_PREFIX + state.mode);
  state.skillId = skillsOfMode().some(s => s.id === stored) ? stored : skillsOfMode()[0].id;
}

function skillPillLabel(skill) {
  return skill.short || skill.name;
}

const timer = { stepId: null, phase: null, startedAt: 0, prepEndsAt: 0, handle: null, wakeLock: null };
const rest = { endsAt: 0, total: 0, remaining: 0, handle: null, stepId: null };
let clockHandle = null;

const ICONS = {
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  clock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>',
  trend: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
  repeat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>'
};

const PREP_LABELS = { 0: '0s', 5: '5s', 10: '10s' };

function toast(title, text) {
  if (typeof window.showToast === 'function') window.showToast(title, text);
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function currentBodyMode() {
  if (document.body.classList.contains('mode-cali')) return 'cali';
  if (document.body.classList.contains('mode-mobi')) return 'mobi';
  return 'gym';
}

function skillsOfMode() {
  return MODE_SKILLS[state.mode] || [];
}

function applyMode(mode, persist) {
  document.body.classList.toggle('mode-cali', mode === 'cali');
  document.body.classList.toggle('mode-mobi', mode === 'mobi');
  document.querySelectorAll('#modeSwitch .mode-btn').forEach(btn => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  if (persist) store.setMode(mode);
  if (mode === 'cali' || mode === 'mobi') {
    state.mode = mode;
    restoreSkill();
    state.openStepId = null;
    render();
    startClock();
  } else {
    cancelTimer();
    hideRest();
    stopClock();
    closePanels();
  }
  if (persist) window.scrollTo(0, 0);
}

function updateHeader(index) {
  const meta = MODE_META[state.mode];
  if (!meta) return;
  const count = store.getWeekSessionCount(index);
  $(meta.subtitleEl).innerText = `${count} ${count === 1 ? 'treino' : 'treinos'} nesta semana`;
}

function render() {
  cancelTimer();
  const index = store.buildDayIndex(state.mode);
  renderMain(index);
  updateHeader(index);
}

// Séries feitas / previstas hoje no treino selecionado (ex.: Flexões), como a
// barra "Séries de hoje" da academia.
function skillProgress(skill) {
  const today = todayString();
  let done = 0;
  let total = 0;
  skill.steps.forEach(step => {
    total += step.goal.sets;
    done += Math.min(store.setsOn(step.id, today).length, step.goal.sets);
  });
  return { done, total };
}

function todayCardHtml(today) {
  const sets = today ? today.sets : 0;
  const finished = store.isDayFinished(state.mode, todayString());
  const { done, total } = skillProgress(selectedSkill());
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const stats = sets > 0
    ? `<div class="cali-today-stats">
        ${today.reps > 0 ? `<span><b>${today.reps}</b>reps</span>` : ''}
        ${today.holdSeconds > 0 ? `<span><b>${fmtSeconds(today.holdSeconds)}</b>sob tensão</span>` : ''}
        <span><b>${today.stepIds.size}</b>${today.stepIds.size === 1 ? 'exercício' : 'exercícios'}</span>
        <button type="button" class="cali-link-btn" id="caliTodaySummary">Resumo</button>
      </div>`
    : '';
  return `
    <section class="session-bar cali-session">
      <div class="session-info">
        <div class="session-info-left">
          <span class="session-label">SÉRIES DE HOJE</span>
          <span class="session-count">${done}<span class="session-total">/${total}</span></span>
        </div>
        <div class="workout-timer" id="caliClock">${clockText(today, finished)}</div>
      </div>
      <div class="session-track"><div class="session-fill" style="width: ${pct}%"></div></div>
      ${stats}
    </section>`;
}

function finishButtonHtml(finished, sets) {
  return finished
    ? `<button type="button" class="save-btn finished cali-finish-btn" disabled>Treino Finalizado ✓</button>`
    : `<button type="button" class="save-btn cali-finish-btn" id="caliFinishBtn" ${sets > 0 ? '' : 'disabled'}>Finalizar Treino Atual</button>`;
}

function clockText(today, finished) {
  if (!today || !today.first) return '00:00';
  const live = !finished && Date.now() - today.last < 45 * 60 * 1000;
  const end = live ? Date.now() : today.last;
  return fmtClock((end - today.first) / 1000);
}

function skillPillsHtml() {
  const doneToday = new Set(state.today ? state.today.stepIds : []);
  return `
    <nav class="selectors scroll" id="caliSkillPills" aria-label="Escolher treino">
      ${skillsOfMode().map(skill => {
        const trainedToday = skill.steps.some(step => doneToday.has(step.id));
        return `<button type="button" class="tab-btn ${skill.id === state.skillId ? 'active' : ''} ${trainedToday ? 'completed' : ''}" data-skill="${skill.id}">${skillPillLabel(skill)}</button>`;
      }).join('')}
    </nav>`;
}

// Mesmo layout da academia: treinos no topo, resumo do dia e os exercícios embaixo.
function renderMain(index) {
  state.today = index.get(todayString()) || null;
  const skill = selectedSkill();
  root.innerHTML = `
    ${skillPillsHtml()}
    <div id="caliSummary">${todayCardHtml(state.today)}</div>
    <div class="cali-steps">${skill.steps.map(stepCardHtml).join('')}</div>
    <div class="cali-finish-wrap" id="caliFinishWrap"></div>`;

  root.querySelectorAll('#caliSkillPills .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => selectSkill(btn.dataset.skill));
  });
  const activePill = root.querySelector('#caliSkillPills .tab-btn.active');
  if (activePill) activePill.scrollIntoView({ block: 'nearest', inline: 'center' });
  skill.steps.forEach(bindStepCard);
  bindSummary();
}

function bindSummary() {
  const summaryBtn = $('caliTodaySummary');
  if (summaryBtn) summaryBtn.addEventListener('click', () => openDay(state.mode, todayString()));
  const sets = state.today ? state.today.sets : 0;
  $('caliFinishWrap').innerHTML = finishButtonHtml(store.isDayFinished(state.mode, todayString()), sets);
  const finishBtn = $('caliFinishBtn');
  if (finishBtn) finishBtn.addEventListener('click', async () => {
    const skill = selectedSkill();
    const { done, total } = skillProgress(skill);
    // Igual à academia: confirma quando ainda faltam séries no treino aberto.
    if (done < total && !(await confirmDialog({
      title: 'Finalizar treino?',
      text: `Ainda ${total - done === 1 ? 'falta 1 série' : `faltam ${total - done} séries`} de ${skill.name}.`,
      confirmLabel: 'Finalizar mesmo assim'
    }))) return;
    store.finishDay(state.mode, todayString());
    vibrate([120, 60, 120]);
    render();
    showFinishSummary();
  });
}

// Resumo ao finalizar, igual ao da academia (com a imagem do treino).
function showFinishSummary() {
  const mode = state.mode;
  const date = todayString();
  const day = store.buildDayIndex(mode).get(date);
  const items = store.getDayDetail(mode, date);
  if (!day || items.length === 0) return;
  const isMobi = mode === 'mobi';
  const duration = day.last - day.first >= 60000 ? fmtSeconds((day.last - day.first) / 1000) : '< 1 min';
  const prs = isMobi ? [] : items.filter(item => item.isPR).map(item => ({ name: item.step.name, value: fmtValue(item.step, item.best) }));
  showSummaryModal({
    stats: [
      { value: day.sets, label: 'Séries' },
      { value: duration, label: 'Duração' },
      isMobi ? { value: items.length, label: 'Exercícios' } : { value: prs.length, label: 'PRs' }
    ],
    prs,
    onShare: () => shareFinishImage(mode, date, day, items, duration)
  });
}

async function shareFinishImage(mode, date, day, items, duration) {
  const isMobi = mode === 'mobi';
  const skills = [...new Set(items.map(item => item.step.skillId))].map(id => CALI_SKILL_MAP[id]).filter(s => s && s.muscles);
  const levelByName = {};
  skills.forEach(s => s.muscles.sec.forEach(m => { levelByName[m] = 'secondary'; }));
  skills.forEach(s => s.muscles.prim.forEach(m => { levelByName[m] = 'primary'; }));
  const third = isMobi
    ? { value: String(items.length), label: 'Exercícios' }
    : day.reps > 0 ? { value: String(day.reps), label: 'Reps' } : { value: fmtSeconds(day.holdSeconds), label: 'Sob tensão' };
  const blob = await buildSummaryImage({
    title: MODE_META[mode].title,
    dateLabel: longDateLabel(date),
    stats: [{ value: duration, label: 'Duração' }, { value: String(day.sets), label: 'Séries' }, third],
    exercises: items.map(item => ({ name: item.step.name, best: fmtValue(item.step, item.best), pr: !isMobi && item.isPR })),
    levels: regionLevels(levelByName)
  });
  await shareOrDownload(blob, `${isMobi ? 'mobilidade' : 'calistenia'}-${date}.png`, `Treino de ${MODE_META[mode].title}`);
}

// Atualiza só o resumo do dia, o botão de finalizar e os botões do topo, sem
// redesenhar os cards (mantém o card aberto e o que foi digitado).
function refreshSummary() {
  const index = store.buildDayIndex(state.mode);
  state.today = index.get(todayString()) || null;
  $('caliSummary').innerHTML = todayCardHtml(state.today);
  const pills = $('caliSkillPills');
  const scrollLeft = pills.scrollLeft;
  pills.outerHTML = skillPillsHtml();
  $('caliSkillPills').scrollLeft = scrollLeft;
  root.querySelectorAll('#caliSkillPills .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => selectSkill(btn.dataset.skill));
  });
  bindSummary();
  updateHeader(index);
}

function selectSkill(skillId) {
  if (skillId === state.skillId) return;
  state.skillId = skillId;
  state.openStepId = null;
  localStorage.setItem(SKILL_KEY_PREFIX + state.mode, skillId);
  render();
}

function chipGroupHtml(pref, options, labels, active) {
  return options
    .map(v => `<button type="button" class="cali-pill ${v === active ? 'active' : ''}" data-pref="${pref}" data-value="${v}">${labels[v]}</button>`)
    .join('');
}

function setTrackerHtml(step, todaySets, label) {
  const count = Math.max(step.goal.sets, todaySets.length);
  const dots = Array.from({ length: count }, (_, i) => {
    const set = todaySets[i];
    if (!set) return `<span class="set-dot">${i + 1}</span>`;
    return `<button type="button" class="set-dot filled" data-edit="${set.t}" data-index="${i}" aria-label="Editar série ${i + 1}">${label(set)}</button>`;
  }).join('');
  return `<div class="set-tracker" id="caliDots-${step.id}">${dots}</div>`;
}

function mobilityBodyHtml(step, todaySets) {
  const doneToday = todaySets.length >= step.goal.sets;
  const isTime = step.mode === 'time';
  const value = isTime ? fmtSeconds(step.goal.value) : String(step.goal.value);
  const unit = isTime ? 'de sustentação' : step.goal.value === 1 ? 'repetição' : 'repetições';
  const icon = isTime ? ICONS.clock : ICONS.repeat;
  return `
    ${step.goal.sets > 1 ? setTrackerHtml(step, todaySets, () => '✓') : ''}
    <div class="cali-mobility-target ${doneToday ? 'done' : ''}">
      <span class="cali-mobility-icon">${icon}</span>
      <div class="cali-mobility-info">
        <span class="cali-mobility-value">${value}</span>
        <span class="cali-mobility-sub">${unit}${step.goal.sets > 1 ? ' por série' : ''}</span>
      </div>
      ${doneToday ? `<span class="cali-mobility-check" aria-label="Feito hoje">${ICONS.check}</span>` : ''}
    </div>
    <button type="button" class="save-btn cali-mobility-btn" id="caliMobilityBtn-${step.id}">${step.goal.sets > 1 ? 'Registrar série' : doneToday ? 'Fazer de novo' : 'Concluir exercício'}</button>`;
}

function stepBodyHtml(step, todaySets) {
  if (step.area === 'mobilidade') return mobilityBodyHtml(step, todaySets);
  const isTime = step.mode === 'time';
  const lastToday = todaySets.length ? todaySets[todaySets.length - 1] : null;
  const noteValue = lastToday ? lastToday.n : '';
  const prefill = lastToday ? lastToday.v : '';

  const timerHtml = isTime
    ? `
      <div class="cali-timer" data-phase="idle" id="caliTimer-${step.id}">
        <div class="cali-timer-display" id="caliTimerDisplay-${step.id}">0.0</div>
        <button type="button" class="cali-timer-btn" id="caliTimerBtn-${step.id}">Iniciar cronômetro</button>
      </div>`
    : '';

  const sessions = store.sessionsOf(step.id);
  const previous = sessions.filter(s => s.date < todayString());
  const historyRows = previous
    .slice(-3)
    .map(session => sessionRowHtml(step, session, previous[previous.indexOf(session) - 1] || null))
    .reverse()
    .join('');
  const historyHtml = previous.length
    ? `<div class="cali-history">
        <div class="cali-history-head"><span class="cali-section-title flush">Sessões anteriores</span></div>
        <div class="evo-session-list">${historyRows}</div>
      </div>`
    : '';

  return `
    ${setTrackerHtml(step, todaySets, set => fmtShort(step, set.v))}
    ${timerHtml}
    <div class="input-row">
      <div class="input-group">
        <label for="caliValue-${step.id}">${isTime ? 'Tempo (segundos)' : 'Repetições'}</label>
        <input type="number" inputmode="numeric" min="1" id="caliValue-${step.id}" value="${prefill}" placeholder="${step.goal.value}">
      </div>
    </div>
    <div class="card-actions">
      <button type="button" class="save-btn" id="caliSave-${step.id}">Registrar série</button>
      <button type="button" class="rest-btn-trigger" id="caliRestBtn-${step.id}" aria-label="Iniciar descanso">${ICONS.clock}</button>
    </div>
    <button type="button" class="add-notes-btn" style="display: ${noteValue ? 'none' : 'flex'};" id="caliNoteToggle-${step.id}">${ICONS.plus} Adicionar observação</button>
    <div class="notes-row ${noteValue ? 'visible' : ''}" id="caliNoteRow-${step.id}">
      <input type="text" maxlength="80" id="caliNote-${step.id}" class="notes-input" placeholder="Ex: elástico azul, pernas abertas..." value="${escapeHtml(noteValue)}">
    </div>
    ${isTime ? `<div class="cali-prefs"><div class="cali-pref"><span>Preparo do cronômetro</span><div class="cali-pills">${chipGroupHtml('prep', store.PREP_OPTIONS, PREP_LABELS, store.getPrepSeconds(state.mode))}</div></div></div>` : ''}
    ${historyHtml}`;
}

// Mesmo card dos exercícios da academia (classes compartilhadas), com o corpo
// próprio da calistenia (cronômetro de sustentação, observação, histórico).
function stepCardHtml(step) {
  const todaySets = store.setsOn(step.id, todayString());
  const isOpen = state.openStepId === step.id;
  const isMobility = step.area === 'mobilidade';
  const isDone = todaySets.length >= step.goal.sets;
  const best = store.getBest(step.id);
  const prBadge = best && !isMobility
    ? `<span class="pr-badge" role="button" tabindex="0" data-evo="${step.id}">PR: ${fmtShort(step, best)}</span>`
    : '';
  const progText = `${todaySets.length}/${step.goal.sets} séries concluídas`;
  const trendIcon = best
    ? `<button type="button" class="info-icon" data-evo="${step.id}" aria-label="Ver evolução">${ICONS.trend}</button>`
    : '';
  return `
    <div class="exercise-card ${isDone ? 'done' : ''} ${isOpen ? 'expanded' : ''}" data-step-id="${step.id}">
      <div class="exercise-header" role="button" tabindex="0" aria-expanded="${isOpen}">
        <div class="exercise-info">
          <div class="exercise-title-row">
            <span class="exercise-title">${step.name}</span>
            <div class="exercise-title-actions">
              ${trendIcon}
              <button type="button" class="info-icon" data-guide="${step.id}" aria-label="Como fazer o exercício">?</button>
            </div>
          </div>
          <span class="exercise-prog"><span>${progText}</span>${prBadge}</span>
        </div>
        <svg class="exercise-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="exercise-wrapper">
        <div class="exercise-body">
          <div class="exercise-inner">${stepBodyHtml(step, todaySets)}</div>
        </div>
      </div>
    </div>`;
}

function updateStepCard(step) {
  const card = root.querySelector(`[data-step-id="${step.id}"]`);
  if (!card) {
    render();
    return;
  }
  const holder = document.createElement('div');
  holder.innerHTML = stepCardHtml(step).trim();
  card.replaceWith(holder.firstElementChild);
  bindStepCard(step);
  refreshSummary();
}

function toggleStep(stepId) {
  state.openStepId = state.openStepId === stepId ? null : stepId;
  root.querySelectorAll('.exercise-card[data-step-id]').forEach(card => {
    const open = card.dataset.stepId === state.openStepId;
    card.classList.toggle('expanded', open);
    card.querySelector('.exercise-header').setAttribute('aria-expanded', String(open));
  });
}

function bindStepCard(step) {
  const card = root.querySelector(`[data-step-id="${step.id}"]`);
  if (!card) return;
  const head = card.querySelector('.exercise-header');
  head.addEventListener('click', () => toggleStep(step.id));
  head.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleStep(step.id);
    }
  });

  card.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => editSet(step, Number(btn.dataset.edit), Number(btn.dataset.index)));
  });

  if (step.area === 'mobilidade') {
    const mobilityBtn = $(`caliMobilityBtn-${step.id}`);
    if (mobilityBtn) mobilityBtn.addEventListener('click', () => registerMobility(step));
  } else {
    const input = $(`caliValue-${step.id}`);

    const noteToggle = $(`caliNoteToggle-${step.id}`);
    if (noteToggle) {
      noteToggle.addEventListener('click', () => {
        $(`caliNoteRow-${step.id}`).classList.add('visible');
        noteToggle.style.display = 'none';
        $(`caliNote-${step.id}`).focus();
      });
    }

    $(`caliSave-${step.id}`).addEventListener('click', () => registerSet(step));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') registerSet(step);
    });
    $(`caliRestBtn-${step.id}`).addEventListener('click', () => startRestFor(step));

    const timerBtn = $(`caliTimerBtn-${step.id}`);
    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        if (timer.stepId === step.id && timer.phase === 'run') stopTimer(step);
        else if (timer.stepId === step.id && timer.phase === 'prep') {
          cancelTimer();
          paintIdleAll();
        } else startTimer(step);
      });
    }

    card.querySelectorAll('.cali-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const value = Number(pill.dataset.value);
        if (pill.dataset.pref === 'rest') store.setRestSeconds(state.mode, value);
        else store.setPrepSeconds(state.mode, value);
        root.querySelectorAll(`.cali-pill[data-pref="${pill.dataset.pref}"]`).forEach(p => {
          p.classList.toggle('active', Number(p.dataset.value) === value);
        });
      });
    });
  }

  card.querySelectorAll('[data-guide]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openGuide(btn.dataset.guide);
    });
  });
  card.querySelectorAll('[data-evo]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openProgress(state.mode, btn.dataset.evo);
    });
  });
}

function popLastSetDot(step) {
  const dots = root.querySelectorAll(`[data-step-id="${step.id}"] .set-dot.filled`);
  if (dots.length) dots[dots.length - 1].classList.add('pop');
}

function registerMobility(step) {
  cancelTimer();
  store.addSet(step.id, step.goal.value, '');
  vibrate(80);
  state.openStepId = step.id;
  updateStepCard(step);
  popLastSetDot(step);
}

function registerSet(step) {
  const input = $(`caliValue-${step.id}`);
  const value = Math.round(parseNum(input.value));
  const max = step.mode === 'time' ? 3600 : 500;
  if (!(value >= 1 && value <= max)) {
    input.focus();
    toast('Valor inválido', step.mode === 'time' ? 'Informe o tempo em segundos.' : 'Informe o número de repetições.');
    return;
  }
  cancelTimer();
  const noteInput = $(`caliNote-${step.id}`);
  const note = noteInput ? noteInput.value.trim().slice(0, 80) : '';
  const previousBest = store.getBest(step.id);
  store.addSet(step.id, value, note);
  if (previousBest > 0 && value > previousBest) {
    toast('🏆 Novo recorde!', `${fmtValue(step, value)} supera seu melhor anterior (${fmtValue(step, previousBest)}).`);
  }
  vibrate(60);
  state.openStepId = step.id;
  updateStepCard(step);
  popLastSetDot(step);
  // Igual à academia: registrou uma série que não é a última, o descanso já começa.
  if (store.setsOn(step.id, todayString()).length < step.goal.sets) startRestFor(step);
}

// Mesmo editor da academia: tocar numa série feita permite corrigir o valor ou apagar.
function editSet(step, t, index) {
  const set = store.setsOn(step.id, todayString()).find(s => s.t === t);
  if (!set) return;
  const isTime = step.mode === 'time';
  const max = isTime ? 3600 : 500;
  openSetEditor({
    title: `Série ${index + 1}`,
    subtitle: step.name,
    fields: [{ key: 'v', label: isTime ? 'Tempo (segundos)' : 'Repetições', value: set.v, inputmode: 'numeric' }],
    onSave: ({ v }) => {
      const value = Math.round(parseNum(v));
      if (!(value >= 1 && value <= max)) return false;
      store.updateSet(step.id, t, value);
      state.openStepId = step.id;
      updateStepCard(step);
    },
    onDelete: () => {
      store.removeSet(step.id, t);
      state.openStepId = step.id;
      updateStepCard(step);
    }
  });
}

function paintIdleAll() {
  root.querySelectorAll('.cali-timer').forEach(box => {
    box.dataset.phase = 'idle';
    box.querySelector('.cali-timer-display').textContent = '0.0';
    box.querySelector('.cali-timer-btn').textContent = 'Iniciar cronômetro';
  });
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (timer.stepId) timer.wakeLock = lock;
    else lock.release().catch(() => {});
  } catch (e) {
    timer.wakeLock = null;
  }
}

function releaseWakeLock() {
  if (!timer.wakeLock) return;
  timer.wakeLock.release().catch(() => {});
  timer.wakeLock = null;
}

function cancelTimer() {
  if (timer.handle) clearInterval(timer.handle);
  timer.handle = null;
  timer.phase = null;
  timer.stepId = null;
  releaseWakeLock();
}

function tickTimer() {
  if (!timer.stepId) return;
  const box = $(`caliTimer-${timer.stepId}`);
  const display = $(`caliTimerDisplay-${timer.stepId}`);
  const button = $(`caliTimerBtn-${timer.stepId}`);
  if (!box || !display || !button) return;
  const now = Date.now();
  if (timer.phase === 'prep') {
    const left = Math.ceil((timer.prepEndsAt - now) / 1000);
    if (left > 0) {
      box.dataset.phase = 'prep';
      display.textContent = String(left);
      button.textContent = 'Cancelar';
      return;
    }
    timer.phase = 'run';
    timer.startedAt = timer.prepEndsAt;
    vibrate(200);
  }
  box.dataset.phase = 'run';
  display.textContent = fmtStopwatch((now - timer.startedAt) / 1000);
  button.textContent = 'Parar e usar o tempo';
}

function startTimer(step) {
  cancelTimer();
  paintIdleAll();
  timer.stepId = step.id;
  const prep = store.getPrepSeconds(state.mode);
  if (prep > 0) {
    timer.phase = 'prep';
    timer.prepEndsAt = Date.now() + prep * 1000;
  } else {
    timer.phase = 'run';
    timer.startedAt = Date.now();
  }
  requestWakeLock();
  timer.handle = setInterval(tickTimer, 100);
  tickTimer();
}

function stopTimer(step) {
  const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
  cancelTimer();
  paintIdleAll();
  const input = $(`caliValue-${step.id}`);
  if (input && elapsed >= 1) input.value = String(elapsed);
  const save = $(`caliSave-${step.id}`);
  if (save) {
    save.classList.remove('pulse');
    void save.offsetWidth;
    save.classList.add('pulse');
  }
  vibrate([120, 60, 120]);
}

function tickRest() {
  rest.remaining = Math.max(0, Math.round((rest.endsAt - Date.now()) / 1000));
  const m = Math.floor(rest.remaining / 60);
  const sec = rest.remaining % 60;
  $('caliRestTime').textContent = `${m}:${String(sec).padStart(2, '0')}`;
  $('caliRestProgress').style.setProperty('--p', Math.max(0, Math.min(rest.remaining / rest.total, 1)));
  if (rest.remaining <= 0) {
    hideRest();
    alertRestEnd();
  }
}

function startRest(seconds) {
  rest.total = seconds;
  rest.endsAt = Date.now() + seconds * 1000;
  primeRestAlert();
  $('caliRestOverlay').classList.add('visible');
  document.querySelectorAll('.cali-preset').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.time) === seconds);
  });
  clearInterval(rest.handle);
  rest.handle = setInterval(tickRest, 250);
  tickRest();
}

// Descanso por exercício, como na academia: o atalho escolhido fica salvo para o
// passo; sem escolha salva, usa o tempo padrão do modo.
const STEP_REST_PREFIX = 'cali:rest:step:';

function startRestFor(step) {
  rest.stepId = step.id;
  const saved = Number(localStorage.getItem(STEP_REST_PREFIX + step.id));
  $('caliRestOverlay').querySelector('.rest-tag').textContent = `Descanso · ${step.name}`;
  startRest(saved > 0 ? saved : store.getRestSeconds(state.mode));
}

function hideRest() {
  clearInterval(rest.handle);
  rest.handle = null;
  const overlay = $('caliRestOverlay');
  if (overlay) overlay.classList.remove('visible');
}

function bindRest() {
  $('caliRestSkip').addEventListener('click', hideRest);
  $('caliRestPlus').addEventListener('click', () => {
    rest.endsAt += 15000;
    rest.total += 15;
    tickRest();
  });
  $('caliRestMinus').addEventListener('click', () => {
    rest.endsAt = Math.max(Date.now(), rest.endsAt - 15000);
    rest.total = Math.max(15, rest.total - 15);
    tickRest();
  });
  document.querySelectorAll('.cali-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const seconds = Number(btn.dataset.time);
      store.setRestSeconds(state.mode, seconds);
      if (rest.stepId) localStorage.setItem(STEP_REST_PREFIX + rest.stepId, String(seconds));
      startRest(seconds);
    });
  });
}

function paintClock() {
  const el = $('caliClock');
  if (el) el.textContent = clockText(state.today, store.isDayFinished(state.mode, todayString()));
}

function startClock() {
  stopClock();
  clockHandle = setInterval(paintClock, 1000);
}

function stopClock() {
  if (clockHandle) clearInterval(clockHandle);
  clockHandle = null;
}

function init() {
  if (!root) return;
  initPanels({ getMode: () => state.mode, onDataChanged: () => render() });
  bindRest();
  document.querySelectorAll('#modeSwitch .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode !== currentBodyMode()) applyMode(btn.dataset.mode, true);
    });
  });
  $('caliCalendarBtn').addEventListener('click', () => openCalendar(state.mode));
  $('caliStatsBtn').addEventListener('click', () => openProgress(state.mode));
  $('mobiCalendarBtn').addEventListener('click', () => openCalendar(state.mode));
  $('mobiStatsBtn').addEventListener('click', () => openProgress(state.mode));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideRest();
  });
  const initialMode = store.getMode();
  state.mode = initialMode === 'mobi' ? 'mobi' : 'cali';
  applyMode(initialMode, false);
}

init();