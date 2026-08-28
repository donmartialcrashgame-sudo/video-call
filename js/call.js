(() => {
  const socket = createSocket();
  const qs = new URLSearchParams(location.search);
  const code = qs.get('code');
  const role = qs.get('role') === 'guest' ? 'guest' : 'host';
  const type = qs.get('type') === 'audio' ? 'audio' : 'video';
  const local = document.getElementById('localVideo');
  const remote = document.getElementById('remoteVideo');
  const status = document.getElementById('connectionStatus');
  const msg = document.getElementById('callMessage');
  const placeholder = document.getElementById('remotePlaceholder');
  const title = document.getElementById('callTitle');
  const roomCode = document.getElementById('roomCode');
  const mute = document.getElementById('muteButton');
  const camera = document.getElementById('cameraButton');
  const end = document.getElementById('endCallButton');

  let pc = null;
  let stream = null;
  let pendingCandidates = [];
  let ended = false;

  if (!code) {
    setMsg('No call code was supplied. Return to the home page and start or join a call.');
    return;
  }
  roomCode.textContent = code;
  if (type === 'audio') camera.style.display = 'none';

  function setMsg(text) { if (msg) msg.textContent = text; }
  function setStatus(text) { if (status) status.innerHTML = '<i></i> ' + text; }

  async function getMedia() {
    if (stream) return stream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone access is not supported by this browser.');
    const constraints = type === 'audio' ? { audio: true, video: false } : { audio: true, video: true };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    local.srcObject = stream;
    await local.play().catch(() => {});
    return stream;
  }

  function createPeer() {
    if (pc) return pc;
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    pc.onicecandidate = event => {
      if (event.candidate) socket.emit('ice-candidate', { code, candidate: event.candidate });
    };
    pc.ontrack = event => {
      const remoteStream = event.streams?.[0];
      if (remoteStream) {
        remote.srcObject = remoteStream;
        remote.play().catch(() => {});
        placeholder.classList.add('hidden');
      }
    };
    pc.onconnectionstatechange = () => {
      const state = pc?.connectionState;
      if (state === 'connected') { setStatus('Connected'); setMsg('Call connected.'); }
      else if (state === 'connecting') { setStatus('Connecting'); setMsg('Connecting your call…'); }
      else if (state === 'failed') { setStatus('Connection failed'); setMsg('WebRTC could not connect. Try both devices again.'); }
      else if (state === 'disconnected') setStatus('Disconnected');
    };
    return pc;
  }

  async function preparePeer() {
    const peer = createPeer();
    const media = await getMedia();
    const existing = peer.getSenders().map(sender => sender.track).filter(Boolean);
    media.getTracks().forEach(track => { if (!existing.includes(track)) peer.addTrack(track, media); });
    return peer;
  }

  async function flushCandidates() {
    if (!pc?.remoteDescription) return;
    const candidates = pendingCandidates.splice(0);
    for (const candidate of candidates) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (error) { console.warn('ICE candidate failed', error); }
    }
  }

  async function startHost() {
    try {
      await getMedia();
      setMsg(`Your call code is ${code}. Waiting for the other person…`);
      setStatus('Waiting');
    } catch (error) {
      setMsg(`Camera/microphone permission was not granted: ${error.message}`);
    }
  }

  async function joinGuest() {
    try {
      const result = await new Promise(resolve => {
        socket.emit('join-room', { code }, response => resolve(response));
      });
      if (!result?.success) { setMsg(result?.message || 'Unable to join this call.'); return; }
      await preparePeer();
      setMsg('Joined the call. Waiting for the host to start the connection…');
      setStatus('Waiting');
    } catch (error) {
      setMsg(`Camera/microphone permission was not granted: ${error.message}`);
    }
  }

  socket.on('connect', async () => {
    setStatus('Connected to server');
    if (role === 'host') await startHost();
    else await joinGuest();
  });
  socket.on('connect_error', () => setStatus('Backend unavailable'));
  socket.on('disconnect', () => { if (!ended) setStatus('Server disconnected'); });

  socket.on('peer-joined', async () => {
    if (role !== 'host' || ended) return;
    try {
      const peer = await preparePeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('offer', { code, offer: peer.localDescription });
      setMsg('Calling the other person…');
    } catch (error) { setMsg(`Could not start the call: ${error.message}`); }
  });

  socket.on('offer', async ({ offer }) => {
    try {
      const peer = await preparePeer();
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', { code, answer: peer.localDescription });
      setMsg('Connecting…');
    } catch (error) { setMsg(`WebRTC offer error: ${error.message}`); }
  });

  socket.on('answer', async ({ answer }) => {
    try {
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushCandidates();
      setMsg('Connecting…');
    } catch (error) { setMsg(`WebRTC answer error: ${error.message}`); }
  });

  socket.on('ice-candidate', async ({ candidate }) => {
    if (!candidate) return;
    if (!pc?.remoteDescription) { pendingCandidates.push(candidate); return; }
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (error) { console.warn('ICE error', error); }
  });

  function cleanup(notify = true) {
    ended = true;
    if (notify && code) socket.emit('end-call', { code });
    if (pc) { pc.close(); pc = null; }
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    local.srcObject = null;
    remote.srcObject = null;
  }

  mute.onclick = () => {
    const track = stream?.getAudioTracks()[0];
    if (!track) return setMsg('Microphone is not ready.');
    track.enabled = !track.enabled;
    mute.textContent = track.enabled ? '🎤 Mute' : '🔇 Unmute';
  };
  camera.onclick = () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return setMsg('Camera is not ready.');
    track.enabled = !track.enabled;
    camera.textContent = track.enabled ? '📷 Camera off' : '📷 Camera on';
  };
  end.onclick = () => { cleanup(true); location.href = 'index.html'; };

  socket.on('peer-left', () => { cleanup(false); setMsg('The other person left the call.'); setStatus('Call ended'); });
  socket.on('call-ended', () => { cleanup(false); setMsg('The other person ended the call.'); setStatus('Call ended'); });
})();
