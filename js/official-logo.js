document.addEventListener('DOMContentLoaded',()=>{
  const apply=()=>{
    document.querySelectorAll('.chat-item').forEach(item=>{
      if(item.textContent.includes('VideoApp Official')){
        const avatar=item.querySelector('.chat-avatar');
        if(avatar)avatar.innerHTML='<i class="fa-solid fa-video"></i>';
      }
    });
    const title=document.querySelector('.user-title h3');
    const avatar=document.getElementById('chatAvatar');
    if(title&&avatar&&title.textContent.includes('VideoApp Official')){
      avatar.classList.add('official');avatar.innerHTML='<i class="fa-solid fa-video"></i>';
    }
  };
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  apply();
});
