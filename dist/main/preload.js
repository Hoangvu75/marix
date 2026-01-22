"use strict";
// Preload script - Expose IPC to renderer
const { contextBridge, ipcRenderer, shell } = require('electron');
// Map to store listener references to prevent memory leaks
// Key: original callback, Value: wrapped callback
const listeners = new Map();
contextBridge.exposeInMainWorld('electron', {
    shell: {
        openExternal: (url) => shell.openExternal(url),
    },
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        on: (channel, func) => {
            // Create wrapped subscription
            const subscription = (_event, ...args) => func(...args);
            // Store reference for later removal
            listeners.set(func, subscription);
            ipcRenderer.on(channel, subscription);
        },
        removeListener: (channel, func) => {
            // Get the wrapped subscription
            const subscription = listeners.get(func);
            if (subscription) {
                ipcRenderer.removeListener(channel, subscription);
                listeners.delete(func);
            }
        },
        removeAllListeners: (channel) => {
            ipcRenderer.removeAllListeners(channel);
        },
    },
});
//# sourceMappingURL=preload.js.map