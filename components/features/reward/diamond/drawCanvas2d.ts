import { argbToRgba, type DrawCmd, type PathCmds } from './diamondSceneEngine';

// Web renderer for the diamond scene: plays the engine's draw commands on a
// 2D canvas (react-native-skia needs CanvasKit on web, which this app does not
// load).

const BLEND: Record<number, GlobalCompositeOperation> = {
  3: 'source-over',
  12: 'lighter',
  14: 'screen',
  15: 'overlay',
  16: 'darken',
  17: 'lighten',
  18: 'color-dodge',
  19: 'color-burn',
  20: 'hard-light',
  21: 'soft-light',
  22: 'difference',
  23: 'exclusion',
  24: 'multiply',
  25: 'hue',
  26: 'saturation',
  27: 'color',
  28: 'luminosity',
};

const CAP: CanvasLineCap[] = ['butt', 'round', 'square'];
const JOIN: CanvasLineJoin[] = ['miter', 'round', 'bevel'];

function toPath2D(cmds: PathCmds): Path2D {
  const p = new Path2D();
  for (let i = 0; i < cmds.length; ) {
    const op = cmds[i];
    if (op === 0) {
      p.moveTo(cmds[i + 1], cmds[i + 2]);
      i += 3;
    } else if (op === 1) {
      p.lineTo(cmds[i + 1], cmds[i + 2]);
      i += 3;
    } else if (op === 2) {
      p.bezierCurveTo(cmds[i + 1], cmds[i + 2], cmds[i + 3], cmds[i + 4], cmds[i + 5], cmds[i + 6]);
      i += 7;
    } else {
      p.closePath();
      i += 1;
    }
  }
  return p;
}

function css(c: number, alphaMul: number): string {
  const [r, g, b, a] = argbToRgba(c);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a * alphaMul})`;
}

/** Draws `cmds` with `base` = [a, b, c, d, e, f] mapping artboard units to canvas pixels. */
export function drawCommands(ctx: CanvasRenderingContext2D, cmds: DrawCmd[], base: number[]) {
  const pathCache = new Map<PathCmds, Path2D>();
  const path2d = (c: PathCmds) => {
    let p = pathCache.get(c);
    if (!p) {
      p = toPath2D(c);
      pathCache.set(c, p);
    }
    return p;
  };
  for (const cmd of cmds) {
    ctx.save();
    ctx.setTransform(base[0], base[1], base[2], base[3], base[4], base[5]);
    for (const clip of cmd.clips) ctx.clip(path2d(clip.path), clip.evenOdd ? 'evenodd' : 'nonzero');
    const m = cmd.m;
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.globalCompositeOperation = BLEND[cmd.blend] || 'source-over';
    const paint = cmd.paint;
    let style: string | CanvasGradient;
    if (paint.k === 0) {
      style = css(paint.c as number, 1);
    } else {
      const g =
        paint.k === 1
          ? ctx.createLinearGradient(paint.sx as number, paint.sy as number, paint.ex as number, paint.ey as number)
          : ctx.createRadialGradient(
              paint.sx as number,
              paint.sy as number,
              0,
              paint.sx as number,
              paint.sy as number,
              Math.hypot((paint.ex as number) - (paint.sx as number), (paint.ey as number) - (paint.sy as number))
            );
      const cols = paint.cols || [];
      const pos = paint.pos || [];
      for (let i = 0; i < cols.length; i++) g.addColorStop(Math.min(1, Math.max(0, pos[i])), css(cols[i], paint.op ?? 1));
      style = g;
    }
    ctx.globalAlpha = cmd.alpha;
    const p = path2d(cmd.path);
    if (cmd.stroke > 0) {
      ctx.strokeStyle = style;
      ctx.lineWidth = cmd.stroke;
      ctx.lineCap = CAP[cmd.cap] || 'butt';
      ctx.lineJoin = JOIN[cmd.join] || 'miter';
      ctx.stroke(p);
    } else {
      ctx.fillStyle = style;
      ctx.fill(p, cmd.evenOdd ? 'evenodd' : 'nonzero');
    }
    ctx.restore();
  }
}
