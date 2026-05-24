  /* ═══ AUTH ═══ */
  function switchTab(tab){
    document.querySelectorAll('.tab').forEach((el,i)=>el.classList.toggle('on',(i===0&&tab==='login')||(i===1&&tab==='register')));
    document.getElementById('lf').style.display=tab==='login'?'block':'none';
    document.getElementById('rf').style.display=tab==='register'?'block':'none';
    document.getElementById('aerr').textContent='';
  }
  function togglePw(id,btn){
    const inp=document.getElementById(id); if(!inp)return;
    const reveal=inp.type==='password';
    inp.type=reveal?'text':'password';
    btn.textContent=reveal?'🙈':'👁';
    btn.classList.toggle('on',reveal);
  }
  function showForgot(){
    document.getElementById('authMain').style.display='none';
    document.getElementById('forgotForm').style.display='block';
    document.getElementById('aerr').textContent='';
  }
  function hideForgot(){
    document.getElementById('forgotForm').style.display='none';
    document.getElementById('authMain').style.display='block';
    document.getElementById('aerr').textContent='';
  }
  async function doLogin(){
    const u=document.getElementById('lu').value.trim(),p=document.getElementById('lp').value;
    if(!u||!p)return setErr(t('fillAll'));
    try{const d=await api('POST','/auth/login',{username:u,password:p});onAuth(d.token,d.user);}catch(e){setErr(e.message);SFX.play('error');}
  }
  async function doRegister(){
    const u=document.getElementById('ru').value.trim(),p=document.getElementById('rp').value;
    if(!u||!p)return setErr(t('fillAll'));
    try{const d=await api('POST','/auth/register',{username:u,password:p});onAuth(d.token,d.user);}catch(err){setErr(err.message);SFX.play('error');}
  }
  async function doGuest(){
    try{const d=await api('POST','/auth/guest',{});onAuth(d.token,d.user);}catch(e){setErr(e.message);SFX.play('error');}
  }
  async function doResetPassword(){
    const u=document.getElementById('fu').value.trim();
    const e=document.getElementById('fe').value.trim();
    const p=document.getElementById('fp').value;
    if(!u||!e||!p)return setErr(t('fillAll'));
    try{
      await api('POST','/auth/reset',{username:u,email:e,newPassword:p});
      hideForgot(); switchTab('login');
      document.getElementById('lu').value=u;
      document.getElementById('fp').value='';
      toast('✅ '+t('pwResetOk'),'s');
    }catch(err){setErr(err.message);SFX.play('error');}
  }
  function onAuth(token,user){
    S.token=token;S.user=user;
    try{
      localStorage.setItem('uno_token',token);
      localStorage.setItem('uno_user',JSON.stringify(user));
    }catch(e){}
    // Reveal admin-only menu items for the admin user
    if(user?.username && user.username.toLowerCase().includes('mustapha')){
      const m=document.getElementById('adminPanelMenuItem');if(m)m.style.display='';
    }
    // A render error must never block login — show the lobby no matter what.
    try{ initSock(); }catch(e){ console.error('[Auth] initSock failed:',e); }
    try{ goLobby(); }
    catch(e){ console.error('[Auth] goLobby failed:',e); showScreen('lobby-screen'); }
  }
  function doLogout(){
    // Thorough cleanup so the next login starts from a clean slate.
    localStorage.removeItem('uno_token');
    localStorage.removeItem('uno_user');
    S.token=null; S.user=null; S.roomId=null; S.isSpectator=false;
    try{ S.socket?.disconnect(); }catch(e){}
    S.socket=null;
    clearInterval(S.roomsTimer); S.roomsTimer=null;
    clearInterval(S.railTimer); S.railTimer=null;
    // Tear down any modals / overlays still hanging around.
    ['profileOv','lbOv','rankedLbOv','tournOv','adminOv','coinsModal','mmov','winov','matchInvite','inviteToast','jbcOv','leagueOv','jBC']
      .forEach(id=>document.getElementById(id)?.classList.remove('show'));
    ['gameCenter','arena-setup','avatarPicker','langPicker','bet-picker'].forEach(id=>document.getElementById(id)?.remove());
    document.getElementById('lobbyMenu')?.classList.remove('show');
    document.getElementById('gameMenu')?.classList.remove('show');
    // Reset the auth screen tabs to login by default.
    document.getElementById('forgotForm')?.style && (document.getElementById('forgotForm').style.display='none');
    document.getElementById('authMain')?.style && (document.getElementById('authMain').style.display='block');
    if(typeof switchTab==='function') switchTab('login');
    document.getElementById('aerr') && (document.getElementById('aerr').textContent='');
    showScreen('auth-screen');
  }
  function setErr(m){document.getElementById('aerr').textContent=m;}

