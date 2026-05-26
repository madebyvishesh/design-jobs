const INCLUDE_KEYWORDS = [
  // Core design roles
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
  // Additional design-adjacent roles
  'animator', 'illustrator',
  'creative technologist',
  'experience researcher',
  'narrative designer',
  'storyboard artist',
  'concept artist',
  'character designer',
  'design advocate',
  'creative strategist',
  'information architect',
  'design thinking',
  'visual storyteller',
  'creative lead',
  'design principal',
  'founding designer',
  'staff designer',
  'principal designer',
  'growth designer',
  'accessibility designer',
  'design consultant',
  'design strategist',
  'user interface architect',
  'experience designer',
  'creative designer',
  'digital designer',
  'web designer',
  'product designer',
  'ui designer',
  'ux designer',
  'mobile designer',
  'app designer',
  'creative writer',
  'ux writer',
  'design writer',
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
