document.addEventListener('DOMContentLoaded', async()=>{
 const loader=document.getElementById('appLoader');
 const chatList=document.getElementById('chatList');
 function hideLoader(){if(loader)loader.style.display='none';}
 function popup(message){const p=document.getElementById('popup');if(p){p.textContent=message;p.style.display='block';setTimeout(()=>p.style.display='none',3000)}}
 try{
  const {data,error}=await supabaseClient.auth.getSession();
  if(error||!data.session){window.location.href='login.html';return;}
  const user=data.session.user;
  const name=user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  if(chatList){
   chatList.innerHTML=`
   <div class="chat-item">
    <div class="avatar"><i class="fa-solid fa-video"></i></div>
    <div class="chat-info"><h4>VideoApp Official ✓</h4><p>Welcome to VideoApp 🎥</p></div>
   </div>
   <div class="chat-item">
    <div class="avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="chat-info"><h4>${name}</h4><p>Your messages will appear here</p></div>
   </div>`;
  }
  hideLoader();
 }catch(error){
  console.error(error);
  popup('Unable to load VideoApp');
  hideLoader();
 }
});

function showLoading(message='Loading...'){
 const loader=document.getElementById('appLoader');
 if(loader){loader.style.display='flex';const p=loader.querySelector('p');if(p)p.textContent=message;}
}

function hideLoading(){
 const loader=document.getElementById('appLoader');
 if(loader)loader.style.display='none';
}
