const escapeHTMLPolicy = trustedTypes.createPolicy("myEscapePolicy", {
    createHTML: (string) => string.replace(/</g, "&lt;"),
  });
let trs = escapeHTMLPolicy.createHTML(`
::-webkit-scrollbar {width: 1px;height: 1px} 
.video-top-pin {
left:0px !important;top:0px !important; position: absolute !important;
`.replace("\n",""));

let style = document.createElement('style');
style.type = 'text/css';
style.innerHTML = trs;
document.head.appendChild(style);

let d = document.querySelector('div[id="content"]');
d.style = "height:100vh !important; z:index:9999 !important ; transform:translateY(calc(0px - var(--ytd-toolbar-height)))";

let v = document.querySelector('video[tabindex="-1"]');
v.classList.add('video-top-pin');

let fpc = document.querySelector('div[id="player-full-bleed-container"]');
fpc.style = "height:calc(100vh);"

let b = document.querySelector('button[class="ytp-size-button ytp-button"]');
let yv = document.querySelector('ytd-watch-flexy');
if(!yv['theater']){
    b.click();
}

let ytd = document.querySelector('ytd-app');
ytd.setAttribute("masthead-hidden","");

document.body.style = "overflow-y:hidden !important";
document.body.onresize = ()=>{
    document.body.style = "overflow-y:hidden !important";
}