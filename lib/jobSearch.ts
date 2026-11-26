import type { Job } from '@/types/job';

const wordPattern = new RegExp('(?:[a-z]\\.)+[a-z]\\b\\.?|[\\p{L}\\p{M}\\p{N}]+', 'giu');
const latinAccents = new RegExp('(\\p{Script=Latin})\\p{M}+', 'gu');

function fold(word: string) {
  return word.toLowerCase().normalize('NFKD').replace(latinAccents, '$1').normalize('NFC').replace(/\./g, '');
}

export function searchTerms(text: string): string[] {
  return Array.from(new Set((text.match(wordPattern) ?? []).map(fold)));
}

const places = [
  ['us', 'usa', 'united states'],
  ['uk', 'united kingdom'],
  ['nyc', 'new york city'],
  ['sf', 'san francisco'],
];

const roleSynonyms = [
  ['ux', 'user experience'],
  ['ui', 'user interface'],
  ['sr', 'senior'],
  ['jr', 'junior'],
];
const exactShortWords = new Set(['us', 'uk', 'sf', 'ai', 'ui', 'ux', 'sr', 'jr']);

function addAliases(words: Set<string>, field: string[], groups: string[][]) {
  const phrase = ' ' + field.join(' ') + ' ';
  for (const group of groups) {
    if (group.some(alias => phrase.includes(' ' + alias + ' '))) {
      for (const alias of group) for (const word of alias.split(' ')) words.add(word);
    }
  }
}

export function indexJob(job: Job) {
  const titleWords = ((job.title || '').match(wordPattern) ?? []).map(fold);
  const locationWords = ((job.location || '').match(wordPattern) ?? []).map(fold);
  const words = new Set([...titleWords, ...searchTerms(job.company || ''), ...locationWords]);
  addAliases(words, locationWords, places);
  addAliases(words, titleWords, roleSynonyms);
  if (job.isAI) words.add('ai');
  return { words: Array.from(words), title: titleWords, remote: job.isRemote };
}

function matchesWord(word: string, term: string) {
  if (exactShortWords.has(term)) return word === term;
  return term.length <= 2 ? word.startsWith(term) : word.includes(term);
}

// A single insertion, deletion, substitution or adjacent transposition in a role word.
function nearTitleWord(term: string, word: string) {
  if (Math.min(term.length, word.length) < 5 || Math.abs(term.length - word.length) > 1 || term[0] !== word[0]) return false;
  let i = 0;
  while (i < term.length && term[i] === word[i]) i++;
  if (term.length > word.length) return term.slice(i + 1) === word.slice(i);
  if (term.length < word.length) return term.slice(i) === word.slice(i + 1);
  return term.slice(i + 1) === word.slice(i + 1) ||
    (term[i] === word[i + 1] && term[i + 1] === word[i] && term.slice(i + 2) === word.slice(i + 2));
}

export function jobMatches(index: ReturnType<typeof indexJob>, terms: string[], allowTitleTypo = false) {
  return terms.every(term => {
    if (term === 'remote') return index.remote;
    return index.words.some(word => matchesWord(word, term)) ||
      (allowTitleTypo && index.title.some(word => nearTitleWord(term, word)));
  });
}

export function highlightWords(text: string, terms: string[]) {
  const parts: { value: string; matched: boolean }[] = [];
  let cursor = 0;
  for (const match of Array.from(text.matchAll(wordPattern))) {
    const start = match.index ?? 0;
    const word = fold(match[0]);
    if (!terms.some(term => matchesWord(word, term))) continue;
    if (cursor < start) parts.push({ value: text.slice(cursor, start), matched: false });
    parts.push({ value: match[0], matched: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ value: text.slice(cursor), matched: false });
  return parts;
}

export function titleRelevance(index: ReturnType<typeof indexJob>, terms: string[], allowTitleTypo = false) {
  const query = terms.filter(term => term !== 'remote');
  if (!query.length) return 0;
  const title = new Set(index.title);
  const exact = query.filter(term => title.has(term) || (allowTitleTypo && index.title.some(word => nearTitleWord(term, word)))).length;
  if (!exact) return 0;
  if (exact === title.size && exact === query.length) return 1000;
  return exact * 10 + Number(exact === title.size);
}
