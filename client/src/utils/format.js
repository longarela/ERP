const currencyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat('es-AR');

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}
export function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}
export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') : value);
  return d.toLocaleDateString('es-AR');
}
export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value.replace(' ', 'T'));
  return d.toLocaleString('es-AR');
}
