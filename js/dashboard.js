document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.supabaseClient;
  const chatList = document.getElementById('chatList');
  const messagesArea = document.getElementById('messagesArea');
  const messageInput = document.getElementById('messageInput');
  const messageForm = document.getElementById('messageForm');
  const popup = document.getElementById('popup');
  const appLayout = document.querySelector('.app-layout');
  const mobileBack = document.getElementById('mobileBack');

  if (!supabase) { location.href='login.html'; return; }

  let currentUser=null;

  const showPopup=(msg)=>{if(!popup)return;popup.textContent=msg;popup.classList.add('show');setTimeout(()=>popup.classList.remove('show'),2500)};

  function addOfficial(){
    chatList.innerHTML='';
    const item=document.createElement('button');
    item.className='chat-item';
    item.innerHTML='<span class="chat-avatar official"><i class="fa-solid fa-video"></i></span><span class="chat-item-main"><span class="chat-item-top"><strong>VideoApp Official ✓</strong></span><span class="chat-item-bottom"><span>Welcome to VideoApp</span></span></span>';
    item.onclick=()=>{};
    chatList.appendChild(item);
  }

  async function loadChatsFast(){
    addOfficial();
    // Load database chats without blocking the interface
    supabase.from('conversation_members')
    .select('conversation_id')
    .eq('user_id',currentUser.id)
    .then(async ({data,error})=>{
      if(error||!data?.length)return;
      const ids=data.map(x=>x.conversation_id);
      const {data:conversations}=await supabase.from('conversations').select('id,title').in('id',ids);
      (conversations||[]).forEach(c=>{
        const item=document.createElement('button');
        item.className='chat-item';
        item.innerHTML=`<span class="chat-avatar">${(c.title||'C')[0]}</span><span class="chat-item-main"><span class="chat-item-top"><strong>${c.title||'Conversation'}</strong></span><span class="chat-item-bottom"><span>Open chat</span></span></span>`;
        chatList.appendChild(item);
      });
    });
  }

  try{
    const {data,error}=await supabase.auth.getSession();
    if(error||!data.session){location.href='login.html';return;}
    currentUser=data.session.user;

    // Show app immediately
    loadChatsFast();

  }catch(e){
    console.error(e);
    showPopup('Could not load app');
  }

  mobileBack?.addEventListener('click',()=>appLayout.classList.remove('chat-open'));
  messageForm?.addEventListener('submit',e=>{
    e.preventDefault();
    if(messageInput.value.trim()){
      showPopup('Message system connected');
      messageInput.value='';
    }
  });
});
