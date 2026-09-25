const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#18181b',
    title: 'Berkelium Studio - 3D CAD & Aerodynamics CFD',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ---------------- Native Electron Desktop IPC Handlers ----------------

// 1. Native Directory Picker
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  const dirPath = result.filePaths[0];
  const dirName = path.basename(dirPath);

  try {
    const dirEntries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files = dirEntries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        type: e.name.endsWith('.py')
          ? 'python'
          : e.name.endsWith('.cpp') || e.name.endsWith('.h')
          ? 'cpp'
          : e.name.endsWith('.js')
          ? 'javascript'
          : e.name.endsWith('.stl') || e.name.endsWith('.obj') || e.name.endsWith('.gltf')
          ? '3d-mesh'
          : 'file'
      }));

    return {
      name: dirName,
      path: dirPath,
      files
    };
  } catch (err) {
    return {
      name: dirName,
      path: dirPath,
      files: []
    };
  }
});

// 2. Native File Picker (3D Meshes, Blueprints, Code)
ipcMain.handle('dialog:openFile', async (event, filters) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: '3D CAD Models & Code', extensions: ['stl', 'obj', 'gltf', 'glb', 'py', 'cpp', 'js', 'pdf', 'png', 'jpg'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const content = await fs.promises.readFile(filePath);

  return {
    name: fileName,
    path: filePath,
    buffer: content
  };
});

// 3. Read File Content
ipcMain.handle('fs:readFile', async (event, filePath) => {
  return await fs.promises.readFile(filePath, 'utf-8');
});

// 4. Save File Content
ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  await fs.promises.writeFile(filePath, content, 'utf-8');
  return { success: true };
});

// 5. Native System / Platform Info
ipcMain.handle('system:info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    electron: process.versions.electron,
    cwd: process.cwd()
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});