import { app, BrowserWindow, ipcMain, dialog, clipboard, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: true,
    backgroundColor: '#1f2937',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'multiSelections']
  })
  return result.filePaths
})

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '日志文件', extensions: ['log', 'txt', 'zip', 'gz', 'rar'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  return result.filePaths
})

ipcMain.handle('read-file', async (_event, filePath: string) => {
  return fs.promises.readFile(filePath, 'utf-8')
})

ipcMain.handle('read-directory', async (_event, dirPath: string) => {
  const files = await fs.promises.readdir(dirPath, { withFileTypes: true })
  const result: { name: string; path: string; isDirectory: boolean; size: number }[] = []
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name)
    try {
      const stats = await fs.promises.stat(fullPath)
      result.push({
        name: file.name,
        path: fullPath,
        isDirectory: file.isDirectory(),
        size: stats.size
      })
    } catch {
      // skip
    }
  }
  
  return result
})

ipcMain.handle('get-clipboard-text', async () => {
  return clipboard.readText()
})

ipcMain.handle('save-dialog', async (_event, defaultPath: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath,
    filters: [
      { name: 'ZIP 压缩包', extensions: ['zip'] },
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  return result.filePath
})

ipcMain.handle('save-file', async (_event, filePath: string, content: string | Buffer) => {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content)
  await fs.promises.writeFile(filePath, buffer)
  return true
})

ipcMain.handle('open-external', async (_event, url: string) => {
  return shell.openExternal(url)
})

ipcMain.handle('show-item-in-folder', async (_event, filePath: string) => {
  return shell.showItemInFolder(filePath)
})

ipcMain.handle('get-file-stats', async (_event, filePath: string) => {
  const stats = await fs.promises.stat(filePath)
  return {
    size: stats.size,
    birthTime: stats.birthtimeMs,
    mtime: stats.mtimeMs
  }
})
