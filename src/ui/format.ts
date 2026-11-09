export const number = (n: number, digits = 1) => new Intl.NumberFormat('da-DK', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
export const money = (n: number | null, digits = 2) => n === null ? '\u2014' : number(n, digits) + ' kr';
export const km = (metres: number) => number(metres / 1000, 1);
export function duration(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return (seconds >= 3600 ? Math.floor(seconds / 3600) + ':' : '') + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
export const dateLabel = (time: number, zone = 'Europe/Copenhagen') => new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(time));
