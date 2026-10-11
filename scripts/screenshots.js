// Renders every screen of the app with demo data into docs/screenshots/.
// Run with: npm run screenshots
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const wallpaper = require('../src/wallpaper');

const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const WIDTH = 1600;
const HEIGHT = 1000;
const HOUR = 60 * 60 * 1000;

async function wallpapers(query) {
  const res = await wallpaper.search({ query, width: 2560, height: 1440, ratio: '16x9', matchShape: true, sorting: 'toplist', page: 1 });
  return res.items.map(({ id, full, thumb, resolution }) => ({ id, full, thumb, resolution }));
}

// Fills the temporary profile with favorites, history and rotations so every screen has something to show.
async function seed() {
  const dir = app.getPath('userData');
  await fs.mkdir(dir, { recursive: true });

  const [landscapes, space] = [await wallpapers('landscape'), await wallpapers('space')];
  const now = Date.now();
  const write = (name, data) => fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2));

  await write('favorites.json', [...landscapes.slice(2, 8), ...space.slice(0, 4)].map((w, i) => ({ ...w, at: now - i * HOUR })));
  await write(
    'history.json',
    landscapes.slice(8, 16).map((w, i) => {
      const target = i % 3 === 0 ? 'all' : i % 2;
      return { ...w, target, targetLabel: target === 'all' ? 'All monitors' : `Monitor ${target + 1}`, at: now - i * 5 * HOUR };
    }),
  );
  await write('rotations.json', [
    {
      id: 'demo-mornings',
      name: 'Calm mornings',
      enabled: true,
      images: landscapes.slice(0, 12),
      target: 'all',
      schedule: { type: 'interval', minutes: 60 },
      order: 'shuffle',
      queue: [],
      lastRun: now - 23 * 60 * 1000,
      currentId: '',
      lastError: '',
    },
    {
      id: 'demo-space',
      name: 'Space nights',
      enabled: false,
      images: space.slice(0, 8),
      target: 0,
      schedule: { type: 'daily', time: '20:00' },
      order: 'ordered',
      queue: [],
      lastRun: now,
      currentId: '',
      lastError: '',
    },
  ]);
}

async function run(icon) {
  await seed();
  await fs.mkdir(OUT, { recursive: true });

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,
    show: false,
    icon,
    backgroundColor: '#0a0b12',
    // Offscreen rendering paints every frame without showing a window, so captures are never stale.
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), offscreen: true, backgroundThrottling: false },
  });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  const js = (code) => win.webContents.executeJavaScript(code);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(expr, timeout = 30000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await js(expr)) return;
      await sleep(250);
    }
    throw new Error(`Timed out waiting for: ${expr}`);
  }
  const imagesReady = `[...document.querySelectorAll('img')].filter(i => i.offsetParent && i.getBoundingClientRect().top < innerHeight).every(i => i.complete && i.naturalWidth)`;
  async function shot(name) {
    await waitFor(imagesReady);
    await sleep(600);
    const image = await win.webContents.capturePage();
    await fs.writeFile(path.join(OUT, `${name}.png`), image.resize({ width: WIDTH }).toPNG());
    console.log(`saved ${name}.png`);
  }

  // Let the app finish its own first search before starting ours.
  await waitFor(`$('monitors').children.length > 0 && feedItems.length > 0 && !loading`);
  await js(`$('sorting').value = 'toplist'; searchFor('landscape')`);
  await waitFor(`$('query').value === 'landscape' && feedItems.length >= 24 && !loading`);
  await waitFor(`[...document.querySelectorAll('#grid .thumb')].slice(0, 15).every(t => t.classList.contains('loaded'))`);
  await shot('discover');

  await js(`document.querySelectorAll('#grid .card')[1].click()`);
  await waitFor(`$('tags').querySelector('.tag') && $('preview').src === currentWallpaper().full`);
  await shot('preview');
  await js(`closePreview()`);

  await js(`showTab('favorites')`);
  await waitFor(`$('favGrid').children.length > 0`);
  await shot('favorites');

  await js(`showTab('rotations')`);
  await waitFor(`$('rotCards').children.length === 2`);
  await shot('rotations');

  await js(`document.querySelector('.rotActions .btn:nth-child(2)').click()`);
  await waitFor(`!$('rotEditor').hidden && $('rotImages').children.length > 0`);
  await shot('rotation-editor');

  await js(`showTab('history')`);
  await waitFor(`$('historyGrid').children.length > 0`);
  await shot('history');

  app.quit();
}

module.exports = { run };
