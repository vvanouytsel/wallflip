const { app } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { applyWallpaper, listDisplays } = require('./wallpaper');

const TICK_MS = 20 * 1000;
const MINUTE = 60 * 1000;

let onChange = () => {};
const running = new Set();

function file() {
  return path.join(app.getPath('userData'), 'rotations.json');
}

async function readAll() {
  try {
    return JSON.parse(await fs.readFile(file(), 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(list) {
  return fs.writeFile(file(), JSON.stringify(list, null, 2));
}

function atTime(time, dayOffset, from = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(from);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// The latest moment a daily rotation should already have fired, as of now.
function lastDailySlot(time, now) {
  const today = atTime(time, 0, new Date(now));
  return today <= now ? today : atTime(time, -1, new Date(now));
}

function nextRunAt(r, now = Date.now()) {
  if (!r.enabled) return null;
  if (r.schedule.type === 'interval') return (r.lastRun || now) + r.schedule.minutes * MINUTE;
  return lastDailySlot(r.schedule.time, now) + 24 * 60 * MINUTE;
}

function isDue(r, now = Date.now()) {
  if (!r.enabled || r.images.length === 0) return false;
  if (r.schedule.type === 'interval') return now >= (r.lastRun || 0) + r.schedule.minutes * MINUTE;
  return (r.lastRun || 0) < lastDailySlot(r.schedule.time, now);
}

function shuffled(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNext(r) {
  const ids = r.images.map((i) => i.id);
  let id;
  if (r.order === 'ordered') {
    id = ids[(ids.indexOf(r.currentId) + 1) % ids.length];
  } else {
    let queue = (r.queue || []).filter((q) => ids.includes(q));
    if (queue.length === 0) {
      queue = shuffled(ids);
      if (queue.length > 1 && queue[0] === r.currentId) queue.push(queue.shift());
    }
    id = queue.shift();
    r.queue = queue;
  }
  return r.images.find((i) => i.id === id);
}

function withNext(r) {
  return { ...r, nextAt: nextRunAt(r) };
}

async function list() {
  return (await readAll()).map(withNext);
}

async function change(id) {
  if (running.has(id)) return;
  running.add(id);
  try {
    const all = await readAll();
    const r = all.find((x) => x.id === id);
    if (!r || r.images.length === 0) return;
    const wallpaper = pickNext(r);
    const target = r.target === 'all' || r.target < listDisplays().length ? r.target : 'all';
    r.lastRun = Date.now();
    try {
      await applyWallpaper(wallpaper, target);
      r.currentId = wallpaper.id;
      r.lastError = '';
    } catch (e) {
      r.lastError = e.message;
    }
    await writeAll(all);
    onChange();
  } finally {
    running.delete(id);
  }
}

async function tick() {
  for (const r of await readAll()) if (isDue(r)) await change(r.id);
}

async function save(draft) {
  const all = await readAll();
  const old = all.find((x) => x.id === draft.id);
  const r = {
    id: old ? old.id : crypto.randomUUID(),
    name: draft.name.trim() || 'My rotation',
    enabled: old ? old.enabled : true,
    images: draft.images,
    target: draft.target,
    schedule: draft.schedule,
    order: draft.order,
    queue: [],
    lastRun: old ? old.lastRun : Date.now(),
    currentId: old ? old.currentId : '',
    lastError: '',
  };
  await writeAll(old ? all.map((x) => (x.id === r.id ? r : x)) : [...all, r]);
  onChange();
}

async function remove(id) {
  await writeAll((await readAll()).filter((r) => r.id !== id));
  onChange();
}

async function setEnabled(id, enabled) {
  const all = await readAll();
  const r = all.find((x) => x.id === id);
  if (!r) return;
  r.enabled = enabled;
  if (enabled) r.lastRun = Date.now();
  await writeAll(all);
  onChange();
}

async function addImage(id, wallpaper) {
  const all = await readAll();
  const r = all.find((x) => x.id === id);
  if (!r) throw new Error('Rotation not found');
  if (r.images.some((i) => i.id === wallpaper.id)) return false;
  r.images.push(wallpaper);
  await writeAll(all);
  onChange();
  return true;
}

async function anyEnabled() {
  return (await readAll()).some((r) => r.enabled);
}

function start(callback) {
  onChange = callback;
  tick();
  setInterval(tick, TICK_MS);
}

module.exports = { start, list, save, remove, setEnabled, addImage, change, anyEnabled };
