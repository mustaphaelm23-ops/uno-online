  /* ═══ PRIVATE ROOM CODE ═══ */
  function showJoinByCode(){
    document.getElementById('joinCodeInput').value='';
    document.getElementById('joinCodeErr').textContent='';
    document.getElementById('joinCodeModal').classList.add('show');
    setTimeout(()=>document.getElementById('joinCodeInput').focus(),100);
  }

  async function doJoinByCode(){
    const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
    if(code.length !== 6) return document.getElementById('joinCodeErr').textContent='Enter 6 characters';
    document.getElementById('joinCodeErr').textContent='';
    try{
      const res = await apiFetch(`/api/rooms/code/${code}`);
      document.getElementById('joinCodeModal').classList.remove('show');
      doJoinRoom(res.roomId);
    } catch(e){
      document.getElementById('joinCodeErr').textContent = e.message||'Room not found';
    }
  }

  function showRoomCode(code){
    if(!code) return;
    S.roomCode = code;
    document.getElementById('roomCodeBox').style.display='block';
    document.getElementById('roomCodeDisplay').textContent = code;
  }

  function copyRoomCode(){
    if(!S.roomCode) return;
    navigator.clipboard.writeText(S.roomCode).then(()=>toast('Code copied!','s'));
  }

