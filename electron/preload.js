'use strict';
// Espone alla pagina di gioco solo le funzioni del "Governo" (IA testuale), niente altro di Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('governoAPI', {
  status: () => ipcRenderer.invoke('governo:status'),
  setKey: key => ipcRenderer.invoke('governo:setKey', key),
  clearKey: () => ipcRenderer.invoke('governo:clearKey'),
  setModel: model => ipcRenderer.invoke('governo:setModel', model),
  send: req => ipcRenderer.invoke('governo:send', req),
});
