// Imagem do resumo do treino (1080×1350, formato de post/status) para salvar ou
// compartilhar ao finalizar.
import { drawBodyMap } from './body-map.js';

// Mesmas cores do mapa no app (--bm-body / --bm-muscle em css/panel-modals.css).
const BODY_COLOR = '#25282d';
const MUSCLE_RGB = [59, 63, 69];
const MUSCLE_COLOR = `rgb(${MUSCLE_RGB.join(', ')})`;

// Mistura opaca da cor de destaque com a do músculo (auxiliar em tom claro).
function mixRgb(accentRgb, base, amount) {
  const a = accentRgb.split(',').map(Number);
  return `rgb(${a.map((c, i) => Math.round(c * amount + base[i] * (1 - amount))).join(', ')})`;
}

const W = 1080;
const H = 1350;
const PAD = 72;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

// data = { title, dateLabel, stats: [{ value, label }], exercises: [{ name, best, pr }], levels }
export async function buildSummaryImage(data) {
  const css = getComputedStyle(document.body);
  const accent = css.getPropertyValue('--accent').trim() || '#ccff33';
  const accentRgb = css.getPropertyValue('--accent-rgb').trim() || '204, 255, 51';
  const fonts = { display: "'Archivo Black', sans-serif", body: "'Space Grotesk', sans-serif", mono: "'JetBrains Mono', monospace" };
  try {
    await Promise.all([
      document.fonts.load(`80px ${fonts.display}`),
      document.fonts.load(`600 30px ${fonts.body}`),
      document.fonts.load(`700 26px ${fonts.mono}`)
    ]);
  } catch (e) { /* sem as fontes, o canvas usa as do sistema */ }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0b0c0e';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 700);
  glow.addColorStop(0, `rgba(${accentRgb}, 0.16)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Cabeçalho
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent;
  ctx.font = `700 26px ${fonts.mono}`;
  ctx.fillText('TREINO FINALIZADO', PAD, 120);
  ctx.fillStyle = '#f4f4f2';
  ctx.font = `92px ${fonts.display}`;
  ctx.fillText(fitText(ctx, data.title, W - PAD * 2), PAD, 220);
  ctx.fillStyle = '#a8afb5';
  ctx.font = `500 30px ${fonts.body}`;
  ctx.fillText(data.dateLabel, PAD, 270);

  // Números
  const boxY = 320;
  const boxH = 150;
  const gap = 20;
  const boxW = (W - PAD * 2 - gap * (data.stats.length - 1)) / data.stats.length;
  data.stats.forEach((stat, i) => {
    const bx = PAD + i * (boxW + gap);
    roundRect(ctx, bx, boxY, boxW, boxH, 28);
    ctx.fillStyle = '#1a1d21';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = accent;
    // Diminui a fonte até o número caber na caixa (ex.: "1h 12min", "12.480 kg").
    let size = 52;
    do { ctx.font = `${size}px ${fonts.display}`; size -= 2; } while (size > 30 && ctx.measureText(stat.value).width > boxW - 48);
    ctx.fillText(fitText(ctx, stat.value, boxW - 48), bx + 28, boxY + 82);
    ctx.fillStyle = '#767d83';
    ctx.font = `700 22px ${fonts.mono}`;
    ctx.fillText(stat.label.toUpperCase(), bx + 28, boxY + 122);
  });

  // Corpo (frente e costas) à esquerda, exercícios à direita, na mesma altura
  const areaY = 540;
  const areaH = 600;
  const mapH = 500;
  drawBodyMap(ctx, data.levels, {
    x: PAD, y: areaY + (areaH - mapH) / 2, height: mapH, gap: 24,
    colors: { body: BODY_COLOR, idle: MUSCLE_COLOR, secondary: mixRgb(accentRgb, MUSCLE_RGB, 0.45), primary: accent, over: '#ff5a5f' }
  });

  const listX = 590;
  const listW = W - PAD - listX;
  const maxRows = 9;
  const hidden = Math.max(0, data.exercises.length - maxRows);
  const rows = data.exercises.slice(0, maxRows);
  const slots = rows.length + (hidden ? 1 : 0);
  const step = Math.min(96, areaH / Math.max(slots, 1));
  let rowY = areaY + (areaH - step * slots) / 2;
  rows.forEach((ex, i) => {
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(listX, rowY, listW, 2);
    }
    ctx.fillStyle = '#f4f4f2';
    ctx.font = `600 27px ${fonts.body}`;
    ctx.fillText(fitText(ctx, ex.name, listW), listX, rowY + step / 2 - 4);
    ctx.fillStyle = ex.pr ? accent : '#a8afb5';
    ctx.font = `700 23px ${fonts.mono}`;
    ctx.fillText(ex.pr ? `${ex.best}  · PR` : ex.best, listX, rowY + step / 2 + 28);
    rowY += step;
  });
  if (hidden) {
    ctx.fillStyle = '#767d83';
    ctx.font = `600 24px ${fonts.body}`;
    ctx.fillText(`+ ${hidden} exercício${hidden > 1 ? 's' : ''}`, listX, rowY + step / 2 + 8);
  }

  // Rodapé
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(PAD, H - 130, W - PAD * 2, 2);
  ctx.fillStyle = '#767d83';
  ctx.font = `700 24px ${fonts.mono}`;
  ctx.fillText('TREINO', PAD, H - 72);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
