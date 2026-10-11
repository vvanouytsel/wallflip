// Favorites and History pages.
let favoriteItems = [];
let historyItems = [];

function formatTime(ms) {
  const d = new Date(ms);
  const day = d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString();
  return `${day} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

async function showFavorites() {
  favoriteItems = await window.wallflip.favorites();
  const grid = $('favGrid');
  grid.innerHTML = '';
  for (const f of favoriteItems) grid.appendChild(card(f, favoriteItems));
  $('favEmpty').hidden = favoriteItems.length > 0;
}

async function showHistory() {
  historyItems = await window.wallflip.history();
  const grid = $('historyGrid');
  grid.innerHTML = '';
  for (const h of historyItems) grid.appendChild(card(h, historyItems, [h.targetLabel, formatTime(h.at)]));
  $('historyEmpty').hidden = historyItems.length > 0;
  $('clearHistory').hidden = historyItems.length === 0;
}

$('clearHistory').onclick = async () => {
  if (!confirm('Clear your whole history? Rotations and favorites are kept.')) return;
  await window.wallflip.clearHistory();
  showHistory();
};
