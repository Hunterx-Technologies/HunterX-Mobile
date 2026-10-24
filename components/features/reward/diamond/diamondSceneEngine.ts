import { DIAMOND_SCENE } from '../../../../constants/diamondRewardScene';

// A small player for the exported Rive scene: evaluates the keyframes at a
// time, resolves world transforms, rebuilds the (partly morphing) paths and
// returns flat draw commands in artboard units. Every function here is a
// worklet so the native renderer can run it on the UI thread; the web
// renderer calls the same functions from requestAnimationFrame.

/** Affine matrix [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export type Mat = number[];

/** Path commands: 0 x y = move, 1 x y = line, 2 x1 y1 x2 y2 x y = cubic, 3 = close. */
export type PathCmds = number[];

export interface ScenePaint {
  /** 0 solid, 1 linear gradient, 2 radial gradient. */
  k: number;
  c?: number;
  sx?: number;
  sy?: number;
  ex?: number;
  ey?: number;
  op?: number;
  pos?: readonly number[];
  cols?: readonly number[];
}

export interface DrawCmd {
  m: Mat;
  path: PathCmds;
  evenOdd: boolean;
  paint: ScenePaint;
  alpha: number;
  blend: number;
  stroke: number; // 0 = fill
  cap: number;
  join: number;
  clips: { path: PathCmds; evenOdd: boolean }[];
}

type AnyNode = {
  x: number;
  y: number;
  r: number;
  sx: number;
  sy: number;
  op: number;
  kids: readonly number[];
  clips: readonly { src: number; rule: number }[];
  shape?: number;
  blend?: number;
  nested?: string;
  paths?: readonly { p: number; via: readonly number[] }[];
  fills?: readonly {
    paint: ScenePaint | null;
    rule?: number;
    stroke?: number;
    cap?: number;
    join?: number;
  }[];
  drawRule?: { target: number; after: boolean };
};

type AnyPath = {
  k: number;
  x: number;
  y: number;
  r: number;
  sx: number;
  sy: number;
  closed?: boolean;
  v?: readonly (readonly number[])[];
  w?: number;
  h?: number;
  ox?: number;
  oy?: number;
  rad?: number;
  n?: number;
  cr?: number;
  inner?: number;
};

const S = DIAMOND_SCENE as unknown as {
  ui: { w: number; h: number; roots: readonly number[] };
  mf: { w: number; h: number; roots: readonly number[] };
  nodes: Record<string, AnyNode>;
  paths: Record<string, AnyPath>;
  parent: Record<string, number>;
  anims: readonly {
    ab: string;
    fps: number;
    dur: number;
    loop: number;
    tracks: readonly { t: readonly (string | number)[]; kf: readonly (readonly number[])[] }[];
  }[];
  cubics: readonly (readonly number[])[];
};

export const ARTBOARD_WIDTH = S.ui.w;
export const ARTBOARD_HEIGHT = S.ui.h;

const DEG = Math.PI / 180;

function cubicEase(x1: number, y1: number, x2: number, y2: number, u: number): number {
  'worklet';
  // Solve bezierX(t) = u with Newton steps, then return bezierY(t).
  let t = u;
  for (let i = 0; i < 8; i++) {
    const it = 1 - t;
    const x = 3 * it * it * t * x1 + 3 * it * t * t * x2 + t * t * t - u;
    const dx = 3 * it * it * x1 + 6 * it * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(x) < 1e-5 || dx === 0) break;
    t = Math.min(1, Math.max(0, t - x / dx));
  }
  const it = 1 - t;
  return 3 * it * it * t * y1 + 3 * it * t * t * y2 + t * t * t;
}

function sampleTrack(kf: readonly (readonly number[])[], frame: number): number {
  'worklet';
  if (frame <= kf[0][0]) return kf[0][1];
  const last = kf[kf.length - 1];
  if (frame >= last[0]) return last[1];
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i];
    const b = kf[i + 1];
    if (frame >= a[0] && frame < b[0]) {
      if (a[2] === 0) return a[1];
      let u = (frame - a[0]) / (b[0] - a[0]);
      if (a[2] === 2 && a[3] >= 0) {
        const c = S.cubics[a[3]];
        u = cubicEase(c[0], c[1], c[2], c[3], u);
      }
      return a[1] + (b[1] - a[1]) * u;
    }
  }
  return last[1];
}

/** Animated values at time `t` (seconds since the screen appeared), keyed "n:<node>:<prop>" / "v:<path>:<vertex>:<prop>". */
export function evaluate(t: number): Record<string, number> {
  'worklet';
  const ov: Record<string, number> = {};
  for (let a = 0; a < S.anims.length; a++) {
    const an = S.anims[a];
    let frame = t * an.fps;
    frame = an.loop === 1 ? frame % an.dur : Math.min(frame, an.dur);
    for (let i = 0; i < an.tracks.length; i++) {
      const tr = an.tracks[i];
      ov[tr.t.join(':')] = sampleTrack(tr.kf, frame);
    }
  }
  return ov;
}

function nv(ov: Record<string, number>, id: number, n: AnyNode, prop: 'x' | 'y' | 'r' | 'sx' | 'sy' | 'op'): number {
  'worklet';
  const v = ov['n:' + id + ':' + prop];
  return v === undefined ? n[prop] : v;
}

function mul(p: Mat, q: Mat): Mat {
  'worklet';
  return [
    p[0] * q[0] + p[2] * q[1],
    p[1] * q[0] + p[3] * q[1],
    p[0] * q[2] + p[2] * q[3],
    p[1] * q[2] + p[3] * q[3],
    p[0] * q[4] + p[2] * q[5] + p[4],
    p[1] * q[4] + p[3] * q[5] + p[5],
  ];
}

function trs(x: number, y: number, rDeg: number, sx: number, sy: number): Mat {
  'worklet';
  const c = Math.cos(rDeg * DEG);
  const s = Math.sin(rDeg * DEG);
  return [c * sx, s * sx, -s * sy, c * sy, x, y];
}

function localOf(ov: Record<string, number>, id: number): Mat {
  'worklet';
  const n = S.nodes[id];
  return trs(nv(ov, id, n, 'x'), nv(ov, id, n, 'y'), nv(ov, id, n, 'r'), nv(ov, id, n, 'sx'), nv(ov, id, n, 'sy'));
}

function apply(m: Mat, x: number, y: number): number[] {
  'worklet';
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Rive's control-point distance for a rounded straight vertex. */
function idealControlDistance(px: number, py: number, nx: number, ny: number, radius: number): number {
  'worklet';
  const angle = Math.abs(Math.atan2(px * ny - py * nx, px * nx + py * ny));
  return Math.min(
    radius,
    (4 / 3) *
      Math.tan(Math.PI / (2 * ((2 * Math.PI) / angle))) *
      radius *
      (angle < Math.PI / 2 ? 1 + Math.cos(angle) : 2 - Math.sin(angle))
  );
}

function pointsPath(ov: Record<string, number>, pid: number, p: AnyPath, m: Mat, out: PathCmds) {
  'worklet';
  const vs = p.v || [];
  const n = vs.length;
  if (!n) return;
  // Resolve animated vertex values and their in/out control points.
  const X: number[] = [];
  const Y: number[] = [];
  const R: number[] = [];
  const IX: number[] = [];
  const IY: number[] = [];
  const OX: number[] = [];
  const OY: number[] = [];
  const cub: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const v = vs[i];
    const kx = ov['v:' + pid + ':' + i + ':x'];
    const ky = ov['v:' + pid + ':' + i + ':y'];
    const kr = ov['v:' + pid + ':' + i + ':rad'];
    const x = kx === undefined ? v[1] : kx;
    const y = ky === undefined ? v[2] : ky;
    X.push(x);
    Y.push(y);
    if (v[0] === 1) {
      cub.push(true);
      R.push(0);
      IX.push(x + Math.cos(v[3] * DEG) * v[4]);
      IY.push(y + Math.sin(v[3] * DEG) * v[4]);
      OX.push(x + Math.cos(v[5] * DEG) * v[6]);
      OY.push(y + Math.sin(v[5] * DEG) * v[6]);
    } else {
      cub.push(false);
      R.push(kr === undefined ? v[3] : kr);
      IX.push(x);
      IY.push(y);
      OX.push(x);
      OY.push(y);
    }
  }
  const closed = p.closed !== false;
  // Expand rounded straight vertices into (start, ctrl1, ctrl2, end) segments.
  type Seg = { sx: number; sy: number; c1x: number; c1y: number; c2x: number; c2y: number; ex: number; ey: number };
  const round: (Seg | null)[] = [];
  for (let i = 0; i < n; i++) {
    const hasNeighbours = closed || (i > 0 && i < n - 1);
    if (cub[i] || R[i] <= 0 || !hasNeighbours) {
      round.push(null);
      continue;
    }
    const pi = (i - 1 + n) % n;
    const ni = (i + 1) % n;
    const prevX = cub[pi] ? OX[pi] : X[pi];
    const prevY = cub[pi] ? OY[pi] : Y[pi];
    const nextX = cub[ni] ? IX[ni] : X[ni];
    const nextY = cub[ni] ? IY[ni] : Y[ni];
    let tpx = prevX - X[i];
    let tpy = prevY - Y[i];
    const tpl = Math.hypot(tpx, tpy) || 1;
    tpx /= tpl;
    tpy /= tpl;
    let tnx = nextX - X[i];
    let tny = nextY - Y[i];
    const tnl = Math.hypot(tnx, tny) || 1;
    tnx /= tnl;
    tny /= tnl;
    const rr = Math.min(tpl / 2, tnl / 2, R[i]);
    const ideal = idealControlDistance(tpx, tpy, tnx, tny, rr);
    round.push({
      sx: X[i] + tpx * rr,
      sy: Y[i] + tpy * rr,
      c1x: X[i] + tpx * (rr - ideal),
      c1y: Y[i] + tpy * (rr - ideal),
      c2x: X[i] + tnx * (rr - ideal),
      c2y: Y[i] + tny * (rr - ideal),
      ex: X[i] + tnx * rr,
      ey: Y[i] + tny * rr,
    });
  }
  const T = (x: number, y: number) => apply(m, x, y);
  // Each vertex has an entry point (where the incoming segment ends) and an
  // exit point; a rounded corner is the arc between the two.
  const enX = (i: number) => (round[i] ? (round[i] as Seg).sx : X[i]);
  const enY = (i: number) => (round[i] ? (round[i] as Seg).sy : Y[i]);
  const exX = (i: number) => (round[i] ? (round[i] as Seg).ex : X[i]);
  const exY = (i: number) => (round[i] ? (round[i] as Seg).ey : Y[i]);
  const arc = (i: number) => {
    const rs = round[i];
    if (!rs) return;
    const a = T(rs.c1x, rs.c1y);
    const b = T(rs.c2x, rs.c2y);
    const e = T(rs.ex, rs.ey);
    out.push(2, a[0], a[1], b[0], b[1], e[0], e[1]);
  };
  const segment = (from: number, to: number) => {
    const e = T(enX(to), enY(to));
    if (cub[from] || cub[to]) {
      const a = cub[from] ? T(OX[from], OY[from]) : T(exX(from), exY(from));
      const b = cub[to] ? T(IX[to], IY[to]) : e;
      out.push(2, a[0], a[1], b[0], b[1], e[0], e[1]);
    } else {
      out.push(1, e[0], e[1]);
    }
  };
  const s0 = T(enX(0), enY(0));
  out.push(0, s0[0], s0[1]);
  arc(0);
  for (let i = 1; i < n; i++) {
    segment(i - 1, i);
    arc(i);
  }
  if (closed) {
    segment(n - 1, 0);
    out.push(3);
  }
}

function parametricPath(p: AnyPath, m: Mat, out: PathCmds) {
  'worklet';
  const w = p.w || 0;
  const h = p.h || 0;
  const x0 = -w * (p.ox === undefined ? 0.5 : p.ox);
  const y0 = -h * (p.oy === undefined ? 0.5 : p.oy);
  const T = (x: number, y: number) => apply(m, x, y);
  const K = 0.5519150244935105707435627;
  if (p.k === 2) {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x0 + rx;
    const cy = y0 + ry;
    const pts = [
      [cx, cy - ry],
      [cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy],
      [cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry],
      [cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy],
      [cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry],
    ];
    const s = T(pts[0][0], pts[0][1]);
    out.push(0, s[0], s[1]);
    for (let i = 1; i < 5; i++) {
      const q = pts[i];
      const a = T(q[0], q[1]);
      const b = T(q[2], q[3]);
      const e = T(q[4], q[5]);
      out.push(2, a[0], a[1], b[0], b[1], e[0], e[1]);
    }
    out.push(3);
    return;
  }
  if (p.k === 1) {
    const r = Math.min(p.rad || 0, w / 2, h / 2);
    if (r <= 0) {
      const a = T(x0, y0);
      const b = T(x0 + w, y0);
      const c = T(x0 + w, y0 + h);
      const d = T(x0, y0 + h);
      out.push(0, a[0], a[1], 1, b[0], b[1], 1, c[0], c[1], 1, d[0], d[1], 3);
      return;
    }
    const k = r * K;
    const seq = [
      [0, x0 + r, y0],
      [1, x0 + w - r, y0],
      [2, x0 + w - r + k, y0, x0 + w, y0 + r - k, x0 + w, y0 + r],
      [1, x0 + w, y0 + h - r],
      [2, x0 + w, y0 + h - r + k, x0 + w - r + k, y0 + h, x0 + w - r, y0 + h],
      [1, x0 + r, y0 + h],
      [2, x0 + r - k, y0 + h, x0, y0 + h - r + k, x0, y0 + h - r],
      [1, x0, y0 + r],
      [2, x0, y0 + r - k, x0 + r - k, y0, x0 + r, y0],
    ];
    for (let i = 0; i < seq.length; i++) {
      const q = seq[i];
      if (q[0] === 2) {
        const a = T(q[1], q[2]);
        const b = T(q[3], q[4]);
        const e = T(q[5], q[6]);
        out.push(2, a[0], a[1], b[0], b[1], e[0], e[1]);
      } else {
        const e = T(q[1], q[2]);
        out.push(q[0], e[0], e[1]);
      }
    }
    out.push(3);
    return;
  }
  // Polygon / star.
  const n = p.n || 5;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const steps = p.k === 4 ? n * 2 : n;
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / steps;
    const f = p.k === 4 && i % 2 === 1 ? p.inner || 0.5 : 1;
    const q = T(cx + (Math.cos(a) * w * f) / 2, cy + (Math.sin(a) * h * f) / 2);
    out.push(i === 0 ? 0 : 1, q[0], q[1]);
  }
  out.push(3);
}

/** A shape's geometry in its own space (path and via-node transforms baked in). */
function shapePath(ov: Record<string, number>, n: AnyNode, base: Mat): PathCmds {
  'worklet';
  const out: PathCmds = [];
  const ps = n.paths || [];
  for (let i = 0; i < ps.length; i++) {
    let m = base;
    const via = ps[i].via;
    for (let j = 0; j < via.length; j++) m = mul(m, localOf(ov, via[j]));
    const p = S.paths[ps[i].p];
    m = mul(m, trs(p.x, p.y, p.r, p.sx, p.sy));
    if (p.k === 0) pointsPath(ov, ps[i].p, p, m, out);
    else parametricPath(p, m, out);
  }
  return out;
}

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** Node of the nested "Main Frame" artboard: the diamond with its glints. */
export const DIAMOND_NODE = 0;
/** The close button's circle and X icon. */
const CLOSE_NODES: Record<number, true> = { 35: true, 37: true };
/** The bottom "Got it!" button. Drawn white (orange in the Rive file) so it
 *  stands out against the orange glow at the bottom of the screen. */
const BUTTON_NODE = 39;
const BUTTON_PAINT: ScenePaint = { k: 0, c: 0xffffffff };

/**
 * Draw commands for the whole screen at time `t`, back to front, in artboard
 * units. `hideDiamond` leaves out the center diamond so other content can take
 * its place; `closeShift` moves the close button up by that many units.
 */
export function buildFrame(t: number, hideDiamond = false, closeShift = 0): DrawCmd[] {
  'worklet';
  const ov = evaluate(t);
  const world: Record<number, Mat> = {};
  const list: { id: number; m: Mat; alpha: number; clips: number[] }[] = [];

  const walk = (id: number, parentM: Mat, parentOp: number, clips: number[]) => {
    const n = S.nodes[id];
    if (!n || (hideDiamond && id === DIAMOND_NODE)) return;
    let m = mul(parentM, localOf(ov, id));
    if (closeShift && CLOSE_NODES[id]) m = mul([1, 0, 0, 1, 0, -closeShift], m);
    world[id] = m;
    const op = parentOp * Math.min(1, Math.max(0, nv(ov, id, n, 'op')));
    let cl = clips;
    if (n.clips.length) {
      cl = clips.slice();
      for (let i = 0; i < n.clips.length; i++) cl.push(n.clips[i].src);
    }
    if (n.shape) list.push({ id, m, alpha: op, clips: cl });
    const kids = n.nested === 'mf' ? S.mf.roots : n.kids;
    for (let i = kids.length - 1; i >= 0; i--) walk(kids[i], m, op, cl);
  };
  for (let i = S.ui.roots.length - 1; i >= 0; i--) walk(S.ui.roots[i], IDENTITY, 1, []);

  // Draw rules: place a drawable directly behind ("after") or in front of its target.
  const ordered: typeof list = [];
  const ruled: typeof list = [];
  for (let i = 0; i < list.length; i++) (S.nodes[list[i].id].drawRule ? ruled : ordered).push(list[i]);
  for (let i = 0; i < ruled.length; i++) {
    const rule = S.nodes[ruled[i].id].drawRule as { target: number; after: boolean };
    let ti = -1;
    for (let j = 0; j < ordered.length; j++) if (ordered[j].id === rule.target) ti = j;
    if (ti < 0) ordered.push(ruled[i]);
    else ordered.splice(rule.after ? ti : ti + 1, 0, ruled[i]);
  }

  const cmds: DrawCmd[] = [];
  const clipCache: Record<number, PathCmds> = {};
  for (let i = 0; i < ordered.length; i++) {
    const it = ordered[i];
    const n = S.nodes[it.id];
    const fills = n.fills || [];
    if (!fills.length || it.alpha <= 0) continue;
    const local = shapePath(ov, n, IDENTITY);
    const clips: { path: PathCmds; evenOdd: boolean }[] = [];
    for (let c = 0; c < it.clips.length; c++) {
      const src = it.clips[c];
      if (!clipCache[src]) {
        const sm = world[src] || IDENTITY;
        clipCache[src] = shapePath(ov, S.nodes[src], sm);
      }
      clips.push({ path: clipCache[src], evenOdd: false });
    }
    for (let f = 0; f < fills.length; f++) {
      const fl = fills[f];
      if (!fl.paint) continue;
      cmds.push({
        m: it.m,
        path: local,
        evenOdd: fl.rule === 1,
        paint: it.id === BUTTON_NODE ? BUTTON_PAINT : fl.paint,
        alpha: it.alpha,
        blend: n.blend === undefined ? 3 : n.blend,
        stroke: fl.stroke || 0,
        cap: fl.cap || 0,
        join: fl.join || 0,
        clips,
      });
    }
  }
  return cmds;
}

/** ARGB int -> [r, g, b, a] in 0..1. */
export function argbToRgba(c: number): number[] {
  'worklet';
  return [((c >>> 16) & 255) / 255, ((c >>> 8) & 255) / 255, (c & 255) / 255, ((c >>> 24) & 255) / 255];
}
