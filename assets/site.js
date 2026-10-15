(() => {
  'use strict';
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const setMenu = (open) => { if (!menu || !nav) return; nav.classList.toggle('is-open', open); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? 'Close' : 'Menu'; };
  menu?.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); } });
  document.addEventListener('click', e => { if (menu && nav && !nav.contains(e.target) && !menu.contains(e.target)) setMenu(false); });
  const toast = document.querySelector('.toast');
  let toastTimer;
  const notify = message => { if (!toast) return; toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 4000); };
  const copyText = async text => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { const field = document.createElement('textarea'); field.value = text; field.style.position = 'fixed'; field.style.left = '-9999px'; document.body.append(field); field.select(); let copied = false; try { copied = document.execCommand('copy'); } catch {} field.remove(); return copied; }
  };
  document.querySelector('.copy-email')?.addEventListener('click', async () => notify(await copyText('engr.anisurrehman861@gmail.com') ? 'Email address copied.' : 'Please select and copy the email address.'));
  document.querySelectorAll('.citation-toggle').forEach(button => button.addEventListener('click', () => {
    const box = document.getElementById(button.getAttribute('aria-controls'));
    const open = button.getAttribute('aria-expanded') !== 'true';
    box.hidden = !open; button.setAttribute('aria-expanded', String(open)); button.textContent = open ? 'Close citation −' : 'Cite +';
  }));
  document.querySelectorAll('.copy-citation').forEach(button => button.addEventListener('click', async () => {
    const content = button.closest('.citation-box').querySelector('p').textContent;
    const copied = await copyText(content);
    notify(copied ? 'Citation copied.' : 'Please select and copy the citation text.');
    if (!copied) { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(button.closest('.citation-box').querySelector('p')); selection.removeAllRanges(); selection.addRange(range); }
  }));
  const filters = document.getElementById('publication-filters');
  if (!filters) return;
  const search = document.getElementById('pub-search');
  const year = document.getElementById('pub-year');
  const type = document.getElementById('pub-type');
  const topic = document.getElementById('pub-topic');
  let entries = [...document.querySelectorAll('.catalogue-list .publication')];
  const count = document.querySelector('.result-count');
  const empty = document.querySelector('.empty-state');
  const initial = new URLSearchParams(location.search);
  const readOption = (select, key) => { const value = initial.get(key); if ([...select.options].some(option => option.value === value)) select.value = value; };
  search.value = initial.get('q') || ''; readOption(year, 'year'); readOption(type, 'type'); readOption(topic, 'topic');
  const applyFilters = (updateUrl = true) => {
    const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const entry of entries) {
      const match = words.every(word => entry.dataset.search.includes(word)) && (!year.value || entry.dataset.year === year.value) && (!type.value || entry.dataset.type === type.value) && (!topic.value || entry.dataset.topics.split('|').includes(topic.value));
      entry.hidden = !match; if (match) visible++;
    }
    count.textContent = `Showing ${visible} of ${entries.length} publications`;
    empty.hidden = visible !== 0;
    if (updateUrl) { const params = new URLSearchParams(); if (search.value.trim()) params.set('q', search.value.trim()); if (year.value) params.set('year', year.value); if (type.value) params.set('type', type.value); if (topic.value) params.set('topic', topic.value); const query = params.toString(); history.replaceState(null, '', location.pathname + (query ? '?' + query : '')); }
  };
  filters.addEventListener('submit', e => e.preventDefault());
  search.addEventListener('input', () => applyFilters());
  [year, type, topic].forEach(input => input.addEventListener('change', () => applyFilters()));
  const reset = () => { filters.reset(); applyFilters(); search.focus(); };
  document.querySelectorAll('.reset-filters').forEach(button => button.addEventListener('click', reset));
  document.addEventListener('publications:updated', () => { entries = [...document.querySelectorAll('.catalogue-list .publication')]; applyFilters(false); });
  window.addEventListener('pageshow', () => applyFilters(false));
  applyFilters(false);
})();
