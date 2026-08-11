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

  /* ═══ PWA: Service Worker (with auto-update) ═══
     Without this, a tab keeps running whatever JS the OLD service worker
     cached — which is exactly how a stale apiFetch / module gets stuck
     "Loading…" forever even though the server is fine. We now:
       • re-check for a new build on load + every 5 min,
       • and reload ONCE when a new build takes control,
     so code/style updates roll out without anyone clearing their cache. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        try{ reg.update(); }catch(e){}
        setInterval(() => { try{ reg.update(); }catch(e){} }, 5 * 60 * 1000);
      }).catch((e) => console.warn('[PWA] SW registration failed:', e));

      // When a NEW worker takes control, reload once to run the fresh assets.
      // Skip the very first install (no prior controller) so we don't reload
      // a brand-new visitor mid-boot, and NEVER reload during an active match
      // (that would yank the player out of a game) — defer until they're back
      // on the lobby/auth screen.
      let _swReloaded = false;
      const _inActiveGame = () =>
        document.getElementById('game-screen')?.classList.contains('active')
        || document.body.classList.contains('ronda-active')
        || document.body.classList.contains('dama-active');
      const _applyUpdate = () => {
        if (_swReloaded || !hadController) return;
        if (_inActiveGame()) { setTimeout(_applyUpdate, 8000); return; }   // wait until the match ends
        _swReloaded = true;
        console.log('[PWA] New build active — refreshing.');
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', _applyUpdate);
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
  