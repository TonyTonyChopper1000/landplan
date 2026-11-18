const P: Record<string, string> = {
  site: 'M3 17 7 5l6 4 4-3 2 11z M3 17h16',
  constraints: 'M3 12c3-4 6 4 9 0s6 4 9 0 M3 17c3-4 6 4 9 0s6 4 9 0 M12 3v4',
  plots: 'M3 4h18v16H3z M3 12h18 M9 4v16 M15 4v16',
  roads: 'M8 3 5 21 M16 3l3 18 M12 4v3 M12 10v4 M12 17v3',
  open: 'M12 3a5 5 0 0 1 5 5c0 3-2 5-5 5s-5-2-5-5a5 5 0 0 1 5-5z M12 13v8 M8 21h8',
  built: 'M4 21V10l8-6 8 6v11z M9 21v-6h6v6',
  money: 'M7 4h10 M7 9h10 M10 4c5 0 5 9 0 9H7l8 8',
  play: 'M7 4v16l13-8z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 21h16',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z M20 20l-4-4',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  undo: 'M9 14 4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'm15 14 5-5-5-5 M20 9H9a5 5 0 0 0 0 10h3',
  chat: 'M4 5h16v11H9l-5 4z',
  close: 'M6 6l12 12 M18 6 6 18',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  plus: 'M12 5v14 M5 12h14',
  copy: 'M8 8h12v12H8z M4 16V4h12',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  lasso: 'M12 4c5 0 8 2 8 5s-4 5-8 5-8-2-8-5 3-5 8-5z M7 13c-1 3 1 5 3 5 M10 18l-1 3',
  cursor: 'M5 3l14 8-6 2-2 6z',
  chevron: 'M9 6l6 6-6 6',
  check: 'M4 12l5 5L20 6',
  alert: 'M12 3 2 21h20z M12 10v5 M12 18v.5',
  layers: 'M12 3 2 8l10 5 10-5z M2 13l10 5 10-5',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  cube: 'M12 2 3 7v10l9 5 9-5V7z M3 7l9 5 9-5 M12 12v10',
  table: 'M3 4h18v16H3z M3 9h18 M3 14h18 M9 4v16',
  shield: 'M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z M20 4h-6 M20 4v13h-6',
  compare: 'M12 3v18 M4 7h5v10H4z M15 7h5v10h-5z',
  grid: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
  target: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  rotate: 'M20 12a8 8 0 1 1-3-6.2 M20 4v5h-5',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 16, className }: { name: IconName | string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={P[name] ?? P.grid} />
    </svg>
  );
}
