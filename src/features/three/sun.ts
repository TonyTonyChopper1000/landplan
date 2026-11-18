/** Approximate solar position (NOAA) for a date/time in IST at the given latitude/longitude. */
export function sunPosition(date: Date, lat = 17.385, lon = 78.4867): { elevation: number; azimuth: number } {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const n = Math.floor((date.getTime() - start) / 86400000);
  const g = ((2 * Math.PI) / 365) * (n - 1 + (date.getUTCHours() - 12) / 24);
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  const tst = utcMin + eot + 4 * lon;
  const ha = (tst / 4 - 180) * rad;
  const phi = lat * rad;
  const cosZen = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / rad + 180;
  return { elevation: 90 - zen / rad, azimuth: (az + 360) % 360 };
}

/** IST wall-clock → Date. */
export function istDate(dayOfYear: number, minutes: number, year = 2026): Date {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(dayOfYear);
  d.setUTCMinutes(minutes - 330);
  return d;
}
