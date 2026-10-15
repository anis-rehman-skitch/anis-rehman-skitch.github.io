import { ORCID, parseWorks, findNewWorks } from './publication-sync-core.mjs';

const buttons = [...document.querySelectorAll('[data-refresh-publications]')];
if (buttons.length) initialize();

async function initialize() {
  const statuses = [...document.querySelectorAll('[data-publication-sync-status]')];
  const catalogue = document.querySelector('.catalogue-list');
  const homeList = document.querySelector('[data-live-publications]');
  const homeNew = document.querySelector('[data-new-publications]');
  const originalEntries = catalogue ? [...catalogue.querySelectorAll('.publication')] : [];
  const formatter = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
  const FRESH_FOR = 60 * 60 * 1000;
  let records;
  let cacheKey;
  let lastChecked;
  let busy = false;
  let nextCheck = 0;
  let timer;

  const status = (text, state = 'ready') => statuses.forEach(node => {
    node.textContent = text;
    node.dataset.state = state;
  });
  const updateButtons = () => buttons.forEach(button => {
    button.disabled = !records || busy || Date.now() < nextCheck;
    button.textContent = busy ? 'Checking publications…' : 'Refresh publications ↻';
    button.setAttribute('aria-busy', String(busy));
  });
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const link = (url, label) => {
    const node = element('a', '', label);
    node.href = url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  };
  const card = work => {
    const article = element('article', 'publication');
    article.dataset.orcidWork = String(work.putCode);
    article.dataset.year = String(work.year);
    article.dataset.type = work.type;
    article.dataset.topics = '';
    article.dataset.search = `${work.title} ${work.venue} ${work.year} Anis ur Rehman ${work.type}`.toLowerCase();
    const year = element('div', 'pub-year', String(work.year));
    year.append(element('span', 'pub-type', work.type === 'Journal article' ? 'Journal' : 'Conference'));
    const body = element('div', 'pub-body');
    const title = element('h3');
    title.append(link(work.url, work.title));
    const source = element('p', 'pub-authors', 'Listed on Anis ur Rehman’s ORCID record');
    const venue = element('p', 'pub-venue', work.venue);
    const actions = element('div', 'pub-actions');
    actions.append(link(work.url, work.doi ? 'View paper ↗' : 'View ORCID record ↗'));
    if (work.doi) actions.append(link(`https://orcid.org/${ORCID}`, 'ORCID record ↗'));
    body.append(title, source, venue, actions);
    article.append(year, body);
    return article;
  };
  const render = works => {
    const additions = findNewWorks(works, records).sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
    if (catalogue) {
      const entries = [...originalEntries, ...additions.map(card)];
      entries.sort((a, b) => Number(b.dataset.year) - Number(a.dataset.year));
      catalogue.replaceChildren(...entries);
      const yearSelect = document.getElementById('pub-year');
      if (yearSelect) {
        const selected = yearSelect.value;
        const years = [...new Set([...records, ...additions].map(work => work.year))].sort((a, b) => b - a);
        const all = element('option', '', 'All years'); all.value = '';
        yearSelect.replaceChildren(all, ...years.map(year => {
          const option = element('option', '', String(year)); option.value = String(year); return option;
        }));
        yearSelect.value = years.map(String).includes(selected) ? selected : '';
      }
      document.dispatchEvent(new CustomEvent('publications:updated'));
    }
    if (homeList && homeNew) {
      homeList.replaceChildren(...additions.slice(0, 3).map(card));
      homeNew.hidden = additions.length === 0;
    }
    const merged = [...records, ...additions];
    const counts = {
      total: merged.length,
      journal: merged.filter(work => work.type === 'Journal article').length,
      conference: merged.filter(work => work.type === 'Conference paper').length,
    };
    document.querySelectorAll('[data-publication-count]').forEach(node => {
      const value = counts[node.dataset.publicationCount];
      if (value !== undefined) node.textContent = String(value);
    });
    return additions.length;
  };
  const fetchJson = async (url, fresh = false) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: fresh ? 'no-store' : 'default', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Publication source returned ${response.status}.`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  };
  const lastCheckText = () => lastChecked ? ` Last checked ${formatter.format(new Date(lastChecked))}.` : '';
  const refresh = async () => {
    if (!records || busy || Date.now() < nextCheck) return;
    busy = true;
    nextCheck = Date.now() + 10000;
    updateButtons();
    status('Checking public ORCID publications…', 'loading');
    try {
      const response = await fetchJson(`https://pub.orcid.org/v3.0/${ORCID}/works`, true);
      const works = parseWorks(response);
      const additions = render(works);
      lastChecked = Date.now();
      try { localStorage.setItem(cacheKey, JSON.stringify({ checked: lastChecked, response })); } catch { /* Refresh also works without browser storage. */ }
      status(`${additions ? `${additions} additional publication${additions === 1 ? '' : 's'} from ORCID.` : 'Publication list is up to date with public ORCID records.'}${lastCheckText()}`);
    } catch {
      status(`Could not check ORCID. The existing publication list is still available.${lastCheckText()}`, 'error');
    } finally {
      busy = false;
      updateButtons();
      clearTimeout(timer);
      timer = setTimeout(updateButtons, Math.max(0, nextCheck - Date.now()) + 20);
    }
  };
  buttons.forEach(button => button.addEventListener('click', refresh));
  try {
    const config = await fetchJson(new URL('./publication-catalogue.json', import.meta.url));
    if (config?.schema_version !== 1 || !Array.isArray(config.records) || config.records.length === 0 ||
      config.records.some(work => !Number.isInteger(work.id) || typeof work.title !== 'string' || !Number.isInteger(work.year) || !['Journal article', 'Conference paper'].includes(work.type))) {
      throw new TypeError('Invalid publication catalogue.');
    }
    records = config.records;
    cacheKey = `orcid-publications:v1:${ORCID}:${records.map(work => `${work.id}:${work.title}:${work.doi || ''}`).join('|')}`;
    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (saved && Number.isFinite(saved.checked) && saved.checked > 0 && saved.checked <= Date.now() + 60000) {
        render(parseWorks(saved.response));
        lastChecked = saved.checked;
        status(`Showing publications checked against ORCID.${lastCheckText()}`);
      }
    } catch { /* Ignore unavailable storage or malformed caches. */ }
    updateButtons();
    if (!lastChecked || Date.now() - lastChecked >= FRESH_FOR) await refresh();
  } catch {
    status('Automatic checking is unavailable. The saved publication list is still available.', 'error');
    records = undefined;
    updateButtons();
  }
}
