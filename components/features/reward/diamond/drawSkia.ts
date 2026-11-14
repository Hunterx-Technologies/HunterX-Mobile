import { ClipOp, FillType, PaintStyle, Skia, TileMode, type SkCanvas, type SkPaint, type SkPath } from '@shopify/react-native-skia';

import { argbToRgba, type DrawCmd, type PathCmds, type ScenePaint } from './diamondSceneEngine';

// Native renderer for the diamond scene: plays the engine's draw commands on a
// Skia canvas. Runs as a worklet inside the animated picture, every frame.
//
// Paths, clips and paints the engine marks as unchanging (a key on the
// command) are built once and kept on the UI runtime. Building ~150 Skia
// objects per frame instead kept the UI thread busy and its garbage
// collector running, which froze low-end Android phones on the reward and
// level-up screens.

function toSkPath(cmds: PathCmds, evenOdd: boolean): SkPath {
  'worklet';
  const p = Skia.Path.Make();
  for (let i = 0; i < cmds.length; ) {
    const op = cmds[i];
    if (op === 0) {
      p.moveTo(cmds[i + 1], cmds[i + 2]);
      i += 3;
    } else if (op === 1) {
      p.lineTo(cmds[i + 1], cmds[i + 2]);
      i += 3;
    } else if (op === 2) {
      p.cubicTo(cmds[i + 1], cmds[i + 2], cmds[i + 3], cmds[i + 4], cmds[i + 5], cmds[i + 6]);
      i += 7;
    } else {
      p.close();
      i += 1;
    }
  }
  p.setFillType(evenOdd ? FillType.EvenOdd : FillType.Winding);
  return p;
}

function color(c: number, alphaMul: number) {
  'worklet';
  const [r, g, b, a] = argbToRgba(c);
  return Skia.Color(new Float32Array([r, g, b, a * alphaMul]));
}

function makePaint(cmd: DrawCmd): SkPaint {
  'worklet';
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setBlendMode(cmd.blend);
  const pt: ScenePaint = cmd.paint;
  if (pt.k === 0) {
    paint.setColor(color(pt.c as number, cmd.alpha));
  } else {
    const cols = (pt.cols || []).map((c) => color(c, (pt.op ?? 1) * cmd.alpha));
    const pos = (pt.pos || []).map((p) => Math.min(1, Math.max(0, p)));
    const sx = pt.sx as number;
    const sy = pt.sy as number;
    const ex = pt.ex as number;
    const ey = pt.ey as number;
    paint.setShader(
      pt.k === 1
        ? Skia.Shader.MakeLinearGradient({ x: sx, y: sy }, { x: ex, y: ey }, cols, pos, TileMode.Clamp)
        : Skia.Shader.MakeRadialGradient({ x: sx, y: sy }, Math.hypot(ex - sx, ey - sy), cols, pos, TileMode.Clamp)
    );
  }
  if (cmd.stroke > 0) {
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(cmd.stroke);
    paint.setStrokeCap(cmd.cap);
    paint.setStrokeJoin(cmd.join);
  }
  return paint;
}

// Worklet helpers must be defined before the worklets that use them: in
// release builds each one copies its dependencies when it's defined.
type SkObjectCache = { paths: Record<string, SkPath>; paints: Record<string, SkPaint>; size: number };
// Entries are per shape; the cap only matters if keys ever start to vary.
const CACHE_LIMIT = 400;

function skCache(): SkObjectCache {
  'worklet';
  const g = globalThis as unknown as { __hxDiamondSkCache?: SkObjectCache };
  if (!g.__hxDiamondSkCache || g.__hxDiamondSkCache.size > CACHE_LIMIT) {
    g.__hxDiamondSkCache = { paths: {}, paints: {}, size: 0 };
  }
  return g.__hxDiamondSkCache;
}

function cachedPath(cache: SkObjectCache, key: string | null, cmds: PathCmds, evenOdd: boolean): SkPath {
  'worklet';
  if (!key) return toSkPath(cmds, evenOdd);
  let p = cache.paths[key];
  if (!p) {
    p = toSkPath(cmds, evenOdd);
    cache.paths[key] = p;
    cache.size++;
  }
  return p;
}

/** Draws `cmds` onto `canvas`, whose current matrix maps artboard units to pixels. */
export function drawCommandsSkia(canvas: SkCanvas, cmds: DrawCmd[]) {
  'worklet';
  const cache = skCache();
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    canvas.save();
    for (let c = 0; c < cmd.clips.length; c++) {
      const clip = cmd.clips[c];
      canvas.clipPath(cachedPath(cache, clip.key, clip.path, clip.evenOdd), ClipOp.Intersect, true);
    }
    const m = cmd.m;
    canvas.concat(Skia.Matrix([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]));
    let paint = cmd.paintKey ? cache.paints[cmd.paintKey] : undefined;
    if (!paint) {
      paint = makePaint(cmd);
      if (cmd.paintKey) {
        cache.paints[cmd.paintKey] = paint;
        cache.size++;
      }
    }
    canvas.drawPath(cachedPath(cache, cmd.pathKey, cmd.path, cmd.evenOdd), paint);
    canvas.restore();
  }
}
