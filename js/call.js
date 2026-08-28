(() => {
  const socket = io(getBackendUrl(), { transports: ['websocket', 'polling'] });
  const qs = new URLSearchParams(location.search);
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const status = document.getElementById('connectionStatus');
  const message = document.getElementById('callMessage');
  const muteButton = document.getElementById('muteButton');
  const cameraButton = document.getElementById('cameraButton');
  const endButton = document.getElementById('endCallButton');
  const backButton = document.getElementById('backButton');

  let peer = null;
  let localStream = null;
  let currentUser = localStorage.getItem('videoCallUserId');
  let remoteUser = qs.get('user');
  let callType = qs.get('type') === 'audio' ? 'audio' : 'video';
  let incoming = qs.get('incoming') === '1';
  let pendingCandidates = [];
  let callStarted = false;

  function setMessage(text) { if (message) message.textContent = text; }
  function setStatus(text) { if (status) status.textContent = text; }

  async function startMedia() {
    if (localStream) return localStream;
    const constraints = callType === 'audio'
      ? { audio: true, video: false }
      : { audio: true, video: true };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (localVideo) localVideo.srcObject = localStream;
    return localStream;
  }

  async function createPeer(target) {
    if (peer) peer.close();
    pendingCandidates = [];
    peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', { to: target, candidate });
    };
    peer.ontrack = ({ streams }) => {
      if (remoteVideo && streams[0]) remoteVideo.srcObject = streams[0];
    };
    peer.onconnectionstatechange = () => {
      const state = peer?.connectionState || 'closed';
      setStatus(state === 'connected' ? 'Call connected' : `Call: ${state}`);
      if (state === 'connected') {
        callStarted = true;
        setMessage(`Connected to ${remoteUser}`);
      }
      if (['failed', 'closed'].includes(state)) setMessage('Call ended.');
    };

    const stream = await startMedia();
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    return peer;
  }

  async function flushCandidates() {
    if (!peer?.remoteDescription) return;
    for (const candidate of pendingCandidates.splice(0)) {
      try { await peer.addIceCandidate(candidate); } catch (error) { console.warn('ICE candidate failed', error); }
    }
  }

  async function startOutgoingCall() {
    if (!remoteUser) return setMessage('No user was selected.');
    try {
      setMessage(`Preparing ${callType} call…`);
      await startMedia();
      socket.emit('call-user', { to: remoteUser, callType }, async result => {
        if (!result?.success) return setMessage(result?.message || 'User is unavailable.');
        setMessage(`Calling ${remoteUser}…`);
      });
    } catch (error) {
      setMessage(`Camera/microphone permission failed: ${error.message}`);
    }
  }

  async function acceptIncomingCall() {
    try {
      await createPeer(remoteUser);
      socket.emit('accept-call', { to: remoteUser });
      setMessage(`Connecting to ${remoteUser}…`);
    } catch (error) {
      setMessage(`Permission failed: ${error.message}`);
      socket.emit('reject-call', { to: remoteUser });
    }
  }

  socket.on('connect', async () => {
    setStatus('Connected to server');
    if (!currentUser) {
      currentUser = prompt('Choose your temporary user ID:')?.trim();
      if (currentUser) localStorage.setItem('videoCallUserId', currentUser);
    }
    if (!currentUser) return setMessage('A user ID is required.');
    socket.emit('register', currentUser, async result => {
      if (!result?.success) return setMessage(result?.message || 'Registration failed.');
      if (incoming && remoteUser) await acceptIncomingCall();
      else if (remoteUser) await startOutgoingCall();
    });
  });

  socket.on('disconnect', () => setStatus('Server disconnected'));
  socket.on('connect_error', () => setStatus('Backend unavailable'));

  socket.on('call-accepted', async ({ from }) => {
    remoteUser = from;
    try {
      await createPeer(from);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('offer', { to: from, offer });
      setMessage(`Calling ${from}…`);
    } catch (error) { setMessage(`Unable to create call: ${error.message}`); }
  });

  socket.on('offer', async ({ from, offer }) => {
    remoteUser = from;
    try {
      if (!peer) await createPeer(from);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushCandidates();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
      setMessage(`Connecting to ${from}…`);
    } catch (error) { setMessage(`WebRTC error: ${error.message}`); }
  });

  socket.on('answer', async ({ answer }) => {
    try {
      if (!peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
      await flushCandidates();
      setMessage(`Connecting to ${remoteUser}…`);
    } catch (error) { setMessage(`WebRTC answer error: ${error.message}`); }
  });

  socket.on('ice-candidate', async ({ candidate }) => {
    if (!candidate) return;
    if (!peer?.remoteDescription) return pendingCandidates.push(candidate);
    try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (error) { console.warn('ICE error', error); }
  });

  socket.on('call-rejected', () => { setMessage(`${remoteUser || 'User'} rejected the call.`); cleanup(false); });
  socket.on('call-ended', () => { setMessage('The other user ended the call.'); cleanup(false); });
  socket.on('call-failed', ({ reason }) => setMessage(reason || 'Call failed.'));

  function cleanup(notify = true) {
    if (notify && remoteUser) socket.emit('end-call', { to: remoteUser });
    peer?.close(); peer = null;
    localStream?.getTracks().forEach(track => track.stop()); localStream = null;
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    callStarted = false;
  }

  muteButton?.addEventListener('click', () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return setMessage('Start the call first.');
    track.enabled = !track.enabled;
    muteButton.textContent = track.enabled ? '🎤 Mute' : '🔇 Unmute';
  });

  cameraButton?.addEventListener('click', () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return setMessage('Video is not active.');
    track.enabled = !track.enabled;
    cameraButton.textContent = track.enabled ? '📷 Camera off' : '📷 Camera on';
  });

  endButton?.addEventListener('click', () => { cleanup(true); setMessage('Call ended.'); });
  backButton?.addEventListener('click', () => { cleanup(true); location.href = 'index.html'; });
  window.videoCall = { cleanup };
})();
