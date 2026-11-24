import { memo } from 'react';
import { zoneOfPct } from '../domain/zones';

interface Props {
  /** Pary [sekundy, %FTP]. */
  parts: { sec: number; pct: number }[];
  height?: number;
  className?: string;
}

const MAX_PCT = 160;
const TOP = 6;

/** Wysokość słupka jako ułamek wysokości wykresu (rowerzysta w timerze jedzie po wierzchu słupków). */
export function barFraction(pct: number, height: number): number {
  return Math.max(5, (Math.min(pct, MAX_PCT) / MAX_PCT) * (height - TOP)) / height;
}

/** Przebieg treningu: słupki w kolorach stref, przerywana linia = FTP. */
export const Profile = memo(function Profile({ parts, height = 84, className }: Props) {
  const total = parts.reduce((a, p) => a + p.sec, 0) || 1;
  const y = (p: number) => height - Math.max(5, (Math.min(p, MAX_PCT) / MAX_PCT) * (height - TOP));
  let x = 0;
  const ftpY = y(100);
  return (
    <svg className={className} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {parts.map((p, i) => {
        const w = (p.sec / total) * 1000;
        const top = y(p.pct);
        const rect = (
          <rect key={i} x={x} y={top} width={Math.max(w - 1.2, 0.8)} height={height - top} fill={`var(--zone-${zoneOfPct(p.pct)})`} />
        );
        x += w;
        return rect;
      })}
      <line x1="0" x2="1000" y1={ftpY} y2={ftpY} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
});
