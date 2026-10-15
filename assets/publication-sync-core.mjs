/** Public ORCID work metadata, parsed without trusting remote HTML or URLs. */
export const ORCID = '0000-0002-1878-4523';

const RECORD_PATH = `/${ORCID}/works`;
const TYPE_LABELS = new Map([
  ['journal-article', 'Journal article'],
  ['conference-paper', 'Conference paper'],
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(message) {
  throw new TypeError(`Invalid ORCID response: ${message}`);
}

export function normalizeTitle(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function normalizeDoi(value) {
  if (typeof value !== 'string') return '';
  let doi = value.trim();
  if (/^https?:\/\/(?:dx\.)?doi\.org\//i.test(doi)) {
    doi = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
    try { doi = decodeURIComponent(doi); } catch { return ''; }
  }
  doi = doi.replace(/^doi:\s*/i, '').trim().toLowerCase();
  if (doi.length > 2048 || !/^10\.\d{4,9}\/[^\s<>"{}\\^`\u0000-\u001f\u007f]+$/u.test(doi)) return '';
  return doi;
}

function selfDois(container) {
  const ids = container?.['external-ids']?.['external-id'];
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids)) fail('external identifiers must be an array');
  return ids.flatMap((entry) => {
    if (!isObject(entry) || entry['external-id-type'] !== 'doi'
      || entry['external-id-relationship'] !== 'self') return [];
    const doi = normalizeDoi(entry['external-id-value'])
      || normalizeDoi(entry['external-id-normalized']?.value);
    return doi ? [doi] : [];
  });
}

function indexOf(summary) {
  const raw = summary['display-index'];
  if (raw === undefined || raw === null) return 0;
  if (!(typeof raw === 'number' || typeof raw === 'string') || !/^\d+$/.test(String(raw))) {
    fail('display index must be a nonnegative integer');
  }
  const index = Number(raw);
  if (!Number.isSafeInteger(index)) fail('display index is out of range');
  return index;
}

function verifySummary(summary) {
  if (!isObject(summary)) fail('work summary must be an object');
  const code = summary['put-code'];
  if (!Number.isSafeInteger(code) || code < 1) fail('put code must be a positive integer');
  if (summary.path !== `/${ORCID}/work/${code}`) fail('work belongs to an unexpected record');
  if (summary.visibility !== 'public') fail('work is not public');
  return indexOf(summary);
}

function safeDoiUrl(doi) {
  return `https://doi.org/${doi.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Parse only this researcher's public journal articles and conference papers.
 * Integrity/shape errors reject the response so callers can retain their fallback.
 * Legitimate unsupported work types are ignored.
 */
export function parseWorks(response) {
  if (!isObject(response) || !Array.isArray(response.group)) fail('expected a works object with a group array');
  if (response.path !== undefined && response.path !== RECORD_PATH) fail('unexpected record path');
  const parsed = [];
  const maxYear = new Date().getUTCFullYear() + 3;
  for (const group of response.group) {
    if (!isObject(group) || !Array.isArray(group['work-summary']) || !group['work-summary'].length) {
      fail('work group must contain summaries');
    }
    const summaries = group['work-summary'];
    let preferred = summaries[0];
    let preferredIndex = -1;
    for (const summary of summaries) {
      const index = verifySummary(summary);
      if (index > preferredIndex) {
        preferred = summary;
        preferredIndex = index;
      }
    }
    const type = TYPE_LABELS.get(preferred.type);
    if (!type) continue;
    const title = preferred.title?.title?.value;
    if (typeof title !== 'string' || !title.trim() || !normalizeTitle(title)) fail('work title is missing');
    const yearValue = preferred['publication-date']?.year?.value;
    if (!(typeof yearValue === 'number' || typeof yearValue === 'string') || !/^\d{4}$/.test(String(yearValue))) {
      fail('publication year is missing or malformed');
    }
    const year = Number(yearValue);
    if (year < 1000 || year > maxYear) fail('publication year is out of range');
    const venueValue = preferred['journal-title']?.value;
    if (venueValue !== undefined && venueValue !== null && typeof venueValue !== 'string') {
      fail('venue must be text');
    }
    // Prefer the selected record's DOI, but keep identifiers supplied by its
    // other grouped versions when the preferred version has none.
    const doi = [...selfDois(preferred), ...selfDois(group), ...summaries.flatMap(selfDois)][0] || '';
    const putCode = preferred['put-code'];
    parsed.push({
      putCode,
      title: title.trim(),
      year,
      type,
      venue: (venueValue || '').trim(),
      doi,
      url: doi ? safeDoiUrl(doi) : `https://orcid.org/${ORCID}`,
    });
  }
  return findNewWorks(parsed, []);
}

/** Exclude curated/duplicate DOI or title matches; never modify either input. */
export function findNewWorks(works, curated) {
  if (!Array.isArray(works) || !Array.isArray(curated)) throw new TypeError('Publication lists must be arrays');
  const seenDois = new Set();
  const seenTitles = new Set();
  for (const work of curated) {
    const doi = normalizeDoi(work?.doi);
    const title = normalizeTitle(work?.title);
    if (doi) seenDois.add(doi);
    if (title) seenTitles.add(title);
  }
  const added = [];
  for (const work of works) {
    if (!isObject(work)) throw new TypeError('Publication must be an object');
    const doi = normalizeDoi(work.doi);
    const title = normalizeTitle(work.title);
    if (!title) throw new TypeError('Publication title must contain text');
    const duplicate = (doi && seenDois.has(doi)) || seenTitles.has(title);
    // Register both aliases even for a duplicate, so a later record that uses
    // its alternate DOI/title cannot slip into the returned list.
    if (doi) seenDois.add(doi);
    seenTitles.add(title);
    if (!duplicate) added.push(work);
  }
  return added;
}
