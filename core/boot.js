/* core/boot.js — runs first inside <body>, before the app is ready. */

/* Login screen: the 🌓 button flips the shared theme (core/theme.js).
   First visit after the upgrade: keep the old login choice. */
(function(){
  try{
    if(!LTTheme.has() && localStorage.getItem('lews_login_theme')==='light') LTTheme.set({mode:'light',_fromLogin:true});
  }catch(e){}
})();
window.toggleLoginTheme=function(){ LTTheme.toggleMode(); };

/* Early stand-in so a remembered login can switch skins before core/extras.js loads */
window.toggleMellieaTheme=window.toggleMellieaTheme||function(on){
  if(on){ if(LTTheme.raw().skin!=='rose') LTTheme.set({skin:'rose'}); }
  else if(LTTheme.has() && LTTheme.raw().skin==='rose') LTTheme.set({skin:'gold'});
};

/* Secret: triple-click the logo on the login screen to pop out the desktop pet */
window.__logoClicks=0; window.__logoClickTimer=null;
window.handleLogoClick=function(){
  window.__logoClicks++;
  clearTimeout(window.__logoClickTimer);
  window.__logoClickTimer=setTimeout(function(){window.__logoClicks=0;},600);
  if(window.__logoClicks>=3){
    window.__logoClicks=0;
    if(typeof uToggle==='function') uToggle();
  }
};
