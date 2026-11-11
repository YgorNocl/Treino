// Miniatura do exercício nos cards e no catálogo: a foto (free-exercise-db, a
// mesma do guia, guardada para uso sem internet pelo Service Worker) ou a
// ilustração da calistenia/mobilidade. Sem nenhuma das duas, ou se a foto não
// carregar, aparece um ícone. O "?" no canto indica que tocar abre o guia.
import { MEDIA_BASE } from './catalog.js';
import { hasPose, poseSvgs } from './calisthenics-poses.js';

const ICON = '<svg class="ex-thumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>';

const attr = text => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// info: { img?, step? } (entrada do catálogo ou passo da calistenia).
// dataAttrs: atributos extras (ex.: 'data-guide="pushup"'). small: versão do catálogo
// (lista longa: foto só carrega ao aparecer na tela; nos cards, carrega já).
export function thumbHtml(info, label, dataAttrs = '', { small = false, interactive = true } = {}) {
  let media = '';
  if (info && info.img) {
    media = `<img src="${MEDIA_BASE}${info.img}/0.jpg" alt="" loading="${small ? 'lazy' : 'eager'}" decoding="async" crossorigin="anonymous" onerror="this.remove()">`;
  } else if (info && info.step && hasPose(info.step)) {
    media = poseSvgs(info.step)[0];
  }
  const role = interactive ? `role="button" tabindex="0" aria-label="Como fazer: ${attr(label)}"` : 'aria-hidden="true"';
  return `<span class="ex-thumb${small ? ' small' : ''}${info && info.img ? ' photo' : ''}" ${role} ${dataAttrs}>${ICON}${media}${interactive ? '<span class="ex-thumb-help" aria-hidden="true">?</span>' : ''}</span>`;
}
