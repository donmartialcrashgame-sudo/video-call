document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('appLoader');
    const chatList = document.getElementById('chatList');
    const conversation = document.querySelector('.conversation');

    const current = {
        user: null,
        activeChat: null
    };

    function loading(show, text='Loading...') {
        if (!loader) return;
        loader.style.display = show ? 'flex' : 'none';
        const p = loader.querySelector('p');
        if (p) p.textContent = text;
    }

    function popup(message, type='error') {
        const box = document.getElementById('popup');
        if (!box) return;
        box.innerHTML = `<strong>${type === 'success' ? '✓' : '⚠'}</strong> ${message}`;
        box.style.display = 'block';
        setTimeout(()=> box.style.display='none',3000);
    }

    function openChat(user) {
        current.activeChat = user;
        if (!conversation) return;

        conversation.innerHTML = `
        <div class="conversation-header">
            <div class="avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div>
                <h3>${user.name}</h3>
                <small>Online</small>
            </div>
            <button><i class="fa-solid fa-phone"></i></button>
            <button><i class="fa-solid fa-video"></i></button>
        </div>
        <div class="messages" id="messages">
            <div class="empty-chat">
                <i class="fa-solid fa-comments"></i>
                <p>No messages yet</p>
            </div>
        </div>
        <div class="input-area">
            <input id="messageInput" placeholder="Type a message...">
            <button class="send" id="sendMessage"><i class="fa-solid fa-paper-plane"></i></button>
        </div>`;

        document.getElementById('sendMessage').onclick = sendMessage;
    }

    async function sendMessage(){
        const input = document.getElementById('messageInput');
        if (!input || !input.value.trim()) return;

        const text = input.value.trim();
        input.value='';

        const messages = document.getElementById('messages');
        if(messages){
            messages.innerHTML += `<div class="bubble sent">${text}<small> now</small></div>`;
        }

        // Supabase messages table connection will use this structure:
        // sender_id, receiver_id, message, created_at
        popup('Message sent','success');
    }

    async function loadChats(){
        if(!chatList) return;

        chatList.innerHTML = `
        <div class="chat-item skeleton"></div>
        <div class="chat-item skeleton"></div>`;

        setTimeout(()=>{
            const chats = [
                {name:'VideoApp Official', message:'Welcome to VideoApp 🎥', official:true},
                {name: current.user.user_metadata?.full_name || current.user.email.split('@')[0], message:'Start a conversation'}
            ];

            chatList.innerHTML='';

            chats.forEach(chat=>{
                const item=document.createElement('div');
                item.className='chat-item';
                item.innerHTML=`
                <div class="avatar">${chat.official ? '<i class="fa-solid fa-video"></i>' : chat.name[0]}</div>
                <div class="chat-info">
                    <h4>${chat.name}</h4>
                    <p>${chat.message}</p>
                </div>`;
                item.onclick=()=>openChat(chat);
                chatList.appendChild(item);
            });
        },600);
    }

    try {
        loading(true,'Loading VideoApp...');

        const {data,error}=await supabaseClient.auth.getSession();

        if(error || !data.session){
            window.location.href='login.html';
            return;
        }

        current.user=data.session.user;
        await loadChats();

        loading(false);

    } catch(error){
        console.error(error);
        popup('Unable to load chats');
        loading(false);
    }
});
