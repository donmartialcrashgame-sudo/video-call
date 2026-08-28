(() => {
  const backendUrl = typeof getBackendUrl === 'function' ? getBackendUrl() : 'http://localhost:3000';
  const socket = io(backendUrl, { transports: ['websocket', 'polling'] });
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const status = document.getElementById('connectionStatus');
  const message = document.getElementById('callMessage');
  const muteButton = document.getElementById('muteButton');
  const cameraButton = document.getElementById('cameraButton');
  const endButton = document.getElementById('endCallButton');
  const backButton = document.getElementById('backButton');

  let peer;
  let localStream;
  let remoteUser = new URLSearchParams(location.search).get('user');
  let currentUser = localStorage.getItem('videoCallUserId');
  let pendingCandidates = [];

  if (!currentUser) {
    currentUser = prompt('Choose your temporary user ID:')?.trim();
    if (currentUser) localStorage.setItem('videoCallUserId', currentUser);
  }

  function setMessage(text) { if (message) message.textContent = text; }
  function setStatus(text) { if (status) status.textContent = text; }

  socket.on('connect', () => {
    setStatus('Connected');
    if (currentUser) socket.emit('register', currentUser);
  });
  socket.on('disconnect', () => setStatus('Disconnected'));
  socket.on('connect_error', () => setStatus('Backend unavailable'));

  async function createPeer(target) {
    if (peer) peer.close();
    pendingCandidates = [];
    peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    peer.onicecandidate = event => {
      if (event.candidate) socket.emit('ice-candidate', { to: target, candidate: event.candidate });
    };
    peer.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
    };
    peer.onconnectionstatechange = () => {
      setStatus(`Call: ${peer.connectionState}`);
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) setMessage('Connection ended or failed.');
    };

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    return peer;
  }

  async function flushCandidates() {
    for (const candidate of pendingCandidates.splice(0)) {
      try { await peer.addIceCandidate(candidate); } catch (_) {}
    }
  }

  async function call(target, type = 'video') {
    if (!target || !currentUser) return setMessage('Enter a user ID first.');
    try {
      await createPeer(target);
      socket.emit('call-request', { to: target, callType: type }, result => {
        if (!result?.success) return setMessage(result?.message || 'Call could not be started.');
        remoteUser = target;
        setMessage(`Calling ${target}…`);
      });
    } catch (error) {
      setMessage(`Camera/microphone permission failed: ${error.message}`);
    }
  }

  socket.on('incoming-call', async ({ from, callType }) => {
    remoteUser = from;
    const accepted = window.confirm(`${from} is calling you. Accept ${callType} call?`);
    if (!accepted) {
      socket.emit('call-rejected', { to: from });
      return;
    }
    try {
      await createPeer(from);
      socket.emit('call-accepted', { to: from });
      setMessage(`Connected to ${from}`);
    } catch (error) {
      setMessage(`Permission failed: ${error.message}`);
      socket.emit('call-rejected', { to: from });
    }
  });

  socket.on('call-accepted', async ({ from }) => {
    if (!peer) await createPeer(from);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit('offer', { to: from, offer });
    setMessage(`Calling ${from}…`);
  });

  socket.on('offer', async ({ from, offer }) => {
    remoteUser = from;
    if (!peer) await createPeer(from);
    await peer.setRemoteDescription(offer);
    await flushCandidates();
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('answer', { to: from, answer });
    setMessage(`Connected to ${from}`);
  });

  socket.on('answer', async ({ answer }) => {
    if (!peer) return;
    await peer.setRemoteDescription(answer);
    await flushCandidates();
    setMessage(`Connected to ${remoteUser}`);
  });

  socket.on('ice-candidate', async ({ candidate }) => {
    if (!peer || !peer.remoteDescription) {
      pendingCandidates.push(candidate);
      return;
    }
    try { await peer.addIceCandidate(candidate); } catch (_) {}
  });

  socket.on('call-rejected', () => setMessage('Call rejected.'));
  socket.on('call-ended', () => cleanup(false));

  function cleanup(notify = true) {
    if (notify && remoteUser) socket.emit('call-ended', { to: remoteUser });
    peer?.close();
    peer = null;
    localStream?.getTracks().forEach(track => track.stop());
    localStream = null;
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    setStatus('Connected');
    setMessage('Ready for another call.');
  }

  muteButton?.addEventListener('click', () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return setMessage('Start a call first.');
    track.enabled = !track.enabled;
    muteButton.textContent = track.enabled ? '🎤 Mute' : '🔇 Unmute';
  });

  cameraButton?.addEventListener('click', () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return setMessage('Start a video call first.');
    track.enabled = !track.enabled;
    cameraButton.textContent = track.enabled ? '📷 Camera off' : '📷 Camera on';
  });

  endButton?.addEventListener('click', () => cleanup(true));
  backButton?.addEventListener('click', () => { cleanup(true); history.back(); });

  window.videoCall = { call, cleanup, get currentUser() { return currentUser; } };
})();
