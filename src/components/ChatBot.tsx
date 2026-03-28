import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Loader2, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';
import { createChat } from '../services/gemini';
import { syncToGoogleSheets } from '../services/googleSheets';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';

export const ChatBot: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('aqua_quence_session_id');
    if (saved) return saved;
    const newId = uuidv4();
    localStorage.setItem('aqua_quence_session_id', newId);
    return newId;
  });

  const messages = useLiveQuery(
    () => db.messages.where('sessionId').equals(sessionId).sortBy('timestamp'),
    [sessionId]
  );

  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = createChat();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // 1. Save user message to Dexie.js FIRST
      await db.messages.add({
        sessionId,
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
        type: 'text'
      });

      // 2. Send to Gemini
      const response = await chatRef.current.sendMessage({ message: userMessage });
      const botMessage = response.text;

      // 3. Save bot response to Dexie.js
      await db.messages.add({
        sessionId,
        role: 'model',
        content: botMessage,
        timestamp: Date.now(),
        type: 'text'
      });

      // 4. Sync to Google Sheets
      await syncToGoogleSheets(sessionId);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    if (confirm("Are you sure you want to clear the chat history for this session?")) {
      await db.messages.where('sessionId').equals(sessionId).delete();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <h2 className="text-slate-200 font-semibold">Aqua Quence Chat</h2>
        </div>
        <button
          onClick={clearChat}
          className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-400/10"
          title="Clear Chat History"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages?.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-3 items-center bg-slate-800/50 p-3 rounded-2xl rounded-tl-none border border-slate-700/50">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span className="text-xs text-slate-400">Aqua Quence is thinking...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-800/50 border-t border-slate-700/50">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your order or question..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
