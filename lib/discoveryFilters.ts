export const levels = { intern: 'Internship', junior: 'Junior / associate', mid: 'Mid-level', senior: 'Senior', staff: 'Staff / principal', lead: 'Lead / management', unknown: 'Level unspecified' } as const;

export function experienceLevel(title: string): keyof typeof levels {
  if (/\bintern(ship)?\b/i.test(title)) return 'intern';
  if (/\b(staff|principal|distinguished)\b/i.test(title)) return 'staff';
  if (/\b(lead|director|manager|head|vp|vice president)\b/i.test(title)) return 'lead';
  if (/\b(senior|sr)\b/i.test(title)) return 'senior';
  if (/\b(junior|jr|entry[ -]level|associate|graduate)\b/i.test(title)) return 'junior';
  if (/\bmid(dle)?[ -]level\b/i.test(title)) return 'mid';
  return 'unknown';
}

const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const names = new Intl.DisplayNames(['en'], {type:'region'});
export const countries = codes.map(value => ({value, label:names.of(value) || value})).sort((a,b)=>a.label.localeCompare(b.label,'en'));
const countryAliases: Record<string,string> = { usa:'US', 'u.s.':'US', 'u.s.a.':'US', uk:'GB', 'u.k.':'GB', 'united states of america':'US', uae:'AE' };
const byName = new Map(countries.map(c=>[c.label.toLowerCase(),c.value]));
const eu = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');

export function remoteEligibility(location: string) {
  const countries = new Set<string>();
  const clause = location.match(/\bremote\s*\(([^)]+)\)/i)?.[1] ?? location.split(/\s+\/\s+remote\b/i).at(-1)!.replace(/^remote\b\s*[-:–—]?\s*/i,'').replace(/(?:\s*\(remote\)|\s+remote)$/i,'');
  const text = clause.trim().replace(/^\((.+)\)$/,'$1');
  const worldwide = /^(?:worldwide|global|anywhere(?: in the world)?)(?:\s*[-–·]\s*remote)?$/i.test(text);
  const tokens = text.replace(/\bonly\b/gi,'').split(/\s+(?:and|or)\s+|[,&/;·|]/i).map(t=>t.trim()).filter(Boolean);
  // A mixed list of offices and remote locations does not establish country eligibility.
  const parsed = tokens.map(token => {
    if (/^(EU|European Union)$/i.test(token)) return eu;
    // "CA" alone can mean California or Canada.
    if (token === 'CA') return [];
    const code = byName.get(token.toLowerCase()) ?? countryAliases[token.toLowerCase()] ?? (codes.includes(token) ? token : undefined);
    return code ? [code] : [];
  });
  if (parsed.every(part=>part.length)) for (const part of parsed) for (const code of part) countries.add(code);
  const unspecified = !text || /^(?:location unspecified|unspecified|remote location|remote)$/i.test(text);
  return {worldwide, countries, unspecified};
}
