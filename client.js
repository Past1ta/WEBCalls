// Improved client with UI controls: nickname, generate room, toggle mic/cam, leave.
let pc = null;
let ws = null;
let localStream = null;
const local = document.getElementById('local');
const remote = document.getElementById('remote');
const joinBtn = document.getElementById('join');
const leaveBtn = document.getElementById('leave');
const roomInp = document.getElementById('room');
const genBtn = document.getElementById('gen');
const nickInp = document.getElementById('nick');
const toggleAudio = document.getElementById('toggleAudio');
const toggleVideo = document.getElementById('toggleVideo');
const status = document.getElementById('status');
const linkEl = document.getElementById('link');
const peersEl = document.getElementById('peers');
const copyBtn = document.getElementById('copyLink');

function uuid4() {
  return 'xxxx-xxxx'.replace(/[x]/g, (c)=> Math.floor(Math.random()*16).toString(16));
}

function setStatus(s){ status.textContent = s; }

function updateLink(room){
  const url = `${location.origin}/static/index.html?room=${room}`;
  linkEl.textContent = url;
}

if(copyBtn){
  copyBtn.addEventListener('click', ()=>{
    if(!linkEl.textContent) return;
    navigator.clipboard.writeText(linkEl.textContent).then(()=>{ copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy',1200); });
  });
}

function wsSend(obj){ if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); }

async function ensureMedia(){
  if(!localStream){
    localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
    local.srcObject = localStream;
  }
}

function makePC(){
  pc = new RTCPeerConnection({ iceServers:[{urls:'stun:stun.l.google.com:19302'}] });
  pc.onicecandidate = (e) => { if(e.candidate) wsSend({type:'candidate', candidate:e.candidate}); };
  pc.ontrack = (e) => { remote.srcObject = e.streams[0]; };
  // attach local tracks
  if(localStream){ for(const t of localStream.getTracks()) pc.addTrack(t, localStream); }
}

async function join(){
  const room = roomInp.value || uuid4();
  roomInp.value = room;
  updateLink(room);
  const nick = nickInp.value || 'Guest';

  await ensureMedia();
  ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws/${room}`);

  ws.addEventListener('open', () => {
    setStatus('Connected to signaling');
    wsSend({type:'join', nick});
    joinBtn.style.display='none'; leaveBtn.style.display='inline-block';
  });

  ws.addEventListener('message', async (ev) => {
    let msg;
    try{ msg = JSON.parse(ev.data); }catch(e){ console.warn('bad msg',ev.data); return; }

    if(msg.type === 'peers'){
      // simple peers list
      peersEl.innerHTML = '';
      (msg.list||[]).forEach(p=>{ const li=document.createElement('li'); li.textContent = p; peersEl.appendChild(li); });
      // show count
      const cnt = (msg.list||[]).length;
      setStatus(`Participants: ${cnt}`);
      return;
    }

    if(msg.type === 'offer'){
      if(!pc) makePC();
      await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend({type:'answer', answer: pc.localDescription});
      setStatus('In call');
      return;
    }

    if(msg.type === 'answer'){
      if(pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
      setStatus('In call');
      return;
    }

    if(msg.type === 'candidate'){
      if(pc) try{ await pc.addIceCandidate(msg.candidate); }catch(e){ console.warn(e); }
      return;
    }

    if(msg.type === 'join' && msg.nick){
      // existing peer informed us that they exist -> if we are new, create offer
      if(!pc) makePC();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsSend({type:'offer', offer: pc.localDescription});
    }
  });

  ws.addEventListener('close', ()=>{ setStatus('Signaling disconnected'); });
}

async function leave(){
  if(ws) { ws.close(); ws = null; }
  if(pc){ pc.close(); pc = null; }
  if(localStream){ for(const t of localStream.getTracks()){ t.stop(); } localStream = null; local.srcObject = null; }
  remote.srcObject = null;
  setStatus('Disconnected');
  joinBtn.style.display='inline-block'; leaveBtn.style.display='none';
}

genBtn.addEventListener('click', ()=>{ roomInp.value = uuid4(); updateLink(roomInp.value); });
joinBtn.addEventListener('click', join);
leaveBtn.addEventListener('click', leave);

toggleAudio.addEventListener('click', ()=>{
  if(!localStream) return;
  const a = localStream.getAudioTracks()[0]; if(!a) return;
  a.enabled = !a.enabled; toggleAudio.textContent = a.enabled ? 'Mute mic' : 'Unmute';
});

toggleVideo.addEventListener('click', ()=>{
  if(!localStream) return;
  const v = localStream.getVideoTracks()[0]; if(!v) return;
  v.enabled = !v.enabled; toggleVideo.textContent = v.enabled ? 'Disable cam' : 'Enable cam';
});

// parse room from query if present
const params = new URLSearchParams(location.search);
if(params.get('room')){ roomInp.value = params.get('room'); updateLink(params.get('room')); }

setStatus('Ready');