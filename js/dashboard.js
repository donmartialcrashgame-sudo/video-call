document.addEventListener('DOMContentLoaded', async()=>{
 const loader=document.getElementById('loader');
 const show=(msg)=>{if(loader){loader.style.display='flex';const t=loader.querySelector('.loader-text');if(t)t.textContent=msg||'Loading...';}};
 const hide=()=>{if(loader)loader.style.display='none'};
 show('Loading VideoApp...');
 try{
   const {data,error}=await supabaseClient.auth.getUser();
   if(error||!data.user){window.location.href='login.html';return;}
   const user=data.user;
   const name=user.user_metadata?.full_name||'User';
   const email=user.email||'';
   const nameEl=document.getElementById('name');
   const emailEl=document.getElementById('email');
   const avatar=document.getElementById('avatar');
   if(nameEl) nameEl.textContent=name;
   if(emailEl) emailEl.textContent=email;
   if(avatar) avatar.textContent=name.charAt(0).toUpperCase();
   hide();
 }catch(e){
   console.error(e);
   show('Unable to load account');
 }
});

function openPopup(type,message){
 const popup=document.createElement('div');
 popup.className='app-popup';
 popup.innerHTML=`<div><h3>${type}</h3><p>${message}</p><button onclick="this.parentElement.parentElement.remove()">OK</button></div>`;
 document.body.appendChild(popup);
}

function showLoading(message){
 const loader=document.getElementById('loader');
 if(loader){loader.style.display='flex';}
}

function hideLoading(){
 const loader=document.getElementById('loader');
 if(loader){loader.style.display='none';}
}
