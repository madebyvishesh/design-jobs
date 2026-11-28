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
  'creative director', 'art director', 'motion director', 'brand director', 'design intern',
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
const INCLUDE_WORD_KEYWORDS = ['ux', 'ui', 'uxr', 'designops'];

const EXCLUDE_KEYWORDS = [
  '3d designer', '3d artist', 'cgi', 'vfx artist',
  'civil designer', 'bridge design', 'roadway design',
  'mechanical design', 'electrical design', 'structural design',
  'chip design', 'pcb design', 'vlsi', 'fpga', 'asic',
  'circuit design', 'physical design engineer',
  // Hardware / silicon design engineering (not product/UX design)
  'power generation design', 'bim designer', 'industrial design engineer', 'manufacturing design',
  'hardware design', 'board design', 'interconnect', 'silicon',
  'analog design', 'rtl design', 'soc design', 'co-design',
  'design verification', 'signal integrity', 'thermal design',
  'rf design', 'power design', 'mechanical design engineer',
  'layout design engineer', 'verification engineer', 'design for test',
  'serdes', 'advanced packaging design engineer', 'semiconductor design engineer',
  'mask design', 'floorplan', 'firmware', 'memory subsystem',
  'system design engineer', 'design engineer - memory', 'clock design',
];

const motionStudios = new Set(['buck.co','futuredeluxe.com','tendril.studio','brandnewschool.com','mvsm.com','giantant.ca']);
export function isStudioMotionRole(title: string, domain = '') {
  return motionStudios.has(domain) &&
    (/^(?:2d|3d|2d\/3d|cg|cgi|vfx|motion|animation)\s+(?:designer|artist|lead|animator|apprentice|director)\b/i.test(title) ||
    /^(?:2d|3d) animation apprentice\b/i.test(title) || (domain === 'tendril.studio' && /^(director|sr\. artist)$/i.test(title)));
}

export function isDesignRole(title: string | undefined | null, department = '', domain = ''): boolean {
  if (!title) return false;
  if (domain === 'studiodumbar.com' && title === 'Creative Coding Intern') return true;
  if (isStudioMotionRole(title, domain)) return true;
  const lower = title.toLowerCase();
  if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return false;
  if (/\b(?:software|frontend|front.end|backend|back.end|full.stack|engineering)\b/.test(lower) &&
      /\b(?:engineer(?:ing)?|developer|manager)\b/.test(lower) &&
      !/\b(?:design engineer|design system|designer|design technologist|ux engineer|ui engineer)/.test(lower)) return false;
  const facilityRole = /\b(data cent(?:er|re)|data hall|rack design|fit.out)\b/i;
  const digitalRole = /\b(ux|ui|user experience|interaction design|product designer|design systems?)\b/i;
  if (facilityRole.test(title + ' ' + department) && !digitalRole.test(title)) return false;
  if (INCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Word-boundary check for short abbreviations like ux/ui
  return INCLUDE_WORD_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`).test(lower));
}
