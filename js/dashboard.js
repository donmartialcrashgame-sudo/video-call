document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.supabaseClient;
  const loader = document.getElementById('appLoader');
  const chatList = document.getElementById('chatList');
  const messagesArea = document.getElementById('messagesArea');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendMessage');
  const messageForm = document.getElementById('messageForm');
  const popup = document.getElementById('popup');
  const appLayout = document.querySelector('.app-layout');
  const mobileBack = document.getElementById('mobileBack');
  const chatName = document.querySelector('.user-title h3');
  const chatStatus = document.querySelector('.user-title span');
  const chatAvatar = document.getElementById('chatAvatar');

  if (!supabase) { window.location.href = 'login.html'; return; }
  let currentUser = null;
  let currentConversationId = null;
  let realtimeChannel = null;

  const escapeHtml = (v='') => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const showLoader = (text='Loading...') => { if(loader){loader.style.display='flex'; const p=loader.querySelector('p'); if(p)p.textContent=text;} };
  const hideLoader = () => { if(loader) loader.style.display='none'; };
  const showPopup = (message,type='error') => { if(!popup)return; popup.textContent=message; popup.className=`popup ${type} show`; clearTimeout(showPopup.timer); showPopup.timer=setTimeout(()=>popup.classList.remove('show'),3000); };
  const formatTime = d => new Intl.DateTimeFormat([], {hour:'numeric',minute:'2-digit'}).format(new Date(d));
  const scrollMessages = () => { if(messagesArea) requestAnimationFrame(()=>messagesArea.scrollTop=messagesArea.scrollHeight); };

  function renderEmpty(title='No messages yet', subtitle='Send a message to start the conversation.') {
    messagesArea.innerHTML=`<div class="empty-chat"><div class="empty-chat-icon"><i class="fa-solid fa-comments"></i></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div>`;
  }

  function renderMessage(message) {
    if(!message || !messagesArea || !currentUser)return;
    const mine=message.sender_id===currentUser.id;
    const row=document.createElement('div');
    row.className=`message-row ${mine?'message-outgoing':'message-incoming'}`;
    row.dataset.messageId=message.id||'';
    const body=message.deleted_at?'This message was deleted':(message.body||'');
    const attachment=message.message_type && message.message_type!=='text' ? '<i class="fa-solid fa-paperclip message-type-icon"></i>' : '';
    row.innerHTML=`<div class="message-bubble ${message.deleted_at?'deleted-message':''}"><div class="message-body">${attachment}${escapeHtml(body).replace(/\n/g,'<br>')}</div><div class="message-meta"><span>${formatTime(message.created_at)}</span>${mine?'<i class="fa-solid fa-check-double message-check"></i>':''}</div></div>`;
    messagesArea.appendChild(row);
  }

  async function loadMessages(id){
    if(!id){renderEmpty();return;}
    messagesArea.innerHTML='<div class="message-skeleton-list"><div class="message-skeleton incoming"></div><div class="message-skeleton outgoing"></div><div class="message-skeleton incoming short"></div></div>';
    const {data,error}=await supabase.from('messages').select('id,conversation_id,sender_id,message_type,body,media_path,created_at,expires_at,edited_at,deleted_at').eq('conversation_id',id).is('deleted_at',null).order('created_at',{ascending:true});
    if(error){console.error(error);renderEmpty('Messages unavailable','We could not load this conversation.');return;}
    messagesArea.innerHTML='';
    if(!data?.length){renderEmpty();return;}
    data.forEach(renderMessage); scrollMessages();
  }

  function stopRealtime(){if(realtimeChannel){supabase.removeChannel(realtimeChannel);realtimeChannel=null;}}
  function startRealtime(id){
    stopRealtime(); if(!id)return;
    realtimeChannel=supabase.channel(`messages-${id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${id}`},payload=>{
      const m=payload.new;
      if(messagesArea.querySelector(`[data-message-id="${m.id}"]`))return;
      if(messagesArea.querySelector('.empty-chat,.message-skeleton-list'))messagesArea.innerHTML='';
      renderMessage(m); scrollMessages();
    }).subscribe();
  }

  async function openConversation({id=null,name,avatar=null,status='Online',virtual=false}){
    currentConversationId=id;
    chatName.textContent=name; chatStatus.textContent=status;
    chatAvatar.innerHTML=avatar?`<img src="${escapeHtml(avatar)}" alt="">`:escapeHtml((name||'V').charAt(0).toUpperCase());
    appLayout.classList.add('chat-open');
    if(virtual){stopRealtime();renderEmpty(name==='VideoApp Official ✓'?'Welcome to VideoApp':'No messages yet',name==='VideoApp Official ✓'?'This is the official VideoApp conversation.':'Send a message to yourself.');return;}
    await loadMessages(id); startRealtime(id);
  }

  function addChatItem({id=null,name,message='No messages yet',avatar=null,time='',unread=0,virtual=false,status='Online'}){
    const item=document.createElement('button'); item.type='button'; item.className='chat-item'; item.dataset.name=(name||'').toLowerCase();
    item.innerHTML=`<span class="chat-avatar">${avatar?`<img src="${escapeHtml(avatar)}" alt="">`:escapeHtml((name||'C').charAt(0).toUpperCase())}</span><span class="chat-item-main"><span class="chat-item-top"><strong>${escapeHtml(name)}</strong><time>${escapeHtml(time)}</time></span><span class="chat-item-bottom"><span>${escapeHtml(message)}</span>${unread?`<b class="unread-count">${unread}</b>`:''}</span></span>`;
    item.addEventListener('click',()=>openConversation({id,name,avatar,status,virtual})); chatList.appendChild(item);
  }

  async function loadChats(){
    chatList.innerHTML='<div class="chat-skeleton"><span></span><div><b></b><i></i></div></div><div class="chat-skeleton"><span></span><div><b></b><i></i></div></div><div class="chat-skeleton"><span></span><div><b></b><i></i></div></div>';
    const {data:memberships,error:memberError}=await supabase.from('conversation_members').select('conversation_id').eq('user_id',currentUser.id);
    chatList.innerHTML='';
    addChatItem({name:'VideoApp Official ✓',message:'Welcome to VideoApp',virtual:true,status:'Online'});
    const ids=(memberships||[]).map(x=>x.conversation_id).filter(Boolean);
    if(memberError){console.error(memberError);return;}
    if(!ids.length)return;
    const {data:conversations,error}=await supabase.from('conversations').select('id,title,avatar_url,created_at').in('id',ids).order('created_at',{ascending:false});
    if(error){console.error(error);return;}
    for(const c of conversations||[]){
      const {data:last}=await supabase.from('messages').select('body,created_at').eq('conversation_id',c.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      addChatItem({id:c.id,name:c.title||'Conversation',message:last?.body||'No messages yet',avatar:c.avatar_url,time:last?.created_at?formatTime(last.created_at):''});
    }
  }

  async function sendMessage(){
    const body=messageInput.value.trim(); if(!body)return;
    if(!currentConversationId){showPopup('This chat is not connected to a conversation yet.','error');return;}
    sendButton.disabled=true; messageInput.disabled=true;
    const {data,error}=await supabase.from('messages').insert({conversation_id:currentConversationId,sender_id:currentUser.id,message_type:'text',body}).select('id,conversation_id,sender_id,message_type,body,created_at,deleted_at').single();
    if(error){console.error(error);showPopup(error.message||'Unable to send message.','error');}
    else if(data){if(!messagesArea.querySelector(`[data-message-id="${data.id}"]`)){if(messagesArea.querySelector('.empty-chat'))messagesArea.innerHTML='';renderMessage(data);scrollMessages();}messageInput.value='';}
    sendButton.disabled=false; messageInput.disabled=false; messageInput.focus();
  }

  mobileBack?.addEventListener('click',()=>{stopRealtime();currentConversationId=null;appLayout.classList.remove('chat-open');});
  document.getElementById('chatSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();chatList.querySelectorAll('.chat-item').forEach(i=>i.style.display=!q||i.dataset.name.includes(q)?'flex':'none');});
  messageForm?.addEventListener('submit',e=>{e.preventDefault();sendMessage();});

  try{
    showLoader('Loading VideoApp...');
    const {data,error}=await supabase.auth.getSession();
    if(error||!data.session){window.location.href='login.html';return;}
    currentUser=data.session.user;
    await loadChats();
    await openConversation({name:'VideoApp Official ✓',status:'Online',virtual:true});
    appLayout.classList.remove('chat-open');
    hideLoader();
  }catch(error){console.error(error);hideLoader();showPopup('Unable to load VideoApp.','error');}
});
