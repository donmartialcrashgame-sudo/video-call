window.APP_CONFIG = {
  BACKEND_URL: 'https://video-call-app-1dav.onrender.com'
};

window.getBackendUrl = function () {
  return String(window.APP_CONFIG.BACKEND_URL).replace(/\/$/, '');
};

window.createSocket = function () {
  return io(window.getBackendUrl(), {
    transports: ['websocket', 'polling'],
    reconnection: true,
    timeout: 10000
  });
};
