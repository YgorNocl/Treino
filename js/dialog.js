// Janela de confirmação/aviso/pergunta no visual do app, no lugar do
// confirm()/alert()/prompt() do navegador (caixas cinzas, fora do tema).
// Todas devolvem uma Promise; só uma fica aberta por vez.

const modal = document.getElementById('appDialog');
const titleEl = document.getElementById('appDialogTitle');
const textEl = document.getElementById('appDialogText');
const inputEl = document.getElementById('appDialogInput');
const okBtn = document.getElementById('appDialogOk');
const cancelBtn = document.getElementById('appDialogCancel');

let resolveCurrent = null;

function finish(value) {
  if (!resolveCurrent) return;
  const resolve = resolveCurrent;
  resolveCurrent = null;
  modal.classList.remove('visible');
  resolve(value);
}

function open({ title, text = '', okLabel, cancelLabel = null, danger = false, input = null }) {
  if (resolveCurrent) finish(input ? null : false);
  titleEl.innerText = title;
  textEl.innerText = text;
  textEl.hidden = !text;
  okBtn.innerText = okLabel;
  okBtn.classList.toggle('danger', danger);
  cancelBtn.hidden = !cancelLabel;
  if (cancelLabel) cancelBtn.innerText = cancelLabel;
  inputEl.hidden = !input;
  if (input) {
    inputEl.value = '';
    inputEl.placeholder = input.placeholder || '';
  }
  modal.classList.add('visible');
  if (input) setTimeout(() => inputEl.focus(), 50);
  return new Promise(resolve => { resolveCurrent = resolve; });
}

export function confirmDialog({ title, text, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false }) {
  return open({ title, text, okLabel: confirmLabel, cancelLabel, danger });
}

export function alertDialog({ title, text, okLabel = 'Entendi' }) {
  return open({ title, text, okLabel });
}

// Resolve com o texto digitado (sem espaços nas pontas) ou null se cancelar.
export function promptDialog({ title, text, placeholder, confirmLabel = 'Continuar' }) {
  return open({ title, text, okLabel: confirmLabel, cancelLabel: 'Cancelar', input: { placeholder } });
}

okBtn.addEventListener('click', () => finish(inputEl.hidden ? true : inputEl.value.trim() || null));
cancelBtn.addEventListener('click', () => finish(inputEl.hidden ? false : null));
inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') okBtn.click(); });
modal.addEventListener('click', (e) => { if (e.target === modal) cancelBtn.hidden ? okBtn.click() : cancelBtn.click(); });
// Fechada por fora (botão "voltar" do celular / Esc): conta como cancelar.
new MutationObserver(() => {
  if (!modal.classList.contains('visible') && resolveCurrent) finish(inputEl.hidden ? false : null);
}).observe(modal, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && resolveCurrent) cancelBtn.click(); });
