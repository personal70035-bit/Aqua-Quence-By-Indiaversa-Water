import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, Search, BrainCircuit, Zap } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { createChat, MODELS } from '../services/gemini';

export const ChatBot: React.FC = () => {
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODELS.CHAT_GENERAL);
  const [search, setSearch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const messages = useLiveQuery(() => db.messages.where('mode').equals('chat').sortBy('timestamp'));

  useEffect(() => {
    chatRef.current = createChat(model);
    setErrorMsg(null);
  }, [model]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setErrorMsg(null);
    try {
      await db.messages.add({
        sessionId: 'default',
        mode: 'chat',
        role: 'user',
        content: userMsg,
        timestamp: Date.now(),
        type: 'text'
      });

      if (!chatRef.current) {
        chatRef.current = createChat(model);
      }
      
      const response = await chatRef.current.sendMessage({ message: userMsg });
      
      await db.messages.add({
        sessionId: 'default',
        mode: 'chat',
        role: 'model',
        content: response.text || "",
        timestamp: Date.now(),
        type: 'text'
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      if (error?.message?.includes("403") || error?.message?.includes("PERMISSION_DENIED")) {
        setErrorMsg("API Error: The Generative Language API is disabled in your Google Cloud Project. Please enable it in the Google Cloud Console.");
      } else {
        setErrorMsg("An error occurred while sending the message. Please try again.");
      }
    }
  };

  const clearChat = async () => {
    try {
      await db.messages.where('mode').equals('chat').delete();
      chatRef.current = createChat(model);
    } catch (error) {
      console.error("Failed to clear chat:", error);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full max-w-2xl mx-auto glass-panel overflow-hidden border border-white/10 p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot className="text-blue-500" size={24} />
          <h2 className="text-xl font-semibold text-white">Aqua Chat</h2>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setModel(model === MODELS.CHAT_COMPLEX ? MODELS.CHAT_GENERAL : MODELS.CHAT_COMPLEX)} className={`p-2 rounded-full ${model === MODELS.CHAT_COMPLEX ? 'bg-blue-600' : 'border border-white/10'}`} title="High Thinking"><BrainCircuit size={16} /></button>
            <button onClick={() => setModel(model === MODELS.CHAT_FAST ? MODELS.CHAT_GENERAL : MODELS.CHAT_FAST)} className={`p-2 rounded-full ${model === MODELS.CHAT_FAST ? 'bg-blue-600' : 'border border-white/10'}`} title="Fast Response"><Zap size={16} /></button>
            <button onClick={() => setSearch(!search)} className={`p-2 rounded-full ${search ? 'bg-blue-600' : 'border border-white/10'}`} title="Search Grounding"><Search size={16} /></button>
            <button onClick={clearChat} className="p-2 rounded-full border border-white/10 text-white/40 hover:text-white"><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages?.map((msg, i) => (
          <div key={i} className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 self-end' : 'bg-white/10 self-start'}`}>
            <p className="text-white">{msg.content}</p>
          </div>
        ))}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/50 self-start">
            <p className="text-red-200 text-sm">{errorMsg}</p>
            {errorMsg.includes("API Error") && (
              <button 
                onClick={() => (window as any).aistudio?.openSelectKey?.()} 
                className="mt-2 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full transition-colors"
              >
                Select Different API Key
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mt-6 flex gap-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Aqua Quence..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-white/30 focus:outline-none"
        />
        <button onClick={handleSend} className="bg-blue-600 text-white p-4 rounded-2xl">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};
