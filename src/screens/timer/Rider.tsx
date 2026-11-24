import { useEffect, useRef } from 'react';

// Mały rowerzysta jadący po przebiegu treningu. Kręci z docelową kadencją odcinka,
// a na pauzie stoi. Rysowany bezpośrednio w DOM w requestAnimationFrame (bez renderów Reacta).

type P = [number, number];

const HIP: P = [19, 13.5];
const CRANK: P = [22.5, 26];
const CRANK_LEN = 4.2;
const THIGH = 9.6;
const SHIN = 9.6;
const WHEELS: P[] = [
  [10, 26],
  [38, 26],
];

/** Dwuczłonowa kinematyka odwrotna: gdzie jest kolano, gdy biodro i pedał są ustalone. */
function knee(root: P, target: P, a: number, b: number): P {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.1), a + b - 0.1);
  const base = Math.atan2(dy, dx);
  const al = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const ang = base - al; // kolano do przodu (w stronę kierownicy)
  return [root[0] + a * Math.cos(ang), root[1] + a * Math.sin(ang)];
}

const pts = (...p: P[]) => p.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' ');

function legPoints(angle: number): string {
  const pedal: P = [CRANK[0] + CRANK_LEN * Math.cos(angle), CRANK[1] + CRANK_LEN * Math.sin(angle)];
  return pts(HIP, knee(HIP, pedal, THIGH, SHIN), pedal);
}

/** Średnia kadencja z opisu odcinka, np. „55–65” → 60, „90+” → 90. */
export function cadenceRpm(cadence: string): number {
  const n = (cadence.match(/\d+/g) ?? []).map(Number);
  if (n.length === 0) return 85;
  return n.length === 1 ? n[0] : (n[0] + n[1]) / 2;
}

export function Rider({ rpm, running }: { rpm: number; running: boolean }) {
  const nearLeg = useRef<SVGPolylineElement>(null);
  const farLeg = useRef<SVGPolylineElement>(null);
  const wheels = useRef<SVGGElement[]>([]);
  const angle = useRef(0.6);

  useEffect(() => {
    const draw = () => {
      const a = angle.current;
      nearLeg.current?.setAttribute('points', legPoints(a));
      farLeg.current?.setAttribute('points', legPoints(a + Math.PI));
      const deg = ((a * 2.6 * 180) / Math.PI) % 360;
      wheels.current.forEach((w, i) => w?.setAttribute('transform', `rotate(${deg.toFixed(1)} ${WHEELS[i][0]} ${WHEELS[i][1]})`));
    };
    draw();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!running || reduce) return;
    let raf = 0;
    let last: number | null = null;
    const loop = (ts: number) => {
      if (last !== null) angle.current += ((ts - last) / 1000) * (rpm / 60) * 2 * Math.PI;
      last = ts;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rpm, running]);

  return (
    <svg className="t-rider" viewBox="0 0 48 36" aria-hidden="true">
      <polyline ref={farLeg} className="r-leg r-far" />
      {WHEELS.map(([x, y], i) => (
        <g
          key={i}
          ref={(el) => {
            if (el) wheels.current[i] = el;
          }}
        >
          <circle className="r-wheel" cx={x} cy={y} r={7.6} />
          <path className="r-spoke" d={`M${x - 7.6} ${y}H${x + 7.6}M${x} ${y - 7.6}V${y + 7.6}`} />
        </g>
      ))}
      <polyline className="r-frame" points={pts(WHEELS[0], CRANK, [34, 14.5], [19.5, 14.5], WHEELS[0])} />
      <polyline className="r-frame" points={pts([19.5, 14.5], CRANK)} />
      <polyline className="r-frame" points={pts(WHEELS[1], [34, 14.5], [35, 11], [37.5, 11.5])} />
      <polyline className="r-arm" points={pts([29.5, 6.5], [33.5, 9.5], [37, 11])} />
      <polyline className="r-body" points={pts(HIP, [29.5, 6.5])} />
      <circle className="r-head" cx={32.6} cy={3.6} r={3.1} />
      <polyline ref={nearLeg} className="r-leg" />
    </svg>
  );
}
