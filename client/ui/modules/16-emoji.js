  /* ═══ ENTER KEY for auth ═══ */
  /* ═══ EMOJI REACTIONS ═══ */
  function toggleEmojiPicker(){
    document.getElementById('emojiPicker').classList.toggle('show');
  }

  const EMOJI_COOLDOWN_MS = 5000;
  let _emojiNextAt = 0;
  let _emojiCooldownTimer = null;

  function _getCardAreaCenter(){
    const top = document.getElementById('topcard');
    const r = top?.getBoundingClientRect();
    if(r && r.width){
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }
    return { x: window.innerWidth/2, y: window.innerHeight/2 };
  }

  function _renderEmojiCooldown(remainingMs){
    const picker = document.getElementById('emojiPicker');
    if(!picker) return;
    const existing = picker.querySelector('.cooling-label');
    if(remainingMs <= 0){
      picker.classList.remove('cooling');
      if(existing) existing.remove();
      return;
    }
    picker.classList.add('cooling');
    const txt = `⏳ Wait ${Math.ceil(remainingMs/1000)}s`;
    if(existing){existing.textContent = txt;return;}
    const lbl = document.createElement('div');
    lbl.className='cooling-label';lbl.textContent=txt;
    picker.appendChild(lbl);
  }

  function sendReaction(emoji){
    if(!S.socket||!S.roomId) return;
    const now = Date.now();
    const remaining = _emojiNextAt - now;
    if(remaining > 0){
      toast(`⏳ Wait ${Math.ceil(remaining/1000)}s before next emoji`,'i');
      _renderEmojiCooldown(remaining);
      return;
    }
    document.getElementById('emojiPicker').classList.remove('show');
    const center = _getCardAreaCenter();
    showReactionFly(emoji, center.x, center.y, true);
    S.socket.emit('game:reaction',{emoji});
    _emojiNextAt = now + EMOJI_COOLDOWN_MS;
    _renderEmojiCooldown(EMOJI_COOLDOWN_MS);
    if(_emojiCooldownTimer) clearInterval(_emojiCooldownTimer);
    _emojiCooldownTimer = setInterval(()=>{
      const left = _emojiNextAt - Date.now();
      _renderEmojiCooldown(left);
      if(left <= 0){clearInterval(_emojiCooldownTimer);_emojiCooldownTimer=null;}
    }, 250);
  }

  function showReactionFly(emoji, x, y, isMine){
    const el = document.createElement('div');
    el.className='reaction-fly';
    el.textContent=emoji;
    el.style.cssText=`left:${x-21}px;top:${y-21}px;`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1700);
  }

  function showReactionOnPanel(emoji, playerId){
    const panel = document.querySelector(`.opanel[data-pid="${playerId}"]`);
    if(panel){
      const badge = document.createElement('div');
      badge.className='reaction-badge';
      badge.textContent=emoji;
      panel.style.position='relative';
      panel.appendChild(badge);
      setTimeout(()=>badge.remove(),2100);
    }
    const center = _getCardAreaCenter();
    showReactionFly(emoji, center.x, center.y, false);
  }

