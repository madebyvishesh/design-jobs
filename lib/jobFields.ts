export const fields = {
  product: 'Product design',
  ux: 'UX & UI design',
  research: 'User research',
  brand: 'Brand & visual design',
  motion: 'Motion & animation',
  content: 'Content design & UX writing',
  systems: 'Design systems',
  engineering: 'Design engineering',
  games: 'Game design',
  operations: 'Design operations',
  leadership: 'Design leadership',
  other: 'Other design',
} as const;

export type DesignField = keyof typeof fields;
const rules: [DesignField, RegExp][] = [
  ['product', /\bproduct design/],
  ['research', /\buxr\b|\b(?:ux|user|experience|design) research|\bresearch(?:er)?\b.*\b(?:ux|user experience|design)\b/],
  ['brand', /\b(?:brand|visual|graphic|creative|marketing|communications?)\b|\bart director|\billustrat|\btypograph/],
  ['motion', /\bmotion\b|\banimat|\bstoryboard/],
  ['content', /\b(?:content|conversation|narrative) design|\b(?:ux|design) writ/],
  ['systems', /\bdesign systems?\b/],
  ['engineering', /\bdesign engineer|\b(?:creative|design) technologist|\b(?:ux|ui) engineer/],
  ['games', /\b(?:game(?:play)?|level|character|combat|quest|systems) design|\bconcept artist/],
  ['operations', /\bdesign (?:ops|operations|program)|\bdesignops\b/],
  ['leadership', /\b(?:head|director|vp|vice president) of .*design|\bdesign (?:lead(?:er)?|manager|director)|\b(?:creative|art) director|\b(?:lead|manager|director),? (?:product |ux |brand )?design/],
];

export function jobFields(title: string, department = ''): DesignField[] {
  const text = title.toLowerCase();
  const matches = rules.filter(([field, pattern]) => pattern.test(text) && !(field === 'games' && /design systems?/.test(text))).map(([field]) => field);
  if (!matches.includes('research') && !matches.includes('content') && !matches.includes('engineering') &&
      /\b(?:ux|ui|user experience|user interface|interaction design|experience design|service design|web design|accessibility design)\b|\b(?:interaction|experience|service|web|accessibility) designer/.test(text)) matches.push('ux');
  if (!matches.length && /\bdesigner\b/.test(text)) {
    const team = department.toLowerCase();
    matches.push(...rules.filter(([, pattern]) => pattern.test(team)).map(([field]) => field));
  }
  return matches.length ? matches : ['other'];
}
