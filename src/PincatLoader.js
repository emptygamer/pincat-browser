const remote = require('@electron/remote');
const fs = require('fs');
const path = require('path');
const process = require('process');
const child_process = require('child_process');

let win = remote.getCurrentWindow();
win.setAlwaysOnTop(true,"screen-saver");

let urlContainerDiv = document.querySelector("#url-container");
let urlInput = document.querySelector("#url-input");
let barTitleLabel = document.querySelector("#bar-title");
let isWebviewDomReady=true;
let webviewLoadingAbortController = new AbortController();
let maximizedSVG = document.querySelector("#maximized-svg");
let unmaximizedSVG = document.querySelector("#unmaximized-svg");

const ADDONS_ROOT_PATH = path.join(win.app.getPath("userData"),"/Addons");
const wv = document.querySelector('#webview');
let _restoreBounds;
let _isMaximizedOnExternal;

async function init(){
    validateAndAutoCreateAddonsFolder();

    //#region Webview Events
    wv.addEventListener('dom-ready', (e)=>{
        isWebviewDomReady=true;
        barTitleLabel.innerText = wv.getTitle();
    });

    wv.addEventListener("did-navigate-in-page", (e) => {
        urlInput.value = wv.getURL();
    })

    wv.addEventListener("page-title-set", (e) => {
        barTitleLabel.innerText = e.title;
    })

    wv.addEventListener("page-title-updated", (e) => {
        barTitleLabel.innerText = e.title;
    })
    //#endregion

    // Pincat dropdown
    document.addEventListener("click", e => {
        const isDropdownButton = e.target.matches("[pincat-dropdown-button]");
        
        if(!isDropdownButton && e.target.closest("[pincat-dropdown]") != null) return;

        let currentDropdown;
        if(isDropdownButton){
            currentDropdown = e.target.closest("[pincat-dropdown]");
            currentDropdown.classList.toggle("active");

            let dropdownBtn = currentDropdown.querySelector("[pincat-dropdown-button]");
            if(dropdownBtn){
                let offset = dropdownBtn.getBoundingClientRect().width;
                currentDropdown.querySelectorAll(".pincat-dropdown-menu").forEach(menu=>{
                    menu.style = `transform : translateX(${offset? `calc(-100% + ${offset}px`: "0px"}))`;
                });
            }
        }

        document.querySelectorAll("[pincat-dropdown].active").forEach(dropdown=>{
            if(dropdown === currentDropdown) return;
            dropdown.classList.remove("active");
        })
    })

    // Keyboard search
    urlInput.addEventListener('keyup', function (e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
            changeUrl();
            urlInput.blur();
        }
    });

    //#region Window Events
    win.on('maximize', function(e){
        let displays = win.screen.getAllDisplays();
        let _winBounds = win.getBounds();
        let _defaultScreenArea = displays[0].workArea;

        if(!compareBounds(_winBounds,_defaultScreenArea)){
            // Note : Maximized on the external screen.
            _isMaximizedOnExternal=true;
        }else{
            _isMaximizedOnExternal=false;
        }
        updateMaxMinStatus();
    })
    win.on('unmaximize', function(e){
        _isMaximizedOnExternal=false;
        updateMaxMinStatus();
    })
    win.on('move', function(e){
        _isMaximizedOnExternal=false;
        updateMaxMinStatus();
    })
    win.on('resize', function(e){
        _isMaximizedOnExternal=false;
        updateMaxMinStatus();
    })
    //#endregion
}

function compareBounds(b1, b2){
    return (b1.x==b2.x && b1.y==b2.y && b1.width==b2.width && b1.height == b2.height);
}

function updateMaxMinStatus(){
    if(win.isMaximized() || _isMaximizedOnExternal){
        maximizedSVG.setAttribute("remove","");
        unmaximizedSVG.removeAttribute("remove");
    }else{
        unmaximizedSVG.setAttribute("remove","");
        maximizedSVG.removeAttribute("remove");
    }
}

async function changeUrl(){
    const url = urlInput.value;
    if(url==="")return;

    // Note : Wait until previous url loaded.
    // if(!isWebviewDomReady)return;

    barTitleLabel.innerHTML = "Loading...";
    isWebviewDomReady=false;

    // Note : Abort previous waiting event.
    webviewLoadingAbortController.abort();
    webviewLoadingAbortController = new AbortController();

    // Note : Check the URL resource exists.
    try{
        let res = await fetch(url, {method: 'HEAD'});
        if(res.status!==200)throw new Error("Failed.");
        if(res.url.includes("file:///")){
            barTitleLabel.innerHTML = decodeURIComponent(path.basename(res.url));
        }
    }catch(e){
        barTitleLabel.innerHTML = `Failed to Load - ${url}`;
        isWebviewDomReady=true;
        return;
    }
    
    wv.setAttribute("src", url);

    await new Promise(async (resolve, reject)=>{
        const intervalId = setInterval(() => {
            if(isWebviewDomReady || webviewLoadingAbortController.signal.aborted){
                resolve();
                clearInterval(intervalId);
                return;
            }
        }, 20);
    });
}

function updateAddons(){
    let addonMenu = document.querySelector("[pincat-addon-menu]")
    if(addonMenu){
        addonMenu.querySelectorAll("[pincat-addon-item]").forEach(item => {
            item.remove();
        })

        const wv = document.querySelector('#webview');
        
        // Note : Setup built-in buttons.
        // -- [Open Addon Folder]
        let button = document.createElement("button");
        button.innerText = "[Open Addon Folder]";
        button.setAttribute("class","pincat-dropdown-menu-button built-in");
        button.setAttribute("pincat-addon-item","");
        button.addEventListener("click",()=>{
            dirOpen(ADDONS_ROOT_PATH);
        })
        addonMenu.appendChild(button);

        // Note : Extract addons.
        if(validateAndAutoCreateAddonsFolder()){
            fs.readdir(ADDONS_ROOT_PATH, (err, files) => {
                files.forEach(file => {
                    let button = document.createElement("button");
                    button.innerText = file;
                    button.setAttribute("class","pincat-dropdown-menu-button")
                    button.setAttribute("pincat-addon-item","")
                    button.addEventListener("click",()=>{
                        let jsString = fs.readFileSync(path.join(ADDONS_ROOT_PATH,file),{encoding: 'utf-8'});
                        wv.executeJavaScript(jsString);
                        document.querySelector("[pincat-addon-button]").click();
                    })
                    addonMenu.appendChild(button);
                });
            });
        }
    }
}

function dirOpen(dirPath) {
    let command = '';
    switch (process.platform) {
      case 'darwin':
        command = 'open';
        break;
      case 'win32':
        command = 'explorer';
        break;
      default:
        command = 'xdg-open';
        break;
    }
    return child_process.execSync(`${command} "${dirPath}"`);
}

function validateAndAutoCreateAddonsFolder(){
    if(!fs.existsSync(ADDONS_ROOT_PATH)){
        fs.mkdirSync(ADDONS_ROOT_PATH);
        return true;
    }else{
        return fs.lstatSync(ADDONS_ROOT_PATH).isDirectory();
    }
}

function dropFileHandler(e){
    e.preventDefault();
    if(e.dataTransfer.items){
        const f = e.dataTransfer.items[0];
        if(f.kind === "file"){
            urlInput.value = f.getAsFile().path;
            changeUrl();
        }
    }
    urlInput.removeAttribute("file-dragging");
}

function dragFileOverHandler(e){
    urlInput.setAttribute("file-dragging","");
}

function dragFileLeaveHandler(e){
    urlInput.removeAttribute("file-dragging");
}

//#region Menu Functions
function closeWindow(){
    win.close();
}

function minimizeWindow(){
    win.minimize();
}

function maximizeWindow(){
    if(win.isMaximized() || _isMaximizedOnExternal){
        if(_isMaximizedOnExternal){
            win.setBounds(_restoreBounds);
            _isMaximizedOnExternal=false;
            updateMaxMinStatus();
        }else{
            win.unmaximize();
        }
    }else{
        _restoreBounds = win.getBounds();
        win.maximize();
    }
}

function pin(btn){
    if(win.isAlwaysOnTop()){
        win.setAlwaysOnTop(false,"screen-saver");
        const svg = btn.querySelector('svg');
        svg.setAttribute("hide","");
    }else{
        const svg = btn.querySelector('svg');
        win.setAlwaysOnTop(true,"screen-saver");
        svg.removeAttribute("hide");
    }
}

function switchURLDiv(){
    if(urlContainerDiv.getAttribute("hide","") !== null){
        urlContainerDiv.removeAttribute("hide");
        urlHide = false;
    }else{
        urlContainerDiv.setAttribute("hide","");
        urlHide = true;
    }
}

function goBack(){
    if(wv.canGoBack()){
        wv.goBack();
    }
}

function goForward(){
    if(wv.canGoForward()){
        wv.goForward();
    }
}
//#endregion

init();