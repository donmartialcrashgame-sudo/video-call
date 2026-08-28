document.addEventListener('DOMContentLoaded',()=>{
  const client=window.supabaseClient;
  if(!client)return;
  let me=null;
  client.auth.getUser().then(({data})=>{me=data?.user||null;});

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function show(sender='VideoApp',body='New message'){
    let n=document.getElementById('videoAppNotification');
    if(!n){
      n=document.createElement('div');n.id='videoAppNotification';n.className='in-app-notification';
      n.innerHTML='<div class="notification-icon"><i class="fa-solid fa-video"></i></div><div class="notification-copy"><strong></strong><span></span></div><button class="notification-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>';
      document.body.appendChild(n);
      n.querySelector('.notification-close').onclick=()=>n.classList.remove('show');
    }
    n.querySelector('strong').textContent=sender;
    n.querySelector('span').textContent=body;
    n.classList.add('show');clearTimeout(n._timer);n._timer=setTimeout(()=>n.classList.remove('show'),5000);
    if(document.hidden && 'Notification' in window && Notification.permission==='granted'){
      try{const note=new Notification(sender,{body,tag:'videoapp-message'});note.onclick=()=>{window.focus();note.close();};}catch(e){}
    }
  }
  window.VideoAppNotify=show;
  if('Notification' in window && Notification.permission==='default'){
    const ask=()=>Notification.requestPermission().catch(()=>{});
    document.addEventListener('click',ask,{once:true});
  }

  client.channel(`global-message-notifications-${Date.now()}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async payload=>{
      const m=payload.new;
      if(!m || (me && m.sender_id===me.id))return;
      let sender='New message';
      try{
        const {data}=await client.from('profiles').select('full_name,phone,email').eq('id',m.sender_id).maybeSingle();
        sender=data?.full_name||data?.phone||data?.email||'New message';
      }catch(e){}
      show(sender,m.body||'You received a new message');
    }).subscribe();
});
