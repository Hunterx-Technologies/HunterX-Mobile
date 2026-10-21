import { ClipOp, FillType, PaintStyle, Skia, TileMode, type SkCanvas, type SkPath } from '@shopify/react-native-skia';

import { argbToRgba, type DrawCmd, type PathCmds } from './diamondSceneEngine';

// Native renderer for the diamond scene: plays the engine's draw commands on a
// Skia canvas. Runs as a worklet inside the animated picture.

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

/** Draws `cmds` onto `canvas`, whose current matrix maps artboard units to pixels. */
export function drawCommandsSkia(canvas: SkCanvas, cmds: DrawCmd[]) {
  'worklet';
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    canvas.save();
    for (let c = 0; c < cmd.clips.length; c++) {
      canvas.clipPath(toSkPath(cmd.clips[c].path, cmd.clips[c].evenOdd), ClipOp.Intersect, true);
    }
    const m = cmd.m;
    canvas.concat(Skia.Matrix([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setBlendMode(cmd.blend);
    const pt = cmd.paint;
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
    canvas.drawPath(toSkPath(cmd.path, cmd.evenOdd), paint);
    canvas.restore();
  }
}
