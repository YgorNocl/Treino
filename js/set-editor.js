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
// onSave(values) -> false mantém a folha aberta (valor inválido)
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

saveBtn.addEventListener('click', () => {
  if (!current) return;
  const values = {};
  current.fields.forEach(f => { values[f.key] = document.getElementById(`setEdit-${f.key}`).value; });
  if (current.onSave(values) === false) return;
  close();
});

deleteBtn.addEventListener('click', () => {
  if (!current) return;
  const { onDelete } = current;
  close();
  onDelete();
});

cancelBtn.addEventListener('click', close);
modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
