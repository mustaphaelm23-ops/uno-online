  /* ═══ INIT ═══ */
  window.addEventListener('DOMContentLoaded',()=>{
    setLang(I18N.current); // apply saved language + RTL before anything renders
    buildBg();
    Theme.init();          // apply saved/seasonal lobby theme + atmosphere particles
    if(typeof Atmosphere!=='undefined') Atmosphere.boot();   // body-level world tint (pointer-events:none — cannot block clicks)
    if(S.token&&S.user){initSock();goLobby();}
    else showScreen('auth-screen');
    // Auth enter key
    ['lu','lp','ru','rp'].forEach(id=>document.getElementById(id)?.addEventListener('keydown',handleAuthEnter));
  });

  document.addEventListener('keydown',e=>{
    const inGame=document.getElementById('game-screen').classList.contains('active');
    if(!inGame)return;
    if(e.code==='KeyU')doUNO();
    if(e.code==='Space'){e.preventDefault();doDraw();}
    if(e.code==='KeyC')doCancel();
  });

  // Pause the WebGL scenes when the tab is hidden — saves GPU/battery.
  // Auto-resume the lobby atmosphere when the tab is visible again (if still on lobby);
  // the room scene re-focuses naturally on the next hover.
  document.addEventListener('visibilitychange',()=>{
    const onLobby=document.getElementById('lobby-screen')?.classList.contains('active');
    if(document.hidden){
      if(typeof RoomScene!=='undefined')  RoomScene.stop();
      if(typeof LobbyScene!=='undefined') LobbyScene.stop();
      if(typeof Parallax!=='undefined')   Parallax.stop();
    } else if(onLobby){
      if(typeof LobbyScene!=='undefined') LobbyScene.start();
      if(typeof Parallax!=='undefined')   Parallax.start();
    }
  });

  /* ═══ PWA: Service Worker ═══ */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('[PWA] SW registration failed:', e));
    });
  }
  /* Listen for the install prompt so we can offer it from the lobby gear menu later */
  window._pwaInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window._pwaInstallPrompt = e;
  });
  function pwaInstall(){
    if(!window._pwaInstallPrompt) return toast('Already installed or not supported on this device','i');
    window._pwaInstallPrompt.prompt();
    window._pwaInstallPrompt.userChoice.then((c)=>{
      if(c.outcome==='accepted') toast('App installed! 🎉','s');
      window._pwaInstallPrompt = null;
    });
  }
  