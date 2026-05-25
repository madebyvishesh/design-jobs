const INCLUDE_KEYWORDS = [
  'designer', 'design engineer', 'design technologist',
  'design lead', 'design manager', 'design director',
  'head of design', 'vp design', 'vp of design',
  'design ops', 'design operations', 'design program',
  'design systems', 'user experience', 'user interface',
  'product design', 'visual design',
  'brand design', 'graphic design', 'motion design',
  'interaction design', 'service design',
  'creative director', 'art director',
  'ux researcher', 'user researcher', 'design researcher',
  'content designer', 'conversation designer',
  'illustration', 'typography',
];

// Short abbreviations matched only as whole words
const INCLUDE_WORD_KEYWORDS = ['ux', 'ui'];

const EXCLUDE_KEYWORDS = [
  '3d designer', '3d artist', 'cgi', 'vfx artist',
  'civil designer', 'bridge design', 'roadway design',
  'mechanical design', 'electrical design', 'structural design',
  'chip design', 'pcb design', 'vlsi', 'fpga', 'asic',
  'circuit design', 'physical design engineer',
];

export function isDesignRole(title: string): boolean {
  const lower = title.toLowerCase();
  if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return false;
  if (INCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Word-boundary check for short abbreviations like ux/ui
  return INCLUDE_WORD_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`).test(lower));
}
