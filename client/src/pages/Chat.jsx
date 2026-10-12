import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const socket = io('http://localhost:5000');

// Генерация цвета для аватарки по имени
function colorFromName(name) {
  const colors = [
    'from-teal-400 to-blue-500',
    'from-purple-400 to-pink-500',
    'from-orange-400 to-red-500',
    'from-green-400 to-teal-500',
    'from-indigo-400 to-purple-500',
    'from-yellow-400 to-orange-500',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
}

function Avatar({ name, size = 10, online }) {
  return (
    <div className="relative">
      <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br ${colorFromName(name)} flex items-center justify-center text-white font-bold`}>
        {name[0]?.toUpperCase()}
      </div>
      {online !== undefined && (
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${online ? 'bg-green-400' : 'bg-slate-500'}`}></div>
      )}
    </div>
  );
}

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [foundUsers, setFoundUsers] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [recording, setRecording] = useState(false);
  const [lastMessages, setLastMessages] = useState({});

  const bottomRef = useRef();
  const fileInputRef = useRef();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user.id) { navigate('/'); return; }
    socket.emit('user_online', user.id);
    api.get('/chats').then(res => {
      setChats(res.data);
      if (res.data.length > 0) setCurrentChat(res.data[0]);
    });
  }, []);

  useEffect(() => {
    const handleOnline = (ids) => setOnlineIds(ids);
    socket.on('online_users', handleOnline);
    return () => socket.off('online_users', handleOnline);
  }, []);

  useEffect(() => {
    if (!currentChat) return;
    api.get(`/messages/${currentChat.id}`).then(res => setMessages(res.data));
    socket.emit('join_chat', currentChat.id);

    const handleNewMessage = (msg) => {
      if (msg.chatId === currentChat.id) {
        setMessages(prev => [...prev, msg]);
      }
      setLastMessages(prev => ({ ...prev, [msg.chatId]: msg }));
    };
    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [currentChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (search.length < 2) { setFoundUsers([]); return; }
    const timer = setTimeout(() => {
      api.get(`/users/search?q=${search}`).then(res => setFoundUsers(res.data));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openPersonalChat = async (otherUser) => {
    const res = await api.post(`/chats/personal/${otherUser.id}`);
    const newChat = res.data;
    if (!chats.find(c => c.id === newChat.id)) setChats(prev => [newChat, ...prev]);
    setCurrentChat(newChat);
    setSearch('');
    setFoundUsers([]);
  };

  const sendMessage = () => {
    if (!text.trim() || !currentChat) return;
    socket.emit('send_message', {
      chatId: currentChat.id,
      text: text,
      sender_id: user.id,
      sender: user.username,
    });
    setText('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChat) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    socket.emit('send_message', {
      chatId: currentChat.id,
      text: '',
      sender_id: user.id,
      sender: user.username,
      media_url: res.data.url,
      media_type: res.data.type.startsWith('image') ? 'image' : 'file',
    });
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob, 'voice.webm');
        const res = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        socket.emit('send_message', {
          chatId: currentChat.id,
          text: '',
          sender_id: user.id,
          sender: user.username,
          media_url: res.data.url,
          media_type: 'voice',
        });
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      alert('Нет доступа к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setRecording(false);
  };

  if (!user.id) return null;

  const currentLast = currentChat ? lastMessages[currentChat.id] : null;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* КОЛОНКА 1: Список чатов */}
      <aside className="w-80 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center text-lg">💬</div>
              <span className="font-bold text-lg">Вместе</span>
            </div>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Поиск друзей..."
            className="w-full p-2.5 bg-slate-800/60 border border-slate-700 rounded-xl text-sm outline-none focus:border-teal-400 transition"
          />
        </div>

        {foundUsers.length > 0 && (
          <div className="border-b border-slate-800 bg-slate-800/40">
            <div className="px-4 py-2 text-xs text-slate-400 uppercase tracking-wider">Найдены</div>
            {foundUsers.map(u => (
              <div
                key={u.id}
                onClick={() => openPersonalChat(u)}
                className="px-4 py-3 cursor-pointer hover:bg-slate-800/60 flex items-center gap-3 transition"
              >
                <Avatar name={u.username} size={9} online={onlineIds.includes(u.id)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.username}</div>
                  <div className="text-xs text-slate-400 truncate">{u.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && (
            <div className="text-center text-slate-500 text-sm p-6">
              Пока нет чатов.<br />Найди друга через поиск 👆
            </div>
          )}
          {chats.map(chat => {
            const last = lastMessages[chat.id];
            const isActive = currentChat?.id === chat.id;
            return (
              <div
                key={chat.id}
                onClick={() => setCurrentChat(chat)}
                className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition ${
                  isActive ? 'bg-slate-800/80 border-l-2 border-teal-400' : 'hover:bg-slate-800/40 border-l-2 border-transparent'
                }`}
              >
                <Avatar name={chat.name} size={12} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{chat.name}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {last ? `${last.sender}: ${last.text || '📎 Вложение'}` : 'Нет сообщений'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center gap-3">
          <Avatar name={user.username} size={9} online={true} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user.username}</div>
            <div className="text-xs text-teal-400">в сети</div>
          </div>
        </div>
      </aside>

      {/* КОЛОНКА 2: Сообщения */}
      <main className="flex-1 flex flex-col min-w-0">
        {currentChat ? (
          <>
            <header className="px-6 py-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center gap-4">
              <Avatar name={currentChat.name} size={10} />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{currentChat.name}</div>
                <div className="text-xs text-teal-400">
                  {currentChat.is_group ? 'Групповой чат' : 'Личный чат'}
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map((m, i) => {
                const isOwn = m.sender === user.username;
                return (
                  <div key={i} className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {!isOwn && <Avatar name={m.sender} size={8} />}
                    <div className={`max-w-md px-4 py-2 rounded-2xl shadow-lg ${
                      isOwn
                        ? 'bg-gradient-to-br from-teal-500 to-blue-600 rounded-br-sm'
                        : 'bg-slate-800 border border-slate-700 rounded-bl-sm'
                    }`}>
                      {!isOwn && <div className="text-xs text-teal-300 font-medium mb-1">{m.sender}</div>}
                      {m.media_type === 'image' && (
                        <img src={m.media_url} alt="" className="rounded-lg max-w-xs mb-2" />
                      )}
                      {m.media_type === 'voice' && (
                        <audio controls src={m.media_url} className="mb-1 max-w-full" />
                      )}
                      {m.text && <div className="break-words">{m.text}</div>}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800">
              <div className="flex gap-2 items-center bg-slate-800/60 border border-slate-700 rounded-2xl px-2 py-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xl p-2 hover:bg-slate-700 rounded-xl transition"
                  title="Картинка"
                >📎</button>

                <button
                  onClick={recording ? stopRecording : startRecording}
                  className={`text-xl p-2 rounded-xl transition ${
                    recording ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-slate-700'
                  }`}
                  title={recording ? 'Остановить' : 'Голосовое'}
                >{recording ? '⏹' : '🎤'}</button>

                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  className="flex-1 p-2 bg-transparent outline-none text-white placeholder-slate-500"
                  placeholder="Написать сообщение..."
                />

                <button
                  onClick={sendMessage}
                  className="bg-gradient-to-br from-teal-400 to-blue-600 text-white px-4 py-2 rounded-xl hover:opacity-90 transition font-medium"
                >→</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="text-6xl">💬</div>
            <div className="text-lg">Выбери чат слева или найди друга</div>
          </div>
        )}
      </main>

      {/* КОЛОНКА 3: Инфо о чате */}
      {currentChat && (
        <aside className="w-72 bg-slate-900/80 backdrop-blur-xl border-l border-slate-800 p-6 hidden xl:block">
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center text-4xl font-bold shadow-2xl">
              {currentChat.name[0]?.toUpperCase()}
            </div>
            <h3 className="font-bold text-lg">{currentChat.name}</h3>
            <p className="text-xs text-teal-400 mt-1">
              {currentChat.is_group ? 'Групповой чат' : 'Личный чат'}
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="bg-slate-800/60 rounded-xl p-3 flex justify-between">
              <span className="text-slate-400">Сообщений</span>
              <span className="font-bold">{messages.length}</span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 flex justify-between">
              <span className="text-slate-400">Участников</span>
              <span className="font-bold">{currentChat.is_group ? '5' : '2'}</span>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 flex justify-between">
              <span className="text-slate-400">Создан</span>
              <span className="font-bold">
                {new Date(currentChat.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}