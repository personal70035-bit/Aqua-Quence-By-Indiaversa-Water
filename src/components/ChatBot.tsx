import React, { useState, useEffect, useRef } from 'react';
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
      await db.messages.add({
        sessionId,
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
        type: 'text'
      });

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
        await db.messages.update(messageId, { content: fullResponse });
      }

      await syncToGoogleSheets(sessionId);
    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMessage = "Sorry, something went wrong. Please try again.";
      
      if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.status === 429) {
        errorMessage = "Aqua Quence is currently handling too many requests (Quota Exceeded). Please wait about 60 seconds and try again.";
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

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto overflow-hidden">
      {/* Transcript Flow */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-6 no-scrollbar"
      >
        <AnimatePresence initial={false}>
          {messages?.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col"
            >
              <span className={`text-[9px] font-black uppercase tracking-[0.3em] mb-2 font-display ${
                msg.role === 'user' ? 'text-metallic-silver/60' : 'text-aqua-cyan/60'
              }`}>
                {msg.role === 'user' ? 'Client_Input' : 'System_Response'}
              </span>
              <div className={`glass-panel p-5 silver-border ${
                msg.role === 'user' ? 'bg-white/2' : 'bg-aqua-cyan/5'
              }`}>
                <p className={`text-[12px] leading-relaxed ${
                  msg.role === 'user' ? 'text-silver-light/80' : 'text-silver-light font-medium'
                }`}>
                  {msg.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 bg-aqua-cyan rounded-full animate-pulse shadow-[0_0_10px_rgba(0,245,255,0.5)]" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-aqua-cyan font-display">Processing_Intel</span>
          </motion.div>
        )}
      </div>

      {/* Industrial Input */}
      <div className="px-6 pb-32">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="ENTER COMMAND..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-[12px] text-white placeholder:text-white/10 focus:outline-none focus:border-aqua-cyan/30 transition-all font-display uppercase tracking-[0.3em]"
          />
        </div>
      </div>
    </div>
  );
};
;
