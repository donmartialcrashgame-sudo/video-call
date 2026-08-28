(() => {
  const socket = createSocket();
  const qs = new URLSearchParams(location.search);
  const role = qs.get('role') === 'guest' ? 'guest' : 'host';
  const type = qs.get('type') === 'audio' ? 'audio' : 'video';
  let code = qs.get('code');
  const local = document.getElementById('localVideo');
  const remote = document.getElementById('remoteVideo');
  const status = document.getElementById('connectionStatus');
  const msg = document.getElementById('callMessage');
  const placeholder = document.getElementById('remotePlaceholder');
  const roomCode = document.getElementById('roomCode');
  const mute = document.getElementById('muteButton');
  const camera = document.getElementById('cameraButton');
  const end = document.getElementById('endCallButton');
  let pc = null, stream = null, pendingCandidates = [], ended = false, roomCreated = false;

  function setMsg(text){ if(msg) msg.textContent=text; }
  function setStatus(text){ if(status) status.innerHTML='<i></i> '+text; }
  function showCode(value){ code=value; roomCode.textContent=value; history.replaceState(null,'','call.html?code='+encodeURIComponent(value)+'&role=host&type='+type); }

  if (type === 'audio') camera.style.display='none';
  if (role === 'host' && code) { code = null; }
  if (role === 'guest' && !code) { setMsg('No call code was supplied. Return to the home page.'); return; }
  roomCode.textContent = code || '------';

  async function getMedia(){
    if(stream) return stream;
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone access is not supported by this browser.');
    stream=await navigator.mediaDevices.getUserMedia(type==='audio'?{audio:true,video:false}:{audio:true,video:true});
    local.srcObject=stream; await local.play().catch(()=>{}); return stream;
  }

  function createPeer(){
    if(pc) return pc;
    pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
    pc.onicecandidate=e=>{if(e.candidate&&code)socket.emit('ice-candidate',{code,candidate:e.candidate});};
    pc.ontrack=e=>{const s=e.streams?.[0];if(s){remote.srcObject=s;remote.play().catch(()=>{});placeholder.classList.add('hidden');}};
    pc.onconnectionstatechange=()=>{const s=pc?.connectionState;if(s==='connected'){setStatus('Connected');setMsg('Call connected.');}else if(s==='connecting'){setStatus('Connecting');setMsg('Connecting your call…');}else if(s==='failed'){setStatus('Connection failed');setMsg('The video connection failed. Try the call again.');}else if(s==='disconnected')setStatus('Disconnected');};
    return pc;
  }
  async function preparePeer(){const peer=createPeer();const media=await getMedia();const existing=peer.getSenders().map(x=>x.track).filter(Boolean);media.getTracks().forEach(t=>{if(!existing.includes(t))peer.addTrack(t,media);});return peer;}
  async function flushCandidates(){if(!pc?.remoteDescription)return;for(const c of pendingCandidates.splice(0)){try{await pc.addIceCandidate(new RTCIceCandidate(c));}catch(e){console.warn(e);}}}

  async function hostStart(){
    try{
      setMsg('Please allow camera and microphone access…');
      await getMedia();
      socket.emit('create-room',{},response=>{
        if(!response?.success){setMsg(response?.message||'Could not create the call room.');return;}
        roomCreated=true;showCode(response.code);setStatus('Waiting');setMsg('Your call code is '+response.code+'. Share it with the other person.');
      });
    }catch(e){setMsg('Camera/microphone permission was not granted: '+e.message);}
  }
  async function guestStart(){
    try{
      setMsg('Please allow camera and microphone access…');
      await getMedia();
      socket.emit('join-room',{code},response=>{
        if(!response?.success){setMsg(response?.message||'This call code is invalid or expired.');return;}
        roomCreated=true;setStatus('Waiting');setMsg('Joined. Waiting for the host…');preparePeer().catch(e=>setMsg(e.message));
      });
    }catch(e){setMsg('Camera/microphone permission was not granted: '+e.message);}
  }

  socket.on('connect',()=>{setStatus('Connected to server');if(role==='host')hostStart();else guestStart();});
  socket.on('connect_error',()=>setStatus('Backend unavailable'));
  socket.on('disconnect',()=>{if(!ended)setStatus('Server disconnected');});

  socket.on('peer-joined',async()=>{if(role!=='host'||!roomCreated||ended)return;try{const peer=await preparePeer();const offer=await peer.createOffer();await peer.setLocalDescription(offer);socket.emit('offer',{code,offer:peer.localDescription});setMsg('Calling the other person…');}catch(e){setMsg('Could not start the video call: '+e.message);}});
  socket.on('offer',async({offer})=>{try{const peer=await preparePeer();await peer.setRemoteDescription(new RTCSessionDescription(offer));await flushCandidates();const answer=await peer.createAnswer();await peer.setLocalDescription(answer);socket.emit('answer',{code,answer:peer.localDescription});setMsg('Connecting…');}catch(e){setMsg('WebRTC offer error: '+e.message);}});
  socket.on('answer',async({answer})=>{try{if(!pc)return;await pc.setRemoteDescription(new RTCSessionDescription(answer));await flushCandidates();setMsg('Connecting…');}catch(e){setMsg('WebRTC answer error: '+e.message);}});
  socket.on('ice-candidate',async({candidate})=>{if(!candidate)return;if(!pc?.remoteDescription){pendingCandidates.push(candidate);return;}try{await pc.addIceCandidate(new RTCIceCandidate(candidate));}catch(e){console.warn(e);}});

  function cleanup(notify=true){ended=true;if(notify&&code)socket.emit('end-call',{code});pc?.close();pc=null;stream?.getTracks().forEach(t=>t.stop());stream=null;local.srcObject=null;remote.srcObject=null;}
  mute.onclick=()=>{const t=stream?.getAudioTracks()[0];if(!t)return setMsg('Microphone is not ready.');t.enabled=!t.enabled;mute.textContent=t.enabled?'🎤 Mute':'🔇 Unmute';};
  camera.onclick=()=>{const t=stream?.getVideoTracks()[0];if(!t)return setMsg('Camera is not ready.');t.enabled=!t.enabled;camera.textContent=t.enabled?'📷 Camera off':'📷 Camera on';};
  end.onclick=()=>{cleanup(true);location.href='index.html';};
  socket.on('peer-left',()=>{if(ended)return;cleanup(false);setStatus('Call ended');setMsg('The other person left the call.');});
  socket.on('call-ended',()=>{if(ended)return;cleanup(false);setStatus('Call ended');setMsg('The other person ended the call.');});
})();
