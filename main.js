const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');

// Disables hardware acceleration for OBS transparency
app.disableHardwareAcceleration();

const SECRET_SALT = "Chamara@78"; 
const licensePath = path.join(app.getPath('userData'), 'cricscore_license_v3.json');
let myHWID = "UNKNOWN";

function createSplashAndMain(fileToLoad) {
  // 1. CREATE THE SPLASH SCREEN
  const splash = new BrowserWindow({
    width: 450,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'icon.ico')
  });
  
  splash.loadFile('splash.html');

  // 2. CREATE THE MAIN WINDOW (HIDDEN INITIALLY)
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "Ultimate CricScore Maker",
    icon: path.join(__dirname, 'icon.ico'),
    show: false, // Keep it hidden while it loads!
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const template = [
    { label: 'File', submenu: [{ role: 'quit', label: 'Exit Ultimate CricScore' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools', label: 'Developer Tools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile(fileToLoad);

  // 3. WHEN THE MAIN WINDOW IS FULLY LOADED, SWAP THEM!
  mainWindow.once('ready-to-show', () => {
      // Adding a 2.5 second delay so the user actually gets to enjoy the splash screen
      setTimeout(() => {
          splash.close();
          mainWindow.show();
      }, 2500);
  });

  if (fileToLoad === 'license.html') {
      mainWindow.webContents.on('did-finish-load', () => {
          mainWindow.webContents.send('send-hwid', myHWID);
      });
  }

  // Intercept the "Launch Live Output" button for OBS transparency
  mainWindow.webContents.setWindowOpenHandler((details) => {
      if (details.url.includes('mode=obs')) {
          return {
              action: 'allow',
              overrideBrowserWindowOptions: {
                  transparent: true,
                  frame: false,
                  hasShadow: false,
                  webPreferences: {
                      nodeIntegration: true,
                      contextIsolation: false
                  }
              }
          };
      }
      return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  let isLicensed = false;
  
  try {
      myHWID = machineIdSync().substring(0, 10).toUpperCase(); 
  } catch(e) {
      console.log("Could not generate HWID");
  }

  if (fs.existsSync(licensePath)) {
      try {
          const data = JSON.parse(fs.readFileSync(licensePath));
          if (data.hwid === myHWID && data.activated === true) {
              isLicensed = true;
          }
      } catch (err) {
          console.log("Error reading license file.");
      }
  }

  if (isLicensed) {
      createSplashAndMain('index.html');   
  } else {
      createSplashAndMain('license.html'); 
  }
});

ipcMain.on('verify-license', (event, userKey) => {
    const expectedKeyRaw = crypto
        .createHmac('sha256', SECRET_SALT)
        .update(myHWID)
        .digest('hex')
        .substring(0, 12)
        .toUpperCase();

    if (userKey === expectedKeyRaw) {
        fs.writeFileSync(licensePath, JSON.stringify({ hwid: myHWID, activated: true }));
        const win = BrowserWindow.fromWebContents(event.sender);
        win.loadFile('index.html');
    } else {
        event.reply('license-failed');
    }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});