// Animowane ludziki do „Nóg na puch”, przeniesione 1:1 z reference/nogi-na-puch.html (obiekt FIG):
// kinematyka odwrotna, klatki kluczowe i podpisy faz ruchu. Zwraca znaczniki SVG jako tekst
// (rysowane w <g> przez innerHTML; treść jest stała, z tego pliku).

type P = [number, number];

interface Pose {
  view: 'side' | 'front';
  hip: P;
  torso: number;
  f1: P;
  f2: P;
  h1: P;
  h2: P;
  f1d?: number;
  f2d?: number;
  as?: number;
  hl?: 'f1' | 'f2' | 'both';
}

interface Joints {
  front: boolean;
  hip: P;
  hip1: P;
  hip2: P;
  sc: P;
  s1: P;
  s2: P;
  head: P;
  l1: [P, P];
  l2: [P, P];
  a1: [P, P];
  a2: [P, P];
  dir: P;
  perp: P;
}

interface Props {
  back: string;
  mid?: string;
  front: string;
}

export interface Exercise {
  poses: Record<string, Pose>;
  kf: [number, string, string?][];
  props?: (J: Joints, p: Pose) => Props;
}

const G = 170;
const TH = 40,
  SH = 40,
  TO = 50,
  UA = 28,
  FA = 26;

function ik(r: P, t: P, a: number, b: number, s: number): [P, P] {
  const dx = t[0] - r[0],
    dy = t[1] - r[1];
  const d = Math.hypot(dx, dy);
  const dd = Math.min(Math.max(d, Math.abs(a - b) + 0.5), a + b - 0.5);
  const base = Math.atan2(dy, dx);
  const c = (a * a + dd * dd - b * b) / (2 * a * dd);
  const al = Math.acos(Math.max(-1, Math.min(1, c)));
  const ang = base + s * al;
  const j: P = [r[0] + a * Math.cos(ang), r[1] + a * Math.sin(ang)];
  const ux = t[0] - j[0],
    uy = t[1] - j[1];
  const ul = Math.hypot(ux, uy) || 1;
  return [j, [j[0] + (b * ux) / ul, j[1] + (b * uy) / ul]];
}

function fold(r: P, t: P, a: number, b: number, out: number): [P, P] {
  const dx = t[0] - r[0],
    dy = t[1] - r[1];
  const d = Math.hypot(dx, dy) || 1;
  const len = a + b - 0.5;
  const e: P = d > len ? [r[0] + (dx * len) / d, r[1] + (dy * len) / d] : t;
  const bend = Math.max(0, 1 - d / (a + b));
  const m: P = [(r[0] + e[0]) / 2, (r[1] + e[1]) / 2];
  return [[m[0] + out * bend * 24, m[1] - bend * 4], e];
}

function joints(p: Pose): Joints {
  const front = p.view === 'front';
  const t = (p.torso * Math.PI) / 180;
  const dir: P = [Math.sin(t), -Math.cos(t)];
  const perp: P = [Math.cos(t), Math.sin(t)];
  const hw = front ? 7 : 0,
    sw = front ? 13 : 0;
  const add = (a: P, v: P, k: number): P => [a[0] + v[0] * k, a[1] + v[1] * k];
  const hip = p.hip;
  const hip1 = add(hip, perp, -hw),
    hip2 = add(hip, perp, hw);
  const sc = add(hip, dir, TO);
  const s1 = add(sc, perp, -sw),
    s2 = add(sc, perp, sw);
  const head = add(add(sc, dir, 16), front ? [0, 0] : perp, front ? 0 : 2);
  const hand1: P = [s1[0] + p.h1[0], s1[1] + p.h1[1]];
  const hand2: P = [s2[0] + p.h2[0], s2[1] + p.h2[1]];
  let l1: [P, P], l2: [P, P], a1: [P, P], a2: [P, P];
  if (front) {
    l1 = fold(hip1, p.f1, TH, SH, -1);
    l2 = fold(hip2, p.f2, TH, SH, 1);
    a1 = fold(s1, hand1, UA, FA, -1);
    a2 = fold(s2, hand2, UA, FA, 1);
  } else {
    l1 = ik(hip, p.f1, TH, SH, -1);
    l2 = ik(hip, p.f2, TH, SH, -1);
    a1 = ik(sc, hand1, UA, FA, p.as || 1);
    a2 = ik(sc, hand2, UA, FA, p.as || 1);
  }
  return { front, hip, hip1, hip2, sc, s1, s2, head, l1, l2, a1, a2, dir, perp };
}

const f = (n: number) => n.toFixed(1);
const line = (pts: P[], cls: string) => `<polyline class="${cls}" points="${pts.map((q) => f(q[0]) + ',' + f(q[1])).join(' ')}"/>`;

function foot(ankle: P, dirx: number, front: boolean, cls: string): string {
  if (front) return `<line class="${cls} ft" x1="${f(ankle[0] - 5)}" y1="${f(ankle[1] + 3)}" x2="${f(ankle[0] + 5)}" y2="${f(ankle[1] + 3)}"/>`;
  return `<line class="${cls} ft" x1="${f(ankle[0] - 3 * dirx)}" y1="${f(ankle[1] + 2)}" x2="${f(ankle[0] + 10 * dirx)}" y2="${f(ankle[1] + 3)}"/>`;
}

export function draw(p: Pose, ex: Exercise): string {
  const J = joints(p);
  const hl = p.hl || '';
  const c1 = hl === 'f1' || hl === 'both' ? 'hl' : J.front ? 'nr' : 'fr';
  const c2 = hl === 'f2' || hl === 'both' ? 'hl' : 'nr';
  const a1c = J.front ? 'nr' : 'fr';
  const r1 = J.front ? J.hip1 : J.hip,
    r2 = J.front ? J.hip2 : J.hip;
  const sr1 = J.front ? J.s1 : J.sc,
    sr2 = J.front ? J.s2 : J.sc;
  const props: Props = ex.props ? ex.props(J, p) : { back: '', front: '' };
  let s = '';
  s += `<ellipse class="shadow" cx="${f(J.hip[0])}" cy="${G + 1}" rx="${f(26 - Math.max(0, G - 80 - J.hip[1]) * 0.2)}" ry="3"/>`;
  s += props.back;
  s += line([r1, J.l1[0], J.l1[1]], 'limb ' + c1);
  s += foot(J.l1[1], p.f1d || 1, J.front, c1);
  if (!J.front) s += line([sr1, J.a1[0], J.a1[1]], 'limb arm ' + a1c);
  if (props.mid) s += props.mid;
  s += line(
    J.front
      ? [
          [(J.hip1[0] + J.hip2[0]) / 2, J.hip[1]],
          J.sc,
        ]
      : [J.hip, J.sc],
    'torso',
  );
  if (J.front) s += line([J.hip1, J.hip2], 'limb nr') + line([J.s1, J.s2], 'limb nr');
  s += `<circle class="head" cx="${f(J.head[0])}" cy="${f(J.head[1])}" r="9"/>`;
  s += line([r2, J.l2[0], J.l2[1]], 'limb ' + c2);
  s += foot(J.l2[1], p.f2d || 1, J.front, c2);
  if (J.front) s += line([sr1, J.a1[0], J.a1[1]], 'limb arm nr');
  s += line([sr2, J.a2[0], J.a2[1]], 'limb arm nr');
  s += props.front;
  return s;
}

function lerp<T>(a: T, b: T, t: number): T {
  if (typeof a === 'number' && typeof b === 'number') return (a + (b - a) * t) as T;
  if (Array.isArray(a)) return a.map((v, i) => lerp(v, (b as unknown[])[i], t)) as T;
  if (a && typeof a === 'object') {
    const o: Record<string, unknown> = {};
    for (const k in a) o[k] = k in (b as object) ? lerp(a[k], (b as Record<string, unknown>)[k], t) : a[k];
    return o as T;
  }
  return a;
}
const ease = (t: number) => t * t * (3 - 2 * t);

export function poseAt(ex: Exercise, time: number): { pose: Pose; label: string } {
  const kf = ex.kf,
    total = kf[kf.length - 1][0];
  const tt = ((time % total) + total) % total;
  for (let i = 0; i < kf.length - 1; i++) {
    const [t0, p0] = kf[i],
      [t1, p1, label] = kf[i + 1];
    if (tt >= t0 && tt <= t1) {
      const k = t1 > t0 ? ease((tt - t0) / (t1 - t0)) : 1;
      return { pose: lerp(ex.poses[p0], ex.poses[p1], k), label: label ?? '' };
    }
  }
  return { pose: ex.poses[kf[0][1]], label: kf[1][2] ?? '' };
}

const ground = `<line class="ground" x1="0" y1="${G}" x2="200" y2="${G}"/>`;
const plate = (c: P, r: number) => `<circle class="plate" cx="${f(c[0])}" cy="${f(c[1])}" r="${r}"/><circle class="hub" cx="${f(c[0])}" cy="${f(c[1])}" r="2.5"/>`;
const db = (c: P) => `<rect class="db" x="${f(c[0] - 7)}" y="${f(c[1] - 3.5)}" width="14" height="7" rx="2.5"/>`;
const box = (x1: number, x2: number, y: number) => `<rect class="box" x="${x1}" y="${y}" width="${x2 - x1}" height="${G - y}" rx="2"/>`;

type PoseIn = Omit<Pose, 'view'>;
const side = (o: PoseIn): Pose => ({ view: 'side', f1d: 1, f2d: 1, ...o });
const front = (o: PoseIn): Pose => ({ view: 'front', ...o });

export const EX: Record<string, Exercise> = {
  skater: {
    poses: {
      R: front({ hip: [140, 112], torso: -8, f1: [118, 138], f2: [152, 165], h1: [28, 32], h2: [12, 40] }),
      A: front({ hip: [100, 70], torso: 0, f1: [90, 142], f2: [110, 142], h1: [-18, 30], h2: [18, 30] }),
      L: front({ hip: [60, 112], torso: 8, f1: [48, 165], f2: [82, 138], h1: [-12, 40], h2: [-28, 32] }),
    },
    kf: [
      [0, 'R'],
      [1.2, 'R', 'utrzymaj lądowanie'],
      [1.6, 'A', 'odbicie w bok'],
      [2.0, 'L', 'miękkie lądowanie'],
      [3.2, 'L', 'utrzymaj lądowanie'],
      [3.6, 'A', 'odbicie w bok'],
      [4.0, 'R', 'miękkie lądowanie'],
    ],
    props: () => ({ back: ground, front: '' }),
  },
  squat: {
    poses: {
      up: side({ hip: [95, 88], torso: 6, f1: [97, 165], f2: [100, 165], h1: [-14, 6], h2: [-12, 8], as: -1 }),
      down: side({ hip: [78, 128], torso: 38, f1: [97, 165], f2: [100, 165], h1: [-14, 6], h2: [-12, 8], as: -1 }),
    },
    kf: [
      [0, 'up'],
      [0.6, 'up', 'start'],
      [3.6, 'down', 'w dół 3 s'],
      [4.1, 'down', 'pauza na dole'],
      [5.1, 'up', 'w górę 1 s'],
    ],
    props: (J) => ({ back: ground, front: plate([J.sc[0] - J.perp[0] * 6 + J.dir[0] * 2, J.sc[1] - J.perp[1] * 6 + J.dir[1] * 2], 12) }),
  },
  rdl: {
    poses: {
      up: side({ hip: [93, 89], torso: 4, f1: [97, 165], f2: [100, 165], h1: [4, 52], h2: [6, 51] }),
      down: side({ hip: [68, 104], torso: 70, f1: [97, 165], f2: [100, 165], h1: [-6, 50], h2: [-4, 49] }),
    },
    kf: [
      [0, 'up'],
      [0.6, 'up', 'start'],
      [3.6, 'down', 'biodra w tył 3 s'],
      [4.1, 'down', 'rozciągnięcie tyłu uda'],
      [5.1, 'up', 'biodra w przód'],
    ],
    props: (J) => ({ back: ground, front: plate(J.a2[1], 15) }),
  },
  bulgarian: {
    poses: {
      up: side({ hip: [88, 96], torso: 8, f1: [46, 136], f2: [120, 165], f1d: -1, h1: [0, 52], h2: [2, 52], hl: 'f2' }),
      down: side({ hip: [83, 128], torso: 16, f1: [46, 136], f2: [120, 165], f1d: -1, h1: [0, 52], h2: [2, 52], hl: 'f2' }),
    },
    kf: [
      [0, 'up'],
      [0.6, 'up', 'start'],
      [3.1, 'down', 'w dół 2–3 s'],
      [3.5, 'down', 'tylne kolano nad podłogą'],
      [4.6, 'up', 'w górę'],
    ],
    props: (J) => ({
      back:
        ground +
        `<rect class="box" x="14" y="140" width="40" height="8" rx="2"/><rect class="box" x="18" y="148" width="5" height="22"/><rect class="box" x="45" y="148" width="5" height="22"/>`,
      mid: db(J.a1[1]),
      front: db(J.a2[1]),
    }),
  },
  stepup: {
    poses: {
      down: side({ hip: [92, 104], torso: 18, f1: [80, 165], f2: [128, 136], h1: [-2, 50], h2: [4, 50], hl: 'f2' }),
      up: side({ hip: [126, 60], torso: 4, f1: [166, 100], f2: [128, 136], h1: [4, 49], h2: [-2, 50], hl: 'f2' }),
    },
    kf: [
      [0, 'down'],
      [0.6, 'down', 'start'],
      [1.6, 'up', 'w górę siłą przedniej nogi'],
      [2.2, 'up', 'kolano wysoko'],
      [4.2, 'down', 'powoli w dół 2 s'],
    ],
    props: (J) => ({ back: ground + box(104, 160, 140), mid: db(J.a1[1]), front: db(J.a2[1]) }),
  },
  stepdown: {
    poses: {
      up: side({ hip: [106, 60], torso: 4, f1: [128, 126], f2: [110, 136], h1: [22, 32], h2: [26, 30], hl: 'f2' }),
      down: side({ hip: [98, 94], torso: 24, f1: [134, 164], f2: [110, 136], h1: [30, 22], h2: [34, 20], hl: 'f2' }),
    },
    kf: [
      [0, 'up'],
      [0.6, 'up', 'start'],
      [4.6, 'down', 'w dół 4 s'],
      [5.0, 'down', 'pięta dotyka podłogi'],
      [6.0, 'up', 'w górę'],
    ],
    props: () => ({ back: ground + box(62, 122, 140), front: '' }),
  },
  nordic: {
    poses: {
      up: side({ hip: [70, 126], torso: 0, f1: [30, 165], f2: [32, 165], f1d: -1, f2d: -1, h1: [12, 22], h2: [14, 20], hl: 'both' }),
      mid: side({ hip: [88.8, 130.7], torso: 28, f1: [30, 165], f2: [32, 165], f1d: -1, f2d: -1, h1: [12, 22], h2: [14, 20], hl: 'both' }),
      low: side({ hip: [102.8, 143.1], torso: 55, f1: [30, 165], f2: [32, 165], f1d: -1, f2d: -1, h1: [16, 28], h2: [18, 26], hl: 'both' }),
      catch: side({ hip: [108.8, 156.3], torso: 76, f1: [30, 165], f2: [32, 165], f1d: -1, f2d: -1, h1: [4, 24], h2: [6, 24], hl: 'both' }),
    },
    kf: [
      [0, 'up'],
      [0.6, 'up', 'start'],
      [2.6, 'mid', 'powoli w przód'],
      [4.6, 'low', 'hamuj tyłem uda'],
      [5.2, 'catch', 'złap się rękami'],
      [5.7, 'catch', 'odepchnij się'],
      [7.0, 'up', 'wróć do góry'],
    ],
    props: () => ({ back: ground + `<rect class="box" x="56" y="164" width="30" height="6" rx="2"/>`, front: `<rect class="strap" x="20" y="158" width="20" height="6" rx="2"/>` }),
  },
  stance: {
    poses: {
      a: front({ hip: [110, 112], torso: -2, f1: [68, 163], f2: [132, 163], h1: [-12, 36], h2: [12, 36], hl: 'f2' }),
      b: front({ hip: [112, 122], torso: -1, f1: [68, 163], f2: [132, 163], h1: [-14, 32], h2: [14, 32], hl: 'f2' }),
    },
    kf: [
      [0, 'a'],
      [1.4, 'a', 'trzymaj'],
      [1.9, 'b', 'amortyzuj'],
      [2.4, 'a', 'trzymaj'],
      [2.9, 'b', 'amortyzuj'],
      [3.6, 'a', 'trzymaj'],
    ],
    props: () => ({
      back: `<line class="ground snow" x1="0" y1="${G + 2}" x2="200" y2="${G + 2}"/>`,
      front: `<path class="board" d="M36 160 Q38 168 50 168 L152 168 Q162 168 164 163"/>`,
    }),
  },
};
