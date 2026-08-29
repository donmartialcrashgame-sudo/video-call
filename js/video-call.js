// VideoApp WebRTC calling foundation
// Uses Supabase Realtime for call signalling.

window.VideoCall = (() => {
  let peer;
  let localStream;
  let channel;

  async function startMedia(video = true) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video
    });
    return localStream;
  }

  async function createPeer() {
    peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    if (localStream) {
      localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
      });
    }

    return peer;
  }

  async function initCall(conversationId) {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error('Supabase not connected');

    await startMedia(true);
    await createPeer();

    channel = supabase.channel(`call-${conversationId}`);

    await channel.subscribe();

    return { peer, localStream };
  }

  function endCall() {
    if (peer) peer.close();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (channel) window.supabaseClient.removeChannel(channel);
  }

  return {
    initCall,
    endCall
  };
})();
