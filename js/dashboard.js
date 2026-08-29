document.addEventListener('DOMContentLoaded', () => {
  const client = window.supabaseClient;
  const chatList = document.getElementById('chatList');
  const messagesArea = document.getElementById('messagesArea');
  const messageInput = document.getElementById('messageInput');
  const messageForm = document.getElementById('messageForm');
  const popup = document.getElementById('popup');
  const appLayout = document.querySelector('.app-layout');
  const mobileBack = document.getElementById('mobileBack');
  let currentUser = null;

  const popupMessage = (message, type='') => {
    if (!popup) return;
    popup.textContent = message;
    popup.className = `popup show ${type}`;
    clearTimeout(popupMessage.timer);
    popupMessage.timer = setTimeout(() => popup.className = 'popup', 2600);
  };

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function addOfficialChat() {
    if (!chatList || chatList.querySelector('[data-official]')) return;
    const item = document.createElement('button');
    item.type = 'button'; item.className = 'chat-item'; item.dataset.official = 'true';
    item.innerHTML = '<span class="chat-avatar official"><i class="fa-solid fa-video"></i></span><span class="chat-item-main"><span class="chat-item-top"><strong>VideoApp Official ✓</strong><time>Now</time></span><span class="chat-item-bottom"><span>Welcome to VideoApp</span></span></span>';
    item.addEventListener('click', () => openOfficial());
    chatList.prepend(item);
  }

  function openOfficial() {
    document.getElementById('chatTitle').textContent = 'VideoApp Official ✓';
    document.getElementById('chatStatus').textContent = 'Online';
    const avatar = document.getElementById('chatAvatar');
    if (avatar) avatar.innerHTML = '<i class="fa-solid fa-video"></i>';
    messagesArea.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon"><i class="fa-solid fa-comments"></i></div><h3>No messages yet</h3><p>Start a conversation with VideoApp Official</p></div>';
    appLayout?.classList.add('chat-open');
  }

  async function loadChats() {
    addOfficialChat();
    if (!client || !currentUser || !chatList) return;
    try {
      const { data: memberships, error } = await client.from('conversation_members').select('conversation_id').eq('user_id', currentUser.id).limit(100);
      if (error || !memberships?.length) return;
      const ids = memberships.map(x => x.conversation_id).filter(Boolean);
      const { data: conversations, error: convError } = await client.from('conversations').select('id,title').in('id', ids);
      if (convError) return;
      (conversations || []).forEach(c => {
        const item = document.createElement('button'); item.type='button'; item.className='chat-item'; item.dataset.conversationId=c.id;
        item.innerHTML = `<span class="chat-avatar">${escapeHTML((c.title || 'C').charAt(0).toUpperCase())}</span><span class="chat-item-main"><span class="chat-item-top"><strong>${escapeHTML(c.title || 'Conversation')}</strong></span><span class="chat-item-bottom"><span>Open chat</span></span></span>`;
        item.addEventListener('click', () => openConversation(c));
        chatList.appendChild(item);
      });
    } catch (e) { console.error('Chat loading error:', e); }
  }

  function openConversation(conversation) {
    appLayout?.classList.add('chat-open');
    document.getElementById('chatTitle').textContent = conversation.title || 'Conversation';
    document.getElementById('chatStatus').textContent = 'Online';
    messagesArea.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon"><i class="fa-solid fa-comments"></i></div><h3>No messages yet</h3><p>Start a conversation</p></div>';
  }

  async function start() {
    // Never block the dashboard waiting for chat data.
    if (!client) { popupMessage('Supabase is not available', 'error'); return; }
    try {
      const result = await Promise.race([
        client.auth.getSession(),
        new Promise(resolve => setTimeout(() => resolve({data:{session:null}, timeout:true}), 5000))
      ]);
      if (result.timeout || !result.data?.session) { location.href='login.html'; return; }
      currentUser = result.data.session.user;
      // UI is already visible; database work is deliberately background-only.
      void loadChats();
    } catch (e) {
      console.error(e);
      popupMessage('Unable to check your session. Please refresh.', 'error');
    }
  }

  mobileBack?.addEventListener('click', () => appLayout?.classList.remove('chat-open'));
  messageForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const body = messageInput?.value.trim();
    if (!body) return;
    popupMessage('Message sending will be connected when a conversation is selected.');
  });

  // Search existing visible chat entries without making startup wait.
  document.getElementById('chatSearch')?.addEventListener('input', event => {
    const q = event.target.value.toLowerCase().trim();
    chatList?.querySelectorAll('.chat-item').forEach(item => { item.style.display = !q || item.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  });

  addOfficialChat();
  start();
});
