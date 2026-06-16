// Tarih formatları — gün/ay/yıl (d/m/YYYY), başında sıfır olmadan.

export function formatDate(input: string | number | Date): string {
  const d = new Date(input);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function formatDateTime(input: string | number | Date): string {
  const d = new Date(input);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${mm}`;
}
