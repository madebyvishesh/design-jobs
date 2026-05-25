export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  // epoch sentinel = date unknown
  if (date.getFullYear() < 2000) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'today';
  if (diffDays < 7) return `${diffDays}d ago`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 9) return `${weeks}w ago`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months}mo ago`;
  return '1y+ ago';
}
