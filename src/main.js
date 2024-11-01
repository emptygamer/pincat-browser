const {app, BrowserView, BrowserWindow, screen} = require('electron') ;
let win;

require('@electron/remote/main').initialize();

function createWindow () {
  win = new BrowserWindow({title:"Pincat Window",
                            transparent:true,
                            frame:false,
                            alwaysOnTop:true,
                            resizable:true,
                            width:1280/2,
                            height:720/2,
                            icon: __dirname + '/icon.png',
                            webPreferences: {
                              nodeIntegration: true,
                              contextIsolation: false,
                              enableRemoteModule: true,
                              webviewTag:true
                            },
                          });

  const view = new BrowserView({
    disableHtmlFullscreenWindowResize:false,
  });
  view.setBounds({ x: 0, y: 48, width: win.getSize()[0], height: win.getSize()[1] })

  win.setMenu(null);
  win.show();
  win.loadFile('index.html');
  require("@electron/remote/main").enable(win.webContents);
  // win.webContents.openDevTools();
  
  win.app = app;
  win.on('closed', () => {
    win = null
  })
  win.webContents.on("did-attach-webview", (_, contents) => {
    contents.setWindowOpenHandler((details) => {
      win.webContents.send('open-url', details.url);
      return { action: 'deny' }
    })
  })
  win.screen = screen;
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (win === null) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
