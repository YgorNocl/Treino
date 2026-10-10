// Folha para corrigir ou apagar uma série já registrada. A mesma tela serve à
// academia (carga + reps), à calistenia e à mobilidade (reps ou segundos):
// tocar numa bolinha preenchida abre aqui, em vez de apagar direto.

const modal = document.getElementById('setEditModal');
const titleEl = document.getElementById('setEditTitle');
const subEl = document.getElementById('setEditSub');
const fieldsEl = document.getElementById('setEditFields');
const saveBtn = document.getElementById('setEditSave');
const deleteBtn = document.getElementById('setEditDelete');
const cancelBtn = document.getElementById('setEditCancel');

let current = null;

function close() {
  modal.classList.remove('visible');
  current = null;
}

// fields: [{ key, label, value, inputmode }]
// onSave(values) -> false (ou a key do campo errado) mantém a folha aberta e
// marca o campo em vermelho — antes o toque em Salvar simplesmente não fazia nada.
export function openSetEditor({ title, subtitle, fields, onSave, onDelete }) {
  current = { fields, onSave, onDelete };
  titleEl.innerText = title;
  subEl.innerText = subtitle || '';
  fieldsEl.innerHTML = fields.map(f => `
    <div class="input-group">
      <label for="setEdit-${f.key}">${f.label}</label>
      <input type="number" inputmode="${f.inputmode || 'decimal'}" id="setEdit-${f.key}" value="${f.value ?? ''}">
    </div>`).join('');
  modal.classList.add('visible');
}

function markInvalid(keys) {
  keys.forEach(key => {
    const input = document.getElementById(`setEdit-${key}`);
    if (!input) return;
    input.classList.remove('input-missing');
    void input.offsetWidth;
    input.classList.add('input-missing');
  });
  const first = document.getElementById(`setEdit-${keys[0]}`);
  if (first) first.focus();
}

saveBtn.addEventListener('click', () => {
  if (!current) return;
  const values = {};
  current.fields.forEach(f => { values[f.key] = document.getElementById(`setEdit-${f.key}`).value; });
  const result = current.onSave(values);
  if (result === false) return markInvalid(current.fields.map(f => f.key));
  if (typeof result === 'string') return markInvalid([result]);
  close();
});

// "ok" no teclado salva; digitar tira o vermelho do campo.
fieldsEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  saveBtn.click();
});
fieldsEl.addEventListener('input', (e) => e.target.classList.remove('input-missing'));

deleteBtn.addEventListener('click', () => {
  if (!current) return;
  const { onDelete } = current;
  close();
  onDelete();
});

cancelBtn.addEventListener('click', close);
modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
