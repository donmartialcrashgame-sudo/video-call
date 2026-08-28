// Frontend configuration for the separate signaling backend.
// Change this URL after deploying your Node.js/Socket.IO backend on Render.
window.APP_CONFIG = {
  BACKEND_URL: window.BACKEND_URL || 'http://localhost:3000'
};

window.getBackendUrl = function () {
  return String(window.APP_CONFIG.BACKEND_URL).replace(/\/$/, '');
};
