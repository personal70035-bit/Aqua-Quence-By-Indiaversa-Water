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

      // 2. Send to Gemini with streaming
      const stream = await chatRef.current.sendMessageStream({ message: userMessage });
      
      let fullResponse = '';
      const messageId = await db.messages.add({
        sessionId,
        role: 'model',
        content: '',
        timestamp: Date.now(),
        type: 'text'
      });

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        fullResponse += chunkText;
        
        // Update the message in Dexie.js in real-time
        await db.messages.update(messageId, { content: fullResponse });
      }

      // 3. Sync to Google Sheets after full response
      await syncToGoogleSheets(sessionId);
    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMessage = "Sorry, something went wrong. Please try again.";
      
      if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.status === 429) {
        errorMessage = "Aqua Quence is currently handling too many requests (Quota Exceeded). Please wait about 60 seconds and try again.";
      } else if (error?.message?.includes("leaked") || error?.message?.includes("403") || error?.status === 403) {
        errorMessage = "Your Gemini API key has been reported as leaked and disabled. Please go to the AI Studio Settings (top right) and provide a fresh API key to continue.";
      }

      await db.messages.add({
        sessionId,
        role: 'model',
        content: errorMessage,
        timestamp: Date.now(),
        type: 'text'
      });
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
    <div className="flex flex-col h-full glass-panel rounded-3xl overflow-hidden relative min-h-[600px]">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-cyan-glow rounded-full animate-pulse shadow-[0_0_10px_#48CAE4]" />
          <h2 className="text-white font-display font-bold tracking-tight uppercase text-sm">Hydration Chat Link</h2>
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
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages?.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'chat-bubble-user' 
                    : 'chat-bubble-agent'
                }`}>
                  {msg.content}
                </div>
                <span className="text-[9px] uppercase tracking-widest text-slate-500 mt-2 font-bold">
                  {msg.role === 'user' ? 'User Client' : 'Aqua Agent'}
                </span>
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
            <div className="flex gap-3 items-center bg-white/5 p-4 border border-white/10">
              <Loader2 size={16} className="animate-spin text-cyan-glow" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-glow font-bold">Processing Intel...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 bg-white/5 border-t border-white/10 backdrop-blur-md">
        <div className="relative flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="ENTER COMMAND OR QUERY..."
            className="flex-1 bg-black/40 border border-white/10 rounded-none py-4 px-6 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-glow/50 transition-all font-mono text-xs uppercase tracking-wider"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="metallic-button !py-4 !px-6 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
