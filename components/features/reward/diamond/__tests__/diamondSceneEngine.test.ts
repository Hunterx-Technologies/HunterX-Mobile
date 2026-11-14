import { buildFrame, type DrawCmd } from '../diamondSceneEngine';

// The native renderer builds a command's path, clips and paint once and
// reuses them whenever the engine gives it a key. A key must therefore always
// stand for the same content — or the screen would draw stale artwork.

const frames = (hideDiamond: boolean, closeShift: number) =>
  Array.from({ length: 600 }, (_, i) => buildFrame(i / 60, hideDiamond, closeShift)).concat(
    // Past the first loop and the one-shot intro.
    Array.from({ length: 60 }, (_, i) => buildFrame(9 + i / 37, hideDiamond, closeShift))
  );

it.each([
  [true, 0],
  [true, 31.25],
  [false, 0],
  [false, 31.25],
])('each cache key always means the same content (hideDiamond=%s, closeShift=%s)', (hide, shift) => {
  const seen = new Map<string, string>();
  const check = (key: string | null, content: unknown) => {
    if (!key) return;
    const s = JSON.stringify(content);
    const prev = seen.get(key);
    if (prev === undefined) seen.set(key, s);
    else expect(s).toBe(prev);
  };
  for (const cmds of frames(hide, shift)) {
    for (const c of cmds) {
      check(c.pathKey, [c.path, c.evenOdd]);
      check(c.paintKey, [c.paint, c.alpha, c.blend, c.stroke, c.cap, c.join]);
      c.clips.forEach((clip) => check(clip.key, [clip.path, clip.evenOdd]));
    }
  }
});

it('on the reward and level-up screens (no diamond), nothing but the transforms is rebuilt per frame', () => {
  const fullyCached = (c: DrawCmd) => !!c.pathKey && !!c.paintKey && c.clips.every((clip) => !!clip.key);
  for (const cmds of frames(true, 12)) {
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds.every(fullyCached)).toBe(true);
  }
});
