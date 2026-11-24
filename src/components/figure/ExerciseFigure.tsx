import { useEffect, useRef, useState } from 'react';
import { draw, EX, poseAt } from './fig';
import './figure.css';

/** Animowany ludzik ćwiczenia. Gra tylko, gdy jest widoczny na ekranie. */
export function ExerciseFigure({ exerciseKey, name }: { exerciseKey: string; name: string }) {
  const ex = EX[exerciseKey];
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [reduce] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [playing, setPlaying] = useState(!reduce);

  useEffect(() => {
    if (!ex || !gRef.current || !svgRef.current) return;
    const g = gRef.current;
    let t = reduce ? ex.kf[2][0] : 0;
    let last: number | null = null;
    let visible = true;
    let raf = 0;
    const paint = () => {
      const r = poseAt(ex, t);
      g.innerHTML = draw(r.pose, ex);
      if (labelRef.current) labelRef.current.textContent = playing ? r.label : '';
    };
    paint();
    if (!playing) return;
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (es) =>
              es.forEach((e) => {
                visible = e.isIntersecting;
                last = null;
              }),
            { rootMargin: '80px' },
          )
        : null;
    io?.observe(svgRef.current);
    const loop = (ts: number) => {
      if (visible) {
        if (last !== null) t += (ts - last) / 1000;
        last = ts;
        paint();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [ex, playing, reduce]);

  if (!ex) return null;
  return (
    <figure className="fig">
      <svg ref={svgRef} viewBox="0 -20 200 196" role="img" aria-label={`Animacja: ${name}`}>
        <g ref={gRef} />
      </svg>
      <figcaption className="fig-bar">
        <span ref={labelRef} className="fig-now" aria-hidden="true" />
        <button type="button" className="fig-play" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pauza' : 'Odtwórz'}
        </button>
      </figcaption>
    </figure>
  );
}
