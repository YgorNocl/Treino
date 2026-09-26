import { fmtValue } from './calisthenics-data.js';

export function metricValue(session, metric) {
  return metric === 'total' ? session.total : session.best;
}

export function metricGoal(step, metric) {
  return metric === 'total' ? step.goal.sets * step.goal.value : step.goal.value;
}

function smoothPath(points) {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function formatDateBR(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function buildEvolutionChart(sessions, step, metric) {
  const W = 600, H = 226, PAD_TOP = 34, PAD_BOTTOM = 36, PAD_LEFT = 42, PAD_RIGHT = 18;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const innerW = W - PAD_LEFT - PAD_RIGHT;

  const points = sessions.map((session, i) => ({
    x: sessions.length === 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + (i / (sessions.length - 1)) * innerW,
    value: metricValue(session, metric),
    date: session.date,
    session
  }));

  const values = points.map(p => p.value);
  const goal = metricGoal(step, metric);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const showGoal = goal <= max * 1.5 && goal >= min * 0.6;
  if (showGoal) {
    min = Math.min(min, goal);
    max = Math.max(max, goal);
  }
  if (min === max) {
    min -= 2;
    max += 2;
  }
  const padRatio = points.length <= 3 ? 0.14 : points.length <= 6 ? 0.2 : 0.26;
  const pad = (max - min) * padRatio;
  min -= pad;
  max += pad;
  if (min < 0) min = 0;
  const yFor = v => PAD_TOP + innerH - ((v - min) / (max - min)) * innerH;

  let prIndex = 0;
  points.forEach((p, i) => {
    if (p.value > points[prIndex].value) prIndex = i;
  });

  let grid = '';
  for (let g = 0; g <= 3; g++) {
    const v = min + (max - min) * (g / 3);
    const y = yFor(v);
    grid += `<line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />`;
    grid += `<text x="${(PAD_LEFT - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${Math.round(v)}</text>`;
  }

  let goalLine = '';
  if (showGoal) {
    const gy = yFor(goal);
    goalLine = `<line x1="${PAD_LEFT}" y1="${gy.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${gy.toFixed(1)}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4,5" opacity="0.5" />
      <text x="${PAD_LEFT + 6}" y="${(gy - 5).toFixed(1)}" text-anchor="start" font-family="var(--font-mono)" font-size="9" font-weight="700" fill="var(--accent)" opacity="0.75">meta</text>`;
  }

  const linePath = smoothPath(points.map(p => ({ x: p.x, y: yFor(p.value) })));
  const baseY = H - PAD_BOTTOM + 10;
  const areaPath = points.length > 1 ? `${linePath} L ${points[points.length - 1].x.toFixed(1)},${baseY} L ${points[0].x.toFixed(1)},${baseY} Z` : '';

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  let dots = '';
  let labels = '';
  points.forEach((p, idx) => {
    const y = yFor(p.value);
    const isPR = idx === prIndex;
    const r = isPR ? 6 : 3.5;
    dots += `<g class="evo-point" data-idx="${idx}" tabindex="0" role="button" aria-label="${formatDateBR(p.date)}: ${fmtValue(step, p.value)}">
      <circle class="evo-point-halo" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="transparent" />
      <circle class="evo-point-ring" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 6}" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0" />
      <circle class="evo-point-dot" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${isPR ? 'var(--accent)' : 'var(--bg)'}" stroke="var(--accent)" stroke-width="${isPR ? 0 : 2}" />
      ${isPR ? `<text x="${p.x.toFixed(1)}" y="${(y - 14).toFixed(1)}" text-anchor="middle" font-family="var(--font-mono)" font-weight="700" font-size="11" fill="var(--accent)">${p.value}</text>` : ''}
    </g>`;
    if (idx % labelStep === 0 || idx === points.length - 1) {
      const [, m, d] = p.date.split('-');
      labels += `<text x="${p.x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-family="var(--font-mono)" font-weight="600" font-size="11" fill="var(--text-dim)">${d}/${m}</text>`;
    }
  });

  const pointsData = points.map((p, i) => ({
    date: formatDateBR(p.date),
    value: p.value,
    isPR: i === prIndex,
    delta: i > 0 ? p.value - points[i - 1].value : null,
    sets: p.session.sets
  }));

  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="evo-chart-svg" role="group" aria-label="Evolução por treino">
      <defs>
        <linearGradient id="caliEvoGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      ${grid}
      ${goalLine}
      ${areaPath ? `<path d="${areaPath}" fill="url(#caliEvoGradient)" />` : ''}
      <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />
      ${dots}
      ${labels}
    </svg>`,
    pointsData
  };
}

export function buildSparkline(values) {
  const W = 72, H = 28, PAD = 4;
  const recent = values.slice(-8);
  if (recent.length < 2) return '';
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;
  const usableW = W - PAD * 2;
  const usableH = H - PAD * 2;
  const pts = recent.map((v, i) => {
    const x = PAD + (i / (recent.length - 1)) * usableW;
    const y = PAD + usableH - ((v - min) / range) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lastX, lastY] = pts[pts.length - 1].split(',');
  return `<svg class="sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastX}" cy="${lastY}" r="2.5" fill="var(--accent)" />
    </svg>`;
}