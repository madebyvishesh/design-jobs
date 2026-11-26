export function remoteLocation(raw: string) {
  // Some portals list the office first, then the actual remote region.
  const alternative = raw.match(/\s\/\sremote\b(.*)$/i);
  const place = (alternative ? alternative[1] : raw)
    .replace(/^remote(?:\s+location)?(?=\s|$|[:(,|–—-])/i, '')
    .replace(/^[\s,:|–—-]+/, '').replace(/\s*\(remote\)$/i, '').trim()
    .replace(/^\(([^()]+)\)$/, '$1').trim();
  if (/^(worldwide|anywhere(?: in the world)?|global)$/i.test(place)) return 'Worldwide';
  return place;
}
