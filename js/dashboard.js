document.addEventListener('DOMContentLoaded', async()=>{
const loader=document.getElementById('appLoader');
const chatList=document.getElementById('chatList');
const messages=document.getElementById('messagesArea');
const popupBox=document.getElementById('popup');

function loading(show,text='Loading...'){
 if(loader){loader.style.display=show?'flex':'none';loader.querySelector('p').textContent=text;}
}
function popup(msg){if(popupBox){popupBox.textContent=msg;popupBox.style.display='block';setTimeout(()=>popupBox.style.display='none',3000)}}

try{
loading(true,'Loading VideoApp...');
const {data,error}=await supabaseClient.auth.getSession();
if(error||!data.session){window.location.href='login.html';return;}

const user=data.session.user;

chatList.innerHTML='';
const chats=[
{name:'VideoApp Official ✓',message:'Welcome to VideoApp',icon:'fa-video'},
{name:user.user_metadata?.full_name||user.email, message:'Message yourself',icon:'fa-user'}
];

chats.forEach(chat=>{
 const item=document.createElement('div');
 item.className='chat-item';
 item.innerHTML=`<div class="avatar"><i class="fa-solid ${chat.icon}"></i></div><div><h4>${chat.name}</h4><p>${chat.message}</p></div>`;
 item.onclick=()=>openChat(chat);
 chatList.appendChild(item);
});

function openChat(chat){
 messages.innerHTML=`<div class="chat-message"><p>${chat.name} conversation</p></div>`;
}

document.getElementById('sendMessage').onclick=()=>{
 const input=document.getElementById('messageInput');
 if(!input.value.trim())return;
 messages.innerHTML+=`<div class="sent-message">${input.value}</div>`;
 input.value='';
};

loading(false);
}catch(e){console.error(e);popup('Unable to load VideoApp');loading(false);}
});