const LEN = { torso: 30, neck: 5, head: 7, upper: 21, fore: 19, thigh: 29, shin: 28, foot: 8 };
// A altura de cada quadro acompanha a pose: deitado fica baixo, em pé fica alto.
const FRAME_SINGLE = { w: 240, maxH: 150, minH: 90, pad: 18 };
const FRAME_PAIR = { w: 180, maxH: 190, minH: 80, pad: 14 };

// Boneco de perfil, olhando para a direita. Ângulos em graus no sistema do SVG:
// 0 = direita, 90 = baixo, -90 = cima, 180 = esquerda.
// contact: onde o corpo apoia (mão no chão, quadril, pés ou barra).
// Um exercício pode ter duas poses [início, fim], desenhadas lado a lado.
const QUADRUPED = { contact: 'floor', torso: -22, neck: -12, upper: 90, fore: 90, legs: [{ thigh: 90, shin: 180, foot: 180 }] };
const STANDING = { contact: 'feet', torso: -90, neck: -90, upper: 90, fore: 90, legs: [{ thigh: 90, shin: 90, foot: 0 }] };

const POSES = {
  'frog-stand': { contact: 'floor', torso: 25, neck: 30, upper: 150, fore: 80, legs: [{ thigh: 34, shin: 200, foot: 200 }] },
  'tuck-elbow-lever': { contact: 'floor', torso: 0, neck: -12, upper: 165, fore: 90, legs: [{ thigh: 25, shin: 195, foot: 195 }] },
  'adv-tuck-elbow-lever': { contact: 'floor', torso: 0, neck: -12, upper: 165, fore: 90, legs: [{ thigh: 135, shin: 185, foot: 190 }] },
  'one-leg-elbow-lever': { contact: 'floor', torso: 0, neck: -12, upper: 165, fore: 90, legs: [{ thigh: 180, shin: 180, foot: 195 }, { thigh: 25, shin: 195, foot: 195 }] },
  'elbow-lever-full': { contact: 'floor', torso: 0, neck: -12, upper: 165, fore: 90, legs: [{ thigh: 180, shin: 180, foot: 195 }] },

  // Flexões
  'archer-pushup': { contact: 'floor', plant: true, torso: -6, neck: -4, upper: 140, fore: 70, farArm: { upper: 25, fore: 25 }, legs: [{ thigh: 174, shin: 174 }] },

  // Core
  'boat-hold': { contact: 'hip', torso: -125, neck: -115, upper: -20, fore: -20, legs: [{ thigh: -40, shin: -40, foot: -30 }] },

  // L-Sit (apoio nas mãos, quadril fora do chão)
  'tuck-l-sit': { contact: 'floor', torso: -90, neck: -84, upper: 90, fore: 90, legs: [{ thigh: -50, shin: 120, foot: 30 }] },
  'one-leg-l-sit': { contact: 'floor', torso: -90, neck: -84, upper: 90, fore: 90, legs: [{ thigh: 0, shin: 0, foot: -60 }, { thigh: -50, shin: 120, foot: 30 }] },
  'l-sit-full': { contact: 'floor', torso: -90, neck: -84, upper: 90, fore: 90, legs: [{ thigh: 0, shin: 0, foot: -60 }] },

  // Mobilidade de ombro
  'sleeper-stretch': [
    { contact: 'hip', torso: 180, neck: 180, upper: -90, fore: -90, legs: [{ thigh: 0, shin: 0, foot: -80 }] },
    { contact: 'hip', torso: 180, neck: 180, upper: -90, fore: -10, legs: [{ thigh: 0, shin: 0, foot: -80 }] }
  ],
  'wall-slide': [
    { ...STANDING, wall: 'left', upper: 180, fore: -90 },
    { ...STANDING, wall: 'left', upper: -105, fore: -100 }
  ],
  'shoulder-dislocate-stick': [
    { ...STANDING, prop: 'stick', upper: 70, fore: 70 },
    { ...STANDING, prop: 'stick', upper: -125, fore: -135 }
  ],

  // Punho e cotovelo
  'wrist-circles-floor': QUADRUPED,
  'forearm-plank-rock': { contact: 'floor', plant: true, prop: 'fist', torso: -14, neck: -8, upper: 66, fore: 66, legs: [{ thigh: 170, shin: 170 }] },

  // Coluna
  'thoracic-rotation-quadruped': [
    { ...QUADRUPED, anchor: 'farHand', farArm: { upper: 90, fore: 90 }, upper: -90, fore: -90, neck: -40 },
    { ...QUADRUPED, anchor: 'farHand', farArm: { upper: 90, fore: 90 }, upper: 120, fore: 175, neck: 30, torso: -14 }
  ],
  'cobra-extension': [
    { contact: 'hip', torso: 0, neck: 0, upper: -150, fore: 60, legs: [{ thigh: 180, shin: 180, foot: 200 }] },
    { contact: 'hip', torso: -30, neck: -40, upper: 150, fore: 30, legs: [{ thigh: 180, shin: 180, foot: 200 }] }
  ],

  // Quadril
  'hip-90-90-flow': { contact: 'hip', torso: -88, neck: -88, upper: 60, fore: 20, legs: [{ thigh: 5, shin: 185, foot: 180 }, { thigh: 175, shin: -5, foot: 0 }] },

  // Posterior e tornozelo
  'ankle-rock-knee': [
    { contact: 'feet', torso: -90, neck: -86, upper: 75, fore: 30, legs: [{ thigh: 0, shin: 90, foot: 0 }, { thigh: 90, shin: 180, foot: 180 }] },
    { contact: 'feet', torso: -84, neck: -80, upper: 60, fore: 30, legs: [{ thigh: 20, shin: 62, foot: 0 }, { thigh: 102, shin: 180, foot: 180 }] }
  ],
  'standing-hamstring-sweep': [
    { ...STANDING, legs: [{ thigh: 78, shin: 78, foot: -60 }, { thigh: 94, shin: 92, foot: 0 }] },
    { ...STANDING, torso: -18, neck: -10, upper: 100, fore: 100, legs: [{ thigh: 64, shin: 64, foot: -60 }, { thigh: 100, shin: 82, foot: 0 }] }
  ]
};

const rad = a => (a * Math.PI) / 180;
const step = (p, angle, length) => ({ x: p.x + Math.cos(rad(angle)) * length, y: p.y + Math.sin(rad(angle)) * length });
const shift = (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy });

function buildFigure(pose) {
  const hip = { x: 0, y: 0 };
  const shoulder = step(hip, pose.torso, LEN.torso);
  const head = step(shoulder, pose.neck === undefined ? pose.torso : pose.neck, LEN.neck + LEN.head);
  const elbow = step(shoulder, pose.upper, LEN.upper);
  const hand = step(elbow, pose.fore, LEN.fore);
  const farElbow = pose.farArm ? step(shoulder, pose.farArm.upper, LEN.upper) : null;
  const farHand = pose.farArm ? step(farElbow, pose.farArm.fore, LEN.fore) : null;
  const legs = pose.legs.map(leg => {
    const knee = step(hip, leg.thigh, LEN.thigh);
    const ankle = step(knee, leg.shin, LEN.shin);
    const toe = step(ankle, leg.foot === undefined ? leg.shin : leg.foot, LEN.foot);
    return { knee, ankle, toe };
  });
  return { hip, shoulder, head, elbow, hand, farElbow, farHand, legs };
}

function offsetFor(fig, pose) {
  if (pose.contact === 'hip') return { dx: 0, dy: -7 };
  if (pose.contact === 'feet') {
    const lowest = Math.max(...fig.legs.flatMap(l => [l.knee.y, l.ankle.y, l.toe.y]));
    return { dx: 0, dy: -lowest };
  }
  const anchor = pose.anchor === 'farHand' && fig.farHand ? fig.farHand : fig.hand;
  return { dx: -anchor.x, dy: -anchor.y };
}

function place(fig, pose) {
  const { dx, dy } = offsetFor(fig, pose);
  const mv = p => (p ? shift(p, dx, dy) : null);
  const moved = {
    hip: mv(fig.hip),
    shoulder: mv(fig.shoulder),
    head: mv(fig.head),
    elbow: mv(fig.elbow),
    hand: mv(fig.hand),
    farElbow: mv(fig.farElbow),
    farHand: mv(fig.farHand),
    legs: fig.legs.map(l => ({ knee: mv(l.knee), ankle: mv(l.ankle), toe: mv(l.toe) }))
  };
  if (pose.plant) {
    moved.legs = moved.legs.map(l => {
      const k = (-3 - moved.hip.y) / (l.ankle.y - moved.hip.y);
      const scale = p => ({ x: moved.hip.x + (p.x - moved.hip.x) * k, y: moved.hip.y + (p.y - moved.hip.y) * k });
      const knee = scale(l.knee);
      const ankle = scale(l.ankle);
      return { knee, ankle, toe: { x: ankle.x + Math.cos(rad(0)) * LEN.foot, y: ankle.y } };
    });
  }
  return moved;
}

function allPoints(f) {
  const pts = [f.hip, f.shoulder, f.elbow, f.hand];
  if (f.farHand) pts.push(f.farElbow, f.farHand);
  f.legs.forEach(l => pts.push(l.knee, l.ankle, l.toe));
  pts.push({ x: f.head.x - LEN.head, y: f.head.y - LEN.head }, { x: f.head.x + LEN.head, y: f.head.y + LEN.head });
  return pts;
}

function line(points, width, color, opacity) {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`;
}

function framesOf(stepId) {
  const entry = POSES[stepId];
  return Array.isArray(entry) ? entry : [entry];
}

export function hasPose(stepId) {
  return Object.prototype.hasOwnProperty.call(POSES, stepId);
}

function drawFrame(fig, pose, s, cx, frame) {
  const hanging = pose.contact === 'bar';
  const T = p => ({
    x: (p.x - cx) * s + frame.w / 2,
    y: hanging ? frame.pad + p.y * s : frame.h - frame.pad + p.y * s
  });
  const hip = T(fig.hip);
  const shoulder = T(fig.shoulder);
  const elbow = T(fig.elbow);
  const hand = T(fig.hand);
  const head = T(fig.head);
  const legs = fig.legs.map(l => ({ knee: T(l.knee), ankle: T(l.ankle), toe: T(l.toe) }));

  const near = 'var(--accent)';
  const far = 'var(--accent-dim)';
  const arm = 'var(--text)';
  const armFar = 'var(--text-dim)';
  const limb = 4.6 * s;
  const body = 8 * s;
  const groundY = frame.h - frame.pad;
  let out = '';

  if (hanging) {
    out += `<line x1="${(hand.x - 30).toFixed(1)}" y1="${hand.y.toFixed(1)}" x2="${(hand.x + 30).toFixed(1)}" y2="${hand.y.toFixed(1)}" stroke="rgba(255,255,255,0.35)" stroke-width="4" stroke-linecap="round" />`;
  } else {
    out += `<line x1="10" y1="${groundY}" x2="${frame.w - 10}" y2="${groundY}" stroke="rgba(255,255,255,0.22)" stroke-width="2" stroke-linecap="round" />`;
  }

  if (pose.wall) {
    const xs = [...legs.map(l => l.ankle.x), hip.x, shoulder.x];
    const wallX = pose.wall === 'left' ? Math.min(...xs) - body * 0.7 : Math.max(...xs) + body * 0.7;
    out += `<line x1="${wallX.toFixed(1)}" y1="${groundY}" x2="${wallX.toFixed(1)}" y2="6" stroke="rgba(255,255,255,0.22)" stroke-width="3" stroke-linecap="round" />`;
  }

  const farShift = 3.2 * s / 2;
  const farLegs = legs.length > 1 ? legs.slice(1) : legs;
  const nearLeg = legs[0];

  farLegs.forEach(l => {
    const dx = legs.length > 1 ? 0 : -farShift;
    const dy = legs.length > 1 ? 0 : -farShift * 0.5;
    out += line([shift(hip, dx, dy), shift(l.knee, dx, dy), shift(l.ankle, dx, dy), shift(l.toe, dx, dy)], limb, far, 0.9);
  });
  if (fig.farHand) {
    out += line([shoulder, T(fig.farElbow), T(fig.farHand)], limb, armFar, 0.75);
  } else {
    out += line([shift(shoulder, farShift, 0), shift(elbow, farShift, 0), shift(hand, farShift, 0)], limb, armFar, 0.75);
  }
  out += line([hip, shoulder], body, near, 1);
  out += line([hip, nearLeg.knee, nearLeg.ankle, nearLeg.toe], limb * 1.1, near, 1);
  out += line([shoulder, elbow, hand], limb, arm, 1);
  if (pose.prop === 'stick') {
    out += `<circle cx="${hand.x.toFixed(1)}" cy="${hand.y.toFixed(1)}" r="${(3.4 * s).toFixed(1)}" fill="none" stroke="var(--text-dim)" stroke-width="${(1.6 * s).toFixed(1)}" />`;
  }
  if (pose.prop === 'fist') {
    out += `<circle cx="${hand.x.toFixed(1)}" cy="${(hand.y - 1.6 * s).toFixed(1)}" r="${(2.8 * s).toFixed(1)}" fill="var(--text)" />`;
  }
  out += `<circle cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" r="${(LEN.head * 0.9 * s).toFixed(1)}" fill="${near}" />`;

  return `<svg viewBox="0 0 ${frame.w} ${frame.h}" class="cali-pose-svg" role="img" aria-label="Ilustração da posição" preserveAspectRatio="xMidYMid meet">${out}</svg>`;
}

// Uma ou duas ilustrações (início e fim), na mesma escala para ficarem comparáveis.
export function poseSvgs(stepId) {
  if (!hasPose(stepId)) return [];
  const poses = framesOf(stepId);
  const base = poses.length > 1 ? FRAME_PAIR : FRAME_SINGLE;
  const figs = poses.map(pose => place(buildFigure(pose), pose));
  const bounds = figs.map(fig => {
    const pts = allPoints(fig);
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys, 0), maxY: Math.max(...ys, 0) };
  });
  const availW = base.w - base.pad * 2;
  const availH = base.maxH - base.pad * 2;
  const s = Math.min(...bounds.map(b => Math.min(availW / (b.maxX - b.minX), availH / (b.maxY - b.minY), 2.2)));
  const contentH = Math.max(...bounds.map(b => b.maxY - b.minY)) * s;
  const h = Math.round(Math.min(base.maxH, Math.max(base.minH, contentH + base.pad * 2)));
  const frame = { w: base.w, h, pad: base.pad };
  return figs.map((fig, i) => drawFrame(fig, poses[i], s, (bounds[i].minX + bounds[i].maxX) / 2, frame));
}
