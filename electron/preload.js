'use strict';
// Espone alla pagina di gioco solo le funzioni del "Governo" (IA testuale), niente altro di Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('governoAPI', {
  status: () => ipcRenderer.invoke('governo:status'),
  setKey: key => ipcRenderer.invoke('governo:setKey', key),
  clearKey: () => ipcRenderer.invoke('governo:clearKey'),
  setModel: model => ipcRenderer.invoke('governo:setModel', model),
  setProvider: p => ipcRenderer.invoke('governo:setProvider', p),
  setLocal: cfg => ipcRenderer.invoke('governo:setLocal', cfg),
  localModels: cfg => ipcRenderer.invoke('governo:localModels', cfg),
  send: req => ipcRenderer.invoke('governo:send', req),
  cancel: () => ipcRenderer.invoke('governo:cancel'),
  warmup: () => ipcRenderer.invoke('governo:warmup'),
  onProgress: fn => ipcRenderer.on('governo:progress', (_e, p) => fn(p)),
});
