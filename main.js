const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } = require('electron');
const path = require('node:path');
const wallpaper = require('./src/wallpaper');
const rotations = require('./src/rotations');

const ICON = path.join(__dirname, 'assets', 'icon.png');
const startHidden = process.argv.includes('--hidden');

let win = null;
let tray = null;
let quitting = false;

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 760,
    show: !startHidden,
    backgroundColor: '#0a0b10',
    autoHideMenuBar: true,
    title: 'Wallflip',
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // With a rotation switched on, closing the window keeps Wallflip running in the tray.
  win.on('close', async (e) => {
    if (quitting || !(await rotations.anyEnabled())) return;
    e.preventDefault();
    win.hide();
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Wallflip');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Wallflip', click: showWindow },
      {
        label: 'Next wallpaper in all rotations',
        click: async () => {
          for (const r of await rotations.list()) if (r.enabled) await rotations.change(r.id);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', showWindow);
}

function loginItem() {
  return app.isPackaged ? { args: ['--hidden'] } : { path: process.execPath, args: [app.getAppPath(), '--hidden'] };
}

ipcMain.handle('displays', () => wallpaper.listDisplays());
ipcMain.handle('search', (_e, opts) => wallpaper.search(opts));
ipcMain.handle('set-wallpaper', (_e, opts) => wallpaper.setWallpaper(opts));
ipcMain.handle('history', () => wallpaper.readHistory());
ipcMain.handle('clear-history', () => wallpaper.clearHistory());
ipcMain.handle('identify', () => wallpaper.identifyMonitors());
ipcMain.handle('details', (_e, id) => wallpaper.details(id));
ipcMain.handle('favorites', () => wallpaper.readFavorites());
ipcMain.handle('toggle-favorite', (_e, w) => wallpaper.toggleFavorite(w));
ipcMain.handle('open-wallhaven', (_e, id) => shell.openExternal(`https://wallhaven.cc/w/${encodeURIComponent(id)}`));

ipcMain.handle('rotations', () => rotations.list());
ipcMain.handle('rotation-save', (_e, draft) => rotations.save(draft));
ipcMain.handle('rotation-delete', (_e, id) => rotations.remove(id));
ipcMain.handle('rotation-enable', (_e, id, enabled) => rotations.setEnabled(id, enabled));
ipcMain.handle('rotation-add-image', (_e, id, image) => rotations.addImage(id, image));
ipcMain.handle('rotation-now', (_e, id) => rotations.change(id));

ipcMain.handle('background-get', () => app.getLoginItemSettings(loginItem()).openAtLogin);
ipcMain.handle('background-set', (_e, on) => app.setLoginItemSettings({ openAtLogin: on, ...loginItem() }));

if (process.argv.includes('--screenshots')) {
  // `npm run screenshots`: renders every screen with demo data into docs/screenshots.
  app.setPath('userData', path.join(app.getPath('temp'), 'wallflip-screenshots'));
  app.whenReady().then(() =>
    require('./scripts/screenshots')
      .run(ICON)
      .catch((e) => {
        console.error(e);
        app.exit(1);
      }),
  );
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    createWindow();
    createTray();
    rotations.start(() => win && !win.isDestroyed() && win.webContents.send('rotations-changed'));
  });
  app.on('before-quit', () => (quitting = true));
  app.on('window-all-closed', () => app.quit());
}
