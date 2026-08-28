// VideoApp notification enhancement
window.VideoAppNotifications = {
  show(sender, body) {
    let card = document.getElementById('messageNotification');
    if (!card) {
      card = document.createElement('div');
      card.id = 'messageNotification';
      card.className = 'in-app-notification';
      card.innerHTML = '<div class="notification-icon"><i class="fa-solid fa-message"></i></div><div class="notification-copy"><strong></strong><span></span></div><button class="notification-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>';
      document.body.appendChild(card);
      card.querySelector('.notification-close').onclick = () => card.classList.remove('show');
    }
    card.querySelector('strong').textContent = sender || 'VideoApp';
    card.querySelector('span').textContent = body || 'New message';
    card.classList.add('show');
    clearTimeout(card._timer);
    card._timer = setTimeout(() => card.classList.remove('show'), 5000);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(sender || 'VideoApp', { body: body || 'New message' }); } catch (_) {}
    }
  }
};
