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
    try{
      const d=await api('POST','/auth/login',{username:u,password:p});
      // 2FA is enabled on this admin account. Prompt for the TOTP code
      // (or a backup code) and retry the login with it. We DON'T issue
      // a session until the second factor clears server-side.
      if(d?.twoFactorRequired){
        promptTwoFactor(u, p, d.hasBackupCodes);
        return;
      }
      onAuth(d.token,d.user);
    }catch(e){setErr(e.message);SFX.play('error');}
  }

  // Tiny inline 2FA modal. Re-submits /auth/login with either `code`
  // (6-digit TOTP) or `backupCode` (8-char base32). Closes itself on
  // success; surfaces the server error inline otherwise.
  function promptTwoFactor(username, password, hasBackup){
    const old = document.getElementById('twoFaModal'); if(old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'twoFaModal';
    ov.className = 'twofa-ov';
    ov.innerHTML = `
      <div class="twofa-box" role="dialog" aria-label="Two-factor authentication">
        <button class="twofa-close" aria-label="Cancel">×</button>
        <div class="twofa-icon">🔐</div>
        <div class="twofa-eyebrow">TWO-FACTOR AUTH</div>
        <div class="twofa-title">Enter your code</div>
        <div class="twofa-sub">Open your authenticator app and enter the 6-digit code for your RONDAONE admin account.</div>
        <input id="twoFaCode" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="123456" />
        <div class="twofa-err" id="twoFaErr"></div>
        <button class="twofa-submit" id="twoFaSubmit">VERIFY</button>
        ${hasBackup ? `<button class="twofa-link" id="twoFaUseBackup">Use a backup code instead</button>` : ''}
      </div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector('#twoFaCode');
    const errEl = ov.querySelector('#twoFaErr');
    let useBackup = false;
    setTimeout(()=>input.focus(), 50);
    ov.querySelector('.twofa-close').onclick = ()=> ov.remove();
    const submit = async () => {
      const val = input.value.trim();
      if(!val){ errEl.textContent = 'Enter the code from your authenticator app.'; return; }
      errEl.textContent = '';
      try{
        const body = { username, password };
        if(useBackup) body.backupCode = val;
        else          body.code       = val;
        const d = await api('POST','/auth/login', body);
        if(d?.twoFactorRequired){ errEl.textContent = 'Invalid code — try again.'; return; }
        ov.remove();
        onAuth(d.token, d.user);
      }catch(e){
        errEl.textContent = e?.message || 'Verification failed';
      }
    };
    ov.querySelector('#twoFaSubmit').onclick = submit;
    input.addEventListener('keydown', e => { if(e.key === 'Enter') submit(); });
    const useBackupBtn = ov.querySelector('#twoFaUseBackup');
    if(useBackupBtn){
      useBackupBtn.onclick = () => {
        useBackup = !useBackup;
        input.value = '';
        input.maxLength = useBackup ? 8 : 6;
        input.placeholder = useBackup ? 'ABCD1234' : '123456';
        input.inputMode = useBackup ? 'text' : 'numeric';
        ov.querySelector('.twofa-title').textContent = useBackup ? 'Backup code' : 'Enter your code';
        useBackupBtn.textContent = useBackup ? 'Use TOTP code instead' : 'Use a backup code instead';
        input.focus();
      };
    }
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
    // Reveal admin-only menu items if the server marked the session
    // as admin (sanitizeUser sets `isAdmin` from the server-only flag,
    // not from any client-visible secret). Endpoints re-check anyway.
    if(user?.isAdmin){
      const m=document.getElementById('adminPanelMenuItem');if(m)m.style.display='';
    }
    // A render error must never block login — show the lobby no matter what.
    try{ initSock(); }catch(e){ console.error('[Auth] initSock failed:',e); }
    try{ goLobby(); }
    catch(e){ console.error('[Auth] goLobby failed:',e); showScreen('lobby-screen'); }
  }
  // Permanent account deletion (App Store 5.1.1(v) requires this in-app).
  // Registered accounts confirm with their password; guests double-confirm.
  async function doDeleteAccount(){
    document.getElementById('lobbyMenu')?.classList.remove('show');
    const isGuest = !!S.user && /^guest/i.test(S.user.username || '');
    if(!confirm('⚠️ Delete your account PERMANENTLY?\n\nYour coins, rank, items and friends will be erased forever. This cannot be undone.')) return;
    let password = null;
    if(isGuest){
      if(!confirm('Really delete this account forever?')) return;
    } else {
      password = prompt('Enter your password to confirm deletion:');
      if(!password) return;
    }
    try{
      await apiFetch('/api/account/delete', { method:'POST', body: JSON.stringify({ password }), timeout: 8000 });
      toast('Account deleted. Goodbye 👋','s');
      setTimeout(()=>{ try{ doLogout(); }catch(e){ location.reload(); } }, 900);
    }catch(e){
      toast(e?.message || 'Could not delete account','e');
    }
  }
  window.doDeleteAccount = doDeleteAccount;

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
    ['profileOv','lbOv','rankedLbOv','rankedHubOv','tournOv','adminOv','coinsModal','mmov','winov','matchInvite','inviteToast','jbcOv','leagueOv','jBC','cosmeticsOv']
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

