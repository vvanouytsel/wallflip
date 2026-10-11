const { contextBridge, ipcRenderer } = require('electron');

const call = (name) => (...args) => ipcRenderer.invoke(name, ...args);

contextBridge.exposeInMainWorld('wallflip', {
  displays: call('displays'),
  search: call('search'),
  setWallpaper: call('set-wallpaper'),
  history: call('history'),
  clearHistory: call('clear-history'),
  identify: call('identify'),
  details: call('details'),
  favorites: call('favorites'),
  toggleFavorite: call('toggle-favorite'),
  openWallhaven: call('open-wallhaven'),
  rotations: call('rotations'),
  saveRotation: call('rotation-save'),
  deleteRotation: call('rotation-delete'),
  enableRotation: call('rotation-enable'),
  addToRotation: call('rotation-add-image'),
  changeNow: call('rotation-now'),
  getBackground: call('background-get'),
  setBackground: call('background-set'),
  onRotationsChanged: (callback) => ipcRenderer.on('rotations-changed', callback),
});
