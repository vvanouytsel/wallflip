// The Discover feed: search, filters and endless scrolling.
const THEMES = ['Minimal', 'Dark', 'Nature', 'Space', 'Abstract', 'Cyberpunk', 'Anime', 'City', 'Mountains', 'Ocean', 'Forest'];
const SETTINGS_KEY = 'wallflip.discover';
const SKELETONS = 12;

let selected = 0;
let page = 0;
let lastPage = 1;
let seed = '';
let loading = false;
let feedItems = [];
let similarTo = null;
let searchId = 0;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ query: $('query').value, sorting: $('sorting').value, matchShape: $('matchShape').checked, monitor: selected }),
  );
}

function restoreSettings() {
  const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  if (s.query) $('query').value = s.query;
  if (s.sorting) $('sorting').value = s.sorting;
  if (typeof s.matchShape === 'boolean') $('matchShape').checked = s.matchShape;
  const primary = displays.findIndex((d) => d.primary);
  selected = s.monitor < displays.length ? s.monitor : Math.max(0, primary);
}

function renderMonitors() {
  const box = $('monitors');
  box.innerHTML = '';
  displays.forEach((d, i) => {
    const b = button(i === selected ? 'on' : '', `Monitor ${i + 1}`, () => {
      selected = i;
      renderMonitors();
      runSearch();
    });
    b.appendChild(el('small', '', `${d.width}x${d.height}`));
    box.appendChild(b);
  });
}

function renderChips() {
  for (const theme of THEMES) $('chips').appendChild(button('chip', theme, () => searchFor(theme.toLowerCase())));
}

function markChips() {
  const q = $('query').value.trim().toLowerCase();
  for (const b of $('chips').children) b.classList.toggle('on', !similarTo && b.textContent.toLowerCase() === q);
}

function searchFor(text) {
  similarTo = null;
  $('query').value = text;
  runSearch();
}

function showSimilar(w) {
  similarTo = w;
  runSearch();
}

function addSkeletons() {
  for (let i = 0; i < SKELETONS; i++) $('grid').appendChild(el('div', 'card skeleton'));
}

function removeSkeletons() {
  for (const s of $('grid').querySelectorAll('.skeleton')) s.remove();
}

async function loadNextPage() {
  if (loading || page >= lastPage) return;
  loading = true;
  const id = searchId;
  const m = displays[selected];
  const d = gcd(m.width, m.height);
  $('feedStatus').textContent = '';
  addSkeletons();
  try {
    const res = await window.wallflip.search({
      query: similarTo ? `like:${similarTo.id}` : $('query').value.trim(),
      width: m.width,
      height: m.height,
      ratio: `${m.width / d}x${m.height / d}`,
      matchShape: $('matchShape').checked,
      sorting: similarTo ? 'relevance' : $('sorting').value,
      page: page + 1,
      seed,
    });
    if (id !== searchId) return;
    page++;
    seed = res.seed || seed;
    lastPage = res.lastPage;
    removeSkeletons();
    const known = new Set(feedItems.map((w) => w.id));
    for (const w of res.items) {
      if (known.has(w.id)) continue;
      feedItems.push(w);
      $('grid').appendChild(card(w, feedItems));
    }
    $('feedEmpty').hidden = feedItems.length > 0;
    if (feedItems.length && page >= lastPage) $('feedStatus').textContent = "That's everything for this search.";
  } catch (e) {
    if (id !== searchId) return;
    removeSkeletons();
    $('feedStatus').textContent = e.message;
  } finally {
    if (id === searchId) loading = false;
  }
  // Keep filling until the page can scroll, so endless scrolling always has something to trigger on.
  if (id === searchId && sentinelInView()) loadNextPage();
}

function sentinelInView() {
  return $('sentinel').getBoundingClientRect().top < window.innerHeight + 1200;
}

function runSearch() {
  searchId++;
  page = 0;
  lastPage = 1;
  seed = '';
  loading = false;
  feedItems = [];
  $('grid').innerHTML = '';
  $('feedEmpty').hidden = true;
  $('feedStatus').textContent = '';
  $('similar').hidden = !similarTo;
  if (similarTo) $('similarThumb').src = similarTo.thumb;
  markChips();
  saveSettings();
  window.scrollTo(0, 0);
  loadNextPage();
}

// Called by the preview when you browse close to the end of a list.
function onNearListEnd(list) {
  if (list === feedItems) loadNextPage();
}

function startDiscover() {
  restoreSettings();
  renderMonitors();
  renderChips();
  window.addEventListener('scroll', () => !$('discover').hidden && sentinelInView() && loadNextPage(), { passive: true });
  window.addEventListener('resize', () => !$('discover').hidden && sentinelInView() && loadNextPage());
  runSearch();
}

$('searchForm').onsubmit = (e) => {
  e.preventDefault();
  similarTo = null;
  runSearch();
};
$('sorting').onchange = runSearch;
$('matchShape').onchange = runSearch;
$('shuffle').onclick = () => {
  similarTo = null;
  $('sorting').value = 'random';
  runSearch();
};
$('similarClear').onclick = () => {
  similarTo = null;
  runSearch();
};
