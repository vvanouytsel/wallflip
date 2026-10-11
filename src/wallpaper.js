const { app, BrowserWindow, screen } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const API = 'https://wallhaven.cc/api/v1/search';
const HISTORY_LIMIT = 200;

function listDisplays() {
  return screen.getAllDisplays().map((d, index) => {
    const px = screen.dipToScreenRect(null, d.bounds);
    return {
      index,
      name: d.label || `Monitor ${index + 1}`,
      width: px.width,
      height: px.height,
      left: px.x,
      top: px.y,
      primary: d.id === screen.getPrimaryDisplay().id,
    };
  });
}

async function search({ query, width, height, matchShape, sorting, page, seed, ratio }) {
  const params = new URLSearchParams({
    q: query || '',
    categories: '111',
    purity: '100',
    sorting: sorting || 'toplist',
    atleast: `${width}x${height}`,
    page: String(page || 1),
  });
  if (sorting === 'toplist') params.set('topRange', '1y');
  if (sorting === 'random' && seed) params.set('seed', seed);
  if (matchShape && ratio) params.set('ratios', ratio);

  const res = await fetch(`${API}?${params}`);
  if (res.status === 429) throw new Error('Wallhaven says slow down - wait a minute and try again.');
  if (!res.ok) throw new Error(`Wallhaven error (${res.status})`);
  const json = await res.json();
  return {
    items: json.data.map((w) => ({
      id: w.id,
      full: w.path,
      thumb: w.thumbs.large,
      resolution: w.resolution,
    })),
    lastPage: json.meta.last_page,
    seed: json.meta.seed,
  };
}

async function details(id) {
  const res = await fetch(`https://wallhaven.cc/api/v1/w/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Wallhaven error (${res.status})`);
  const w = (await res.json()).data;
  return {
    url: w.url,
    views: w.views,
    favorites: w.favorites,
    fileSize: w.file_size,
    category: w.category,
    uploader: w.uploader ? w.uploader.username : '',
    tags: w.tags.map((t) => t.name),
  };
}

function runPowerShell(args) {
  // In the installed app the script is unpacked next to the app archive, where PowerShell can read it.
  const script = path.join(__dirname, '..', 'scripts', 'set-wallpaper.ps1').replace('app.asar', 'app.asar.unpacked');
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
      (err, _out, stderr) => (err ? reject(new Error(stderr.trim() || err.message)) : resolve()),
    );
  });
}

// Downloads the wallpaper (once) and sets it on one monitor (index) or all of them ('all').
async function applyWallpaper(wallpaper, target) {
  const dir = path.join(app.getPath('pictures'), 'Wallflip');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${wallpaper.id}${path.extname(wallpaper.full)}`);

  try {
    await fs.access(file);
  } catch {
    const res = await fetch(wallpaper.full);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  }

  if (process.platform === 'win32') {
    const args = ['-Path', file];
    if (target === 'all') {
      args.push('-All');
    } else {
      const d = listDisplays()[target];
      args.push('-Left', String(d.left), '-Top', String(d.top));
    }
    await runPowerShell(args);
  } else {
    const { setWallpaper } = await import('wallpaper');
    await setWallpaper(file, target === 'all' ? {} : { screen: target });
  }
}

function targetLabel(target) {
  return target === 'all' ? 'All monitors' : `Monitor ${target + 1}`;
}

function historyFile() {
  return path.join(app.getPath('userData'), 'history.json');
}

async function readHistory() {
  try {
    return JSON.parse(await fs.readFile(historyFile(), 'utf8'));
  } catch {
    return [];
  }
}

async function setWallpaper({ wallpaper, target }) {
  await applyWallpaper(wallpaper, target);
  const list = [{ ...wallpaper, target, targetLabel: targetLabel(target), at: Date.now() }, ...(await readHistory())];
  await fs.writeFile(historyFile(), JSON.stringify(list.slice(0, HISTORY_LIMIT), null, 2));
}

function clearHistory() {
  return fs.writeFile(historyFile(), '[]');
}

function favoritesFile() {
  return path.join(app.getPath('userData'), 'favorites.json');
}

async function readFavorites() {
  try {
    return JSON.parse(await fs.readFile(favoritesFile(), 'utf8'));
  } catch {
    return [];
  }
}

// Adds or removes a wallpaper from favorites and returns whether it is now a favorite.
async function toggleFavorite(wallpaper) {
  const list = await readFavorites();
  const exists = list.some((f) => f.id === wallpaper.id);
  const next = exists ? list.filter((f) => f.id !== wallpaper.id) : [{ ...wallpaper, at: Date.now() }, ...list];
  await fs.writeFile(favoritesFile(), JSON.stringify(next, null, 2));
  return !exists;
}

// Flashes a big number on every monitor so you can tell which is which.
function identifyMonitors() {
  const all = screen.getAllDisplays();
  listDisplays().forEach((d, i) => {
    const win = new BrowserWindow({
      x: all[i].bounds.x + 40,
      y: all[i].bounds.y + 40,
      width: 520,
      height: 360,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
    });
    win.setIgnoreMouseEvents(true);
    const html = `<body style="margin:0;display:grid;place-items:center;height:100vh;font-family:Segoe UI,system-ui,sans-serif;color:white;text-align:center;background:linear-gradient(135deg,#7c6cff,#2bb7ff);border-radius:28px;overflow:hidden">
      <div><div style="font-size:190px;font-weight:800;line-height:1">${i + 1}</div>
      <div style="font-size:26px;opacity:.9">${d.width} x ${d.height}${d.primary ? ' - main' : ''}</div></div></body>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    setTimeout(() => !win.isDestroyed() && win.close(), 3000);
  });
}

module.exports = {
  listDisplays,
  search,
  details,
  applyWallpaper,
  setWallpaper,
  readHistory,
  clearHistory,
  readFavorites,
  toggleFavorite,
  identifyMonitors,
};
