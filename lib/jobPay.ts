export function salaryRange(min?: number | null, max?: number | null, currency?: string | null, period?: string | null) {
  if (!currency || typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || min > max) return undefined;
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const amount = min === max ? format.format(min) : format.format(min) + '–' + format.format(max);
  const unit = period?.toLowerCase().replace(/^1 /, '');
  return currency + ' ' + amount + (unit && unit !== 'none' ? ' / ' + unit : '');
}

export function greenhouseSalary(content = '') {
  if (!content.includes('pay-range')) return undefined;
  const markup = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&(?:mdash|ndash);/g, '–').replace(/&nbsp;/g, ' ').trim();
  const ranges = Array.from(markup.matchAll(/(?:<div class="title">([^<]*)<\/div>\s*)?<div class="pay-range">([\s\S]*?)<\/div>/g), match =>
    [text(match[1] ?? ''), text(match[2])].filter(Boolean).join(' · '));
  return Array.from(new Set(ranges)).join(' / ') || undefined;
}
