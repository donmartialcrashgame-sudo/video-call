// Frontend configuration for the separate Node.js/Socket.IO signaling backend.
window.APP_CONFIG = {
  BACKEND_URL: 'https://video-call-app-1dav.onrender.com'
};

window.getBackendUrl = function () {
  return String(window.APP_CONFIG.BACKEND_URL).replace(/\/$/, '');
};
