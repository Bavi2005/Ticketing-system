// Central locale-aware formatting. Currency is configurable via VITE_CURRENCY
// (defaults to MYR — adjust to your market).

const CURRENCY = import.meta.env.VITE_CURRENCY || 'MYR';

const money = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: CURRENCY,
  currencyDisplay: 'symbol',
  minimumFractionDigits: 2,
});

export function formatCurrency(amount = 0) {
  return money.format(Number(amount) || 0);
}

export function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(date));
}

export function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = new Intl.DateTimeFormat('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(d);
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(d);
}

export function formatFileSize(bytes = 0) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 3);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${['B', 'KB', 'MB', 'GB'][i]}`;
}

export function timeAgoExpiry(date) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days < 30) return `Expires in ${days} days`;
  return `Expires ${formatDate(date)}`;
}
