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
const countryAliases: Record<string,string> = { usa:'US', can:'CA', 'u.s.':'US', 'u.s.a.':'US', uk:'GB', 'u.k.':'GB', 'united states of america':'US', uae:'AE' };
const byName = new Map(countries.map(c=>[c.label.toLowerCase(),c.value]));
const eu = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');

const usStates = new Set(('Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming').toLowerCase().split('|'));

function parseCountry(token: string, explicitRemote: boolean): string[] {
  if (/^(?:EU|European Union)$/i.test(token)) return eu;
  if (token === 'CA') return []; // Ambiguous in employer addresses.
  const lower = token.toLowerCase();
  const country = byName.get(lower) ?? countryAliases[lower] ?? (codes.includes(token) ? token : undefined);
  if (country) return [country];
  return explicitRemote && usStates.has(lower) ? ['US'] : [];
}

export function remoteEligibility(location: string) {
  const countries = new Set<string>();
  const unspecified = /^(?:location unspecified|unspecified|remote location|remote)?$/i.test(location.trim());
  let worldwide = false;
  if (/\b(?:except|excluding|outside|not)\b/i.test(location)) return {worldwide,countries,unspecified};
  // Keep cities and office alternatives outside explicitly marked remote clauses.
  const parts = location.trim().replace(/\b(?:work\s+(?:from|at)\s+home|WFH)\b/gi,'Remote').replace(/^remote\s*·\s*/i, 'Remote ').split(/\s*[·;|]\s*|\s+\/\s+/);
  const marked = parts.filter(part => /\bremote\b/i.test(part));
  for (const part of marked.length ? marked : [location]) {
    const beforeRestriction = part.match(/^(.+?)\s*[-–]\s*remote\s*\([^)]+\)$/i);
    const text = (beforeRestriction?.[1] ?? part.match(/\bremote\s*\(([^)]+)\)\s*$/i)?.[1] ?? part)
      .replace(/^remote\b\s*[-:,–—]?\s*(?:in\s+|eligible\s+)?/i, '')
      .replace(/\s*[,–-]?\s*\(?remote\)?$/i,'').replace(/\s+locations?$/i,'').trim();
    if (/^(?:worldwide|global|anywhere(?: in the world)?)$/i.test(text)) { worldwide = true; continue; }
    const tokens = text.replace(/\bonly\b/gi,'').split(/\s+(?:and|or)\s+|[,&/;·|]/i).map(t=>t.trim()).filter(Boolean);
    const last = tokens.at(-1) ?? '';
    const state = tokens.at(-2)?.toLowerCase() ?? '';
    if (marked.length && parseCountry(last,false).includes('US') &&
        (usStates.has(state) || state === 'georgia' || state === 'district of columbia')) {
      countries.add('US');
      continue;
    }
    const parsed = tokens.map(t => parseCountry(t, marked.length > 0));
    if (parsed.length && parsed.every(group => group.length)) {
      for (const group of parsed) for (const code of group) countries.add(code);
    }
  }
  return {worldwide, countries, unspecified};
}

export function remoteBadge(location: string) {
  const region = remoteEligibility(location);
  if (region.worldwide) return 'Remote · Worldwide';
  if (!region.countries.size) {
    const named = location.trim().match(/^(?:remote[\s(:–—-]*)?(EMEA|APAC|Americas|Europe|North America|South America|North\/South America)(?:\)|\s+remote)?$/i);
    return named ? 'Remote · '+named[1] : 'Remote · Region unclear';
  }
  if (region.countries.size === eu.length && eu.every(code=>region.countries.has(code))) return 'Remote · EU';
  const codes = Array.from(region.countries);
  return codes.length <= 2 ? 'Remote · ' + codes.join('/') : 'Remote · ' + codes.length + ' countries';
}
