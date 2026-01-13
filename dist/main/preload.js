"use strict";
// Preload script - Expose IPC to renderer
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, func) => {
            ipcRenderer.on(channel, (_event, ...args) => func(...args));
        },
    },
});
//# sourceMappingURL=preload.js.map