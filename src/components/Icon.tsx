// Ikony liniowe 24×24, dekoracyjne (aria-hidden) — opis daje przycisk.
const PATHS = {
  today: 'M3 20h18M5 20l5.5-9 3 4.5L16 12l3 8M12 4v2M6.5 6.5l1.4 1.4M17.5 6.5l-1.4 1.4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  settings:
    'M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14M16 5v14',
  prev: 'M18 5 8 12l10 7zM6 5v14',
  next: 'M6 5l10 7-10 7zM18 5v14',
  soundOn: 'M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  soundOff: 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6',
  voice: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  stop: 'M6 6h12v12H6z',
  back: 'M15 5l-7 7 7 7',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
