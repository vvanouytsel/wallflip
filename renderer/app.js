// Shared state, helpers, tabs and the wallpaper preview.
const $ = (id) => document.getElementById(id);

let displays = [];
let favoriteIds = new Set();
let viewerList = [];
let viewerIndex = 0;
let detailsToken = 0;

const HEART = '<svg viewBox="0 0 24 24" class="icon"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const b = el('button', className, text);
  b.type = 'button';
  if (onClick) b.onclick = onClick;
  return b;
}

function toast(text, isError) {
  const t = $('toast');
  t.textContent = text;
  t.className = isError ? 'error' : '';
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3000);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function imageOf(w) {
  const { id, full, thumb, resolution } = w;
  return { id, full, thumb, resolution };
}

function targetName(target) {
  return target === 'all' ? 'all monitors' : `monitor ${target + 1}`;
}

// A wallpaper tile. `list` is the collection it belongs to, so the preview can step through it.
function card(w, list, caption) {
  const c = el('div', 'card');
  const thumb = el('div', 'thumb');
  const img = el('img');
  img.loading = 'lazy';
  img.src = w.thumb;
  img.onload = () => thumb.classList.add('loaded');
  thumb.appendChild(img);
  c.append(thumb, el('div', 'badge', w.resolution));

  const heart = button(favoriteIds.has(w.id) ? 'heart on' : 'heart');
  heart.innerHTML = HEART;
  heart.title = 'Favorite';
  heart.onclick = async (e) => {
    e.stopPropagation();
    await toggleFavorite(w);
    heart.className = favoriteIds.has(w.id) ? 'heart on' : 'heart';
  };
  c.appendChild(heart);

  if (caption) {
    const cap = el('div', 'caption');
    cap.append(el('b', '', caption[0]), el('span', '', caption[1]));
    c.appendChild(cap);
  }
  c.onclick = () => openPreview(w, list);
  return c;
}

async function loadFavoriteIds() {
  favoriteIds = new Set((await window.wallflip.favorites()).map((f) => f.id));
}

async function toggleFavorite(w) {
  const on = await window.wallflip.toggleFavorite(imageOf(w));
  if (on) favoriteIds.add(w.id);
  else favoriteIds.delete(w.id);
  toast(on ? 'Added to favorites' : 'Removed from favorites');
  if (!$('favoritesView').hidden) showFavorites();
}

/* Tabs */

const TABS = {
  discover: ['tabDiscover', 'discover', 'discoverBar'],
  favorites: ['tabFavorites', 'favoritesView'],
  rotations: ['tabRotations', 'rotationsView'],
  history: ['tabHistory', 'historyView'],
};

function showTab(name) {
  for (const [key, [tab, ...views]] of Object.entries(TABS)) {
    $(tab).className = key === name ? 'on' : '';
    for (const v of views) $(v).hidden = key !== name;
  }
  window.scrollTo(0, 0);
  if (name === 'favorites') showFavorites();
  if (name === 'history') showHistory();
  if (name === 'rotations') showRotations();
}

/* Preview */

function openPreview(w, list = [w]) {
  viewerList = list;
  viewerIndex = Math.max(0, list.indexOf(w));
  renderPreview();
  $('modal').hidden = false;
}

function currentWallpaper() {
  return viewerList[viewerIndex];
}

function renderPreview() {
  const w = currentWallpaper();
  // Show the small thumbnail straight away, then swap in the full image once it has downloaded.
  $('preview').src = w.thumb;
  const full = new Image();
  full.onload = () => currentWallpaper() === w && ($('preview').src = w.full);
  full.src = w.full;
  $('info').textContent = w.resolution;
  $('sub').textContent = w.targetLabel ? `Last set on ${w.targetLabel}` : `wallhaven.cc/${w.id}`;
  $('prev').hidden = viewerIndex === 0;
  $('next').hidden = viewerIndex >= viewerList.length - 1;
  $('favLabel').textContent = favoriteIds.has(w.id) ? 'Favorited' : 'Favorite';
  $('fav').classList.toggle('on', favoriteIds.has(w.id));

  const box = $('targets');
  box.innerHTML = '';
  displays.forEach((d, i) => {
    const b = button('target', '', () => apply(i));
    b.append(el('b', '', `Monitor ${i + 1}`), el('small', '', `${d.width}x${d.height}`), el('kbd', '', String(i + 1)));
    box.appendChild(b);
  });
  if (displays.length > 1) {
    const all = button('target all', '', () => apply('all'));
    all.append(el('b', '', 'All monitors'), el('small', '', plural(displays.length, 'screen')), el('kbd', '', 'A'));
    box.appendChild(all);
  }

  const keys = displays.length > 1 ? `1-${displays.length} set on a monitor  /  A all monitors` : '1 set as wallpaper';
  $('keys').textContent = `Left / Right browse  /  ${keys}  /  F favorite  /  Esc close`;

  renderAddTo(w);
  renderTags(w);
}

async function renderTags(w) {
  const token = ++detailsToken;
  const box = $('tags');
  box.innerHTML = '<span class="subtle">Loading...</span>';
  try {
    const d = await window.wallflip.details(w.id);
    if (token !== detailsToken) return;
    $('sub').textContent = [
      w.targetLabel ? `Last set on ${w.targetLabel}` : '',
      `${d.views.toLocaleString()} views`,
      `${d.favorites.toLocaleString()} likes`,
      `${(d.fileSize / 1048576).toFixed(1)} MB`,
    ]
      .filter(Boolean)
      .join('  /  ');
    box.innerHTML = '';
    for (const tag of d.tags.slice(0, 14)) {
      box.appendChild(
        button('tag', tag, () => {
          closePreview();
          showTab('discover');
          searchFor(tag);
        }),
      );
    }
    if (d.tags.length === 0) box.innerHTML = '<span class="subtle">No tags</span>';
  } catch {
    if (token === detailsToken) box.innerHTML = '<span class="subtle">Could not load tags</span>';
  }
}

function step(delta) {
  const i = viewerIndex + delta;
  if (i < 0 || i >= viewerList.length) return;
  viewerIndex = i;
  renderPreview();
  if (i >= viewerList.length - 3) onNearListEnd(viewerList);
}

function closePreview() {
  $('modal').hidden = true;
  $('preview').removeAttribute('src');
}

async function apply(target) {
  toast('Setting wallpaper...');
  try {
    await window.wallflip.setWallpaper({ wallpaper: imageOf(currentWallpaper()), target });
    toast(`Wallpaper set on ${targetName(target)}`);
  } catch (e) {
    toast(e.message, true);
  }
}

$('prev').onclick = () => step(-1);
$('next').onclick = () => step(1);
$('close').onclick = closePreview;
$('fav').onclick = async () => {
  await toggleFavorite(currentWallpaper());
  renderPreview();
};
$('similarBtn').onclick = () => {
  const w = currentWallpaper();
  closePreview();
  showTab('discover');
  showSimilar(w);
};
$('openWeb').onclick = () => window.wallflip.openWallhaven(currentWallpaper().id);
$('modal').onclick = (e) => {
  if (e.target === $('modal') || e.target.classList.contains('stage')) closePreview();
};

document.addEventListener('keydown', (e) => {
  if ($('modal').hidden || e.target.tagName === 'INPUT') return;
  const key = e.key.toLowerCase();
  if (key === 'escape') closePreview();
  else if (key === 'arrowleft') step(-1);
  else if (key === 'arrowright') step(1);
  else if (key === 'f') $('fav').click();
  else if (key === 'a' && displays.length > 1) apply('all');
  else if (/^[1-9]$/.test(key) && Number(key) <= displays.length) apply(Number(key) - 1);
});

/* Header and misc */

$('tabDiscover').onclick = () => showTab('discover');
$('tabFavorites').onclick = () => showTab('favorites');
$('tabRotations').onclick = () => showTab('rotations');
$('tabHistory').onclick = () => showTab('history');
$('identify').onclick = () => window.wallflip.identify();
$('toTop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
window.addEventListener('scroll', () => ($('toTop').hidden = window.scrollY < 900), { passive: true });

// Wait until every page script has loaded before starting.
window.addEventListener('DOMContentLoaded', async () => {
  [displays] = await Promise.all([window.wallflip.displays(), loadFavoriteIds()]);
  startDiscover();
});
