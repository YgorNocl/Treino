import { estimatedMax, formatDateBR, formatLoad } from './utils.js';

export function buildSparklineSVG(history) {
  const W = 72, H = 28, PAD = 4;
  const recent = history.slice(-8);
  if (recent.length < 2) return '';
  const weights = recent.map(h => h.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const usableW = W - PAD * 2;
  const usableH = H - PAD * 2;
  const points = weights.map((w, i) => {
    const x = PAD + (i / (weights.length - 1)) * usableW;
    const y = PAD + usableH - ((w - min) / range) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastX = points[points.length - 1].split(',')[0];
  const lastY = points[points.length - 1].split(',')[1];
  return `
    <svg class="sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline points="${points.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="${lastX}" cy="${lastY}" r="2.5" fill="var(--accent)" />
    </svg>`;
}

export function buildEvolutionChartSVG(sessions, unit) {
  const H = 200, PAD_TOP = 30, PAD_BOTTOM = 30, PAD_LEFT = 40, PAD_RIGHT = 20;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const pxWithin = 32;
  const pxGroup = 50;
  let x = PAD_LEFT + 14;
  const points = [];
  const groupCenters = [];
  const dividerXs = [];
  sessions.forEach((session, si) => {
    if (si > 0) {
      dividerXs.push(x + pxGroup / 2);
      x += pxGroup;
    }
    const groupStartX = x;
    let sessionBestIdx = 0;
    session.sets.forEach((s, i) => {
      if (estimatedMax(s.weight, s.reps) > estimatedMax(session.sets[sessionBestIdx].weight, session.sets[sessionBestIdx].reps)) sessionBestIdx = i;
    });
    session.sets.forEach((s, i) => {
      if (i > 0) x += pxWithin;
      points.push({ x, weight: s.weight, reps: s.reps, date: session.date, setNum: i + 1, notes: s.notes || '', isSessionBest: i === sessionBestIdx });
    });
    groupCenters.push({ x: (groupStartX + x) / 2, date: session.date });
  });
  const W = Math.max(x + PAD_RIGHT + 14, 280);
  const weights = points.map(p => p.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) { min -= 5; max += 5; }
  const pad = (max - min) * 0.25;
  min -= pad; max += pad;
  if (min < 0) min = 0;
  const yFor = w => PAD_TOP + innerH - ((w - min) / (max - min)) * innerH;
  let prPoint = points[0];
  points.forEach(p => { if (estimatedMax(p.weight, p.reps) > estimatedMax(prPoint.weight, prPoint.reps)) prPoint = p; });
  let gridHtml = '';
  const gridCount = 3;
  for (let g = 0; g <= gridCount; g++) {
    const w = min + (max - min) * (g / gridCount);
    const y = yFor(w);
    gridHtml += `<line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />`;
    gridHtml += `<text x="${(PAD_LEFT - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${Math.round(w)}</text>`;
  }
  let dividersHtml = '';
  dividerXs.forEach(dx => {
    dividersHtml += `<line x1="${dx.toFixed(1)}" y1="${PAD_TOP - 10}" x2="${dx.toFixed(1)}" y2="${H - PAD_BOTTOM + 8}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="3,4" />`;
  });
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }
  const linePathStr = smoothPath(points.map(p => ({ x: p.x, y: yFor(p.weight) })));
  let areaPathStr = '';
  if (points.length > 1) {
    areaPathStr = `${linePathStr} L ${points[points.length-1].x.toFixed(1)},${H} L ${points[0].x.toFixed(1)},${H} Z`;
  }
  let dotsHtml = '';
  points.forEach((p, idx) => {
    const y = yFor(p.weight);
    const isPR = p === prPoint;
    const r = isPR ? 5.5 : (p.isSessionBest ? 4 : 3);
    dotsHtml += `<g class="evo-point" data-idx="${idx}" tabindex="0" role="button" aria-label="${formatDateBR(p.date)}, série ${p.setNum}: ${formatLoad(p.weight, unit)} por ${p.reps} reps">
      <circle class="evo-point-halo" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="transparent" />
      <circle class="evo-point-ring" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 5}" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0" />
      <circle class="evo-point-dot" cx="${p.x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${isPR ? 'var(--accent)' : 'var(--bg)'}" stroke="var(--accent)" stroke-width="${isPR ? 0 : 2}" />
      ${isPR ? `<text x="${p.x.toFixed(1)}" y="${(y - 13).toFixed(1)}" text-anchor="middle" font-family="var(--font-mono)" font-weight="700" font-size="11" fill="var(--accent)">${p.weight}</text>` : ''}
    </g>`;
  });
  let labelsHtml = '';
  groupCenters.forEach(g => {
    const [, m, d] = g.date.split('-');
    labelsHtml += `<text x="${g.x.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${d}/${m}</text>`;
  });
  const pointsData = points.map(p => ({ date: formatDateBR(p.date), setNum: p.setNum, weight: p.weight, reps: p.reps, notes: p.notes, isPR: p === prPoint }));
  return {
    svg: `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="evo-chart-svg">
      <defs>
        <linearGradient id="evoGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridHtml}
      ${dividersHtml}
      ${areaPathStr ? `<path d="${areaPathStr}" fill="url(#evoGradient)" />` : ''}
      <path d="${linePathStr}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />
      ${dotsHtml}
      ${labelsHtml}
    </svg>`,
    pointsData,
    width: W
  };
}

export function buildMetricChartSVG(metrics, field) {
  const valid = metrics.filter(m => m[field]);
  if (valid.length < 2) {
    return `
    <div class="empty-chart">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none">
            <polyline points="0,30 20,25 40,35 60,15 80,20 100,5" fill="none" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2,2"/>
        </svg>
        <span>Registre mais dados para ver a evolução</span>
    </div>`;
  }

  const W = 320, H = 140, PAD_TOP = 25, PAD_BOTTOM = 20, PAD_LEFT = 30, PAD_RIGHT = 15;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const usableW = W - PAD_LEFT - PAD_RIGHT;

  const vals = valid.map(m => m[field]);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.3;
  min -= pad; max += pad;

  const points = valid.map((m, i) => {
    const x = PAD_LEFT + (i / (valid.length - 1)) * usableW;
    const y = PAD_TOP + innerH - ((m[field] - min) / (max - min)) * innerH;
    return { x, y, val: m[field], date: m.date };
  });

  let gridHtml = '';
  const gridCount = 3;
  for (let g = 0; g <= gridCount; g++) {
    const w = min + (max - min) * (g / gridCount);
    const y = PAD_TOP + innerH - ((w - min) / (max - min)) * innerH;
    gridHtml += `<line x1="${PAD_LEFT}" y1="${y.toFixed(1)}" x2="${W - PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />`;
    gridHtml += `<text x="${(PAD_LEFT - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${w.toFixed(1)}</text>`;
  }

  function smoothPath(pts) {
    if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const linePathStr = smoothPath(points);
  let areaPathStr = '';
  if (points.length > 1) {
    areaPathStr = `${linePathStr} L ${points[points.length-1].x.toFixed(1)},${H} L ${points[0].x.toFixed(1)},${H} Z`;
  }

  let dotsHtml = '';
  let labelsHtml = '';
  points.forEach((p, idx) => {
    dotsHtml += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--bg)" stroke="var(--accent)" stroke-width="2" />`;
    dotsHtml += `<text x="${p.x.toFixed(1)}" y="${(p.y - 12).toFixed(1)}" text-anchor="middle" font-family="var(--font-mono)" font-weight="700" font-size="10" fill="var(--accent)">${p.val}</text>`;
    if (idx === 0 || idx === points.length - 1) {
      const [, m, d] = p.date.split('-');
      labelsHtml += `<text x="${p.x.toFixed(1)}" y="${H - 5}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="var(--text-faint)">${d}/${m}</text>`;
    }
  });

  return `
  <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); border-radius: 14px; padding: 16px 10px 8px; overflow-x: auto; scrollbar-width: none;">
      <svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet" style="min-width: 280px; display: block;">
          <defs>
              <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
              </linearGradient>
          </defs>
          ${gridHtml}
          ${areaPathStr ? `<path d="${areaPathStr}" fill="url(#metricGrad)" />` : ''}
          <path d="${linePathStr}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />
          ${dotsHtml}
          ${labelsHtml}
      </svg>
  </div>`;
}