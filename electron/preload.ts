import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('read-directory', dirPath),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  saveDialog: (defaultPath: string) => ipcRenderer.invoke('save-dialog', defaultPath),
  saveFile: (filePath: string, content: string | Buffer) =>
    ipcRenderer.invoke('save-file', filePath, content),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  getFileStats: (filePath: string) => ipcRenderer.invoke('get-file-stats', filePath)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
