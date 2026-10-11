// Renders assets/logo.svg to assets/icon.png. Run with: npx electron scripts/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true });
  await win.loadFile(path.join(__dirname, '..', 'assets', 'logo.svg'));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), image.toPNG());
  app.quit();
});
