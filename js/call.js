(() => {
  const socket = io(getBackendUrl(), { transports: ['websocket', 'polling'] });
  const qs = new URLSearchParams(location.search);
  const code = qs.get('code');
  const role = qs.get('role') === 'guest' ? 'guest' : 'host';
  const type = qs.get('type') === 'audio' ? 'audio' : 'video';
  const local = document.getElementById('localVideo'); const remote = document.getElementById('remoteVideo');
  const status = document.getElementById('connectionStatus'); const msg = document.getElementById('callMessage');
  const title = document.getElementById('callTitle'); const placeholder = document.getElementById('remotePlaceholder');
  const roomCode = document.getElementById('roomCode'); const mute = document.getElementById('muteButton'); const camera = document.getElementById('cameraButton'); const end = document.getElementById('endCallButton');
  let pc = null, stream = null, pending = [], connected = false;
  if (roomCode) roomCode.textContent = code || '------';
  function setMsg(v){if(msg)msg.textContent=v} function setStatus(v){if(status)status.innerHTML='<i></i> '+v}
  async function media(){ if(stream)return stream; stream=await navigator.mediaDevices.getUserMedia(type==='audio'?{audio:true,video:false}:{audio:true,video:true}); if(local)local.srcObject=stream; if(type==='audio'&&camera)camera.style.display='none'; return stream }
  async function peer(){
    if(pc)pc.close(); pending=[]; pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
    pc.onicecandidate=e=>{if(e.candidate)socket.emit('ice-candidate',{code,candidate:e.candidate})};
    pc.ontrack=e=>{if(remote&&e.streams[0]){remote.srcObject=e.streams[0];placeholder?.classList.add('hidden')}};
    pc.onconnectionstatechange=()=>{const s=pc?.connectionState||'closed';setStatus(s==='connected'?'Connected':s);if(s==='connected'){connected=true;setMsg('Call connected.');}if(s==='failed')setMsg('Connection failed. Try again.');};
    const s=await media();s.getTracks().forEach(t=>pc.addTrack(t,s)); return pc;
  }
  async function flush(){if(!pc?.remoteDescription)return;for(const c of pending.splice(0)){try{await pc.addIceCandidate(new RTCIceCandidate(c))}catch(e){console.warn(e)}}}
  socket.on('connect',async()=>{
    setStatus('Connected to server');
    if(!code)return setMsg('Missing call code.');
    if(role==='host'){
      try{await media();setMsg(`Your code is ${code}. Waiting for someone to join…`)}catch(e){setMsg(`Camera/microphone permission failed: ${e.message}`)}
    } else {
      try{const r=await new Promise(resolve=>socket.emit('join-room',{code},resolve));if(!r?.success)return setMsg(r?.message||'Unable to join this call.');await peer();setMsg('Joined. Waiting for the host…')}catch(e){setMsg(`Camera/microphone permission failed: ${e.message}`)}
    }
  });
  socket.on('connect_error',()=>setStatus('Backend unavailable')); socket.on('disconnect',()=>setStatus('Disconnected'));
  socket.on('peer-joined',async()=>{if(role!=='host')return;try{await peer();const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit('offer',{code,offer});setMsg('Connecting…')}catch(e){setMsg(`Unable to start call: ${e.message}`)}});
  socket.on('offer',async({offer})=>{try{if(!pc)await peer();await pc.setRemoteDescription(new RTCSessionDescription(offer));await flush();const answer=await pc.createAnswer();await pc.setLocalDescription(answer);socket.emit('answer',{code,answer});setMsg('Connecting…')}catch(e){setMsg(`WebRTC error: ${e.message}`)}});
  socket.on('answer',async({answer})=>{try{await pc.setRemoteDescription(new RTCSessionDescription(answer));await flush();setMsg('Connecting…')}catch(e){setMsg(`WebRTC error: ${e.message}`)}});
  socket.on('ice-candidate',async({candidate})=>{if(!candidate)return;if(!pc?.remoteDescription)return pending.push(candidate);try{await pc.addIceCandidate(new RTCIceCandidate(candidate))}catch(e){console.warn(e)}});
  socket.on('peer-left',()=>{cleanup(false);setMsg('The other person left the call.');});socket.on('call-ended',()=>{cleanup(false);setMsg('Call ended by the other person.');});
  function cleanup(notify=true){if(notify&&code)socket.emit('end-call',{code});pc?.close();pc=null;stream?.getTracks().forEach(t=>t.stop());stream=null;if(local)local.srcObject=null;if(remote)remote.srcObject=null;connected=false;}
  mute?.addEventListener('click',()=>{const t=stream?.getAudioTracks()[0];if(!t)return setMsg('Microphone is not ready.');t.enabled=!t.enabled;mute.textContent=t.enabled?'🎤 Mute':'🔇 Unmute'});
  camera?.addEventListener('click',()=>{const t=stream?.getVideoTracks()[0];if(!t)return setMsg('Camera is not ready.');t.enabled=!t.enabled;camera.textContent=t.enabled?'📷 Camera off':'📷 Camera on'});
  end?.addEventListener('click',()=>{cleanup(true);setMsg('Call ended.');setTimeout(()=>location.href='index.html',500)});
})();
