import React from 'react';
import { Database, Trash2, Calendar, MessageSquare, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export const HistoryView: React.FC = () => {
  const messages = useLiveQuery(() => db.messages.orderBy('timestamp').reverse().toArray());

  const clearAllHistory = async () => {
    if (confirm("Are you sure you want to wipe the entire local database? This action is permanent.")) {
      await db.messages.clear();
      await db.sessions.clear();
      localStorage.removeItem('aqua_quence_session_id');
      localStorage.removeItem('aqua_quence_voice_session_id');
      window.location.reload();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-3xl overflow-hidden relative min-h-[600px]">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Database size={20} className="text-cyan-glow shadow-[0_0_10px_#48CAE4]" />
          <h2 className="text-white font-display font-bold tracking-tight uppercase text-sm">Data Archive</h2>
        </div>
        <button
          onClick={clearAllHistory}
          className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-400/10"
          title="Clear All Local History"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        {messages && messages.length > 0 ? (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-white/5 border border-white/10 hover:border-cyan-glow/30 transition-all group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-none border ${msg.type === 'voice' ? 'border-cyan-glow/30 bg-cyan-glow/10 text-cyan-glow' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                      {msg.type === 'voice' ? <PhoneCall size={14} /> : <MessageSquare size={14} />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${msg.role === 'user' ? 'text-cyan-glow' : 'text-slate-400'}`}>
                        {msg.role === 'user' ? 'User Client' : 'Aqua Agent'}
                      </span>
                      <div className="flex items-center gap-1 text-slate-500 text-[9px] uppercase tracking-widest mt-0.5">
                        <Calendar size={10} />
                        {formatDate(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  {msg.content}
                </p>
                <div className="mt-4 pt-4 border-t border-white/5 text-[9px] text-slate-600 font-mono uppercase tracking-widest flex justify-between items-center">
                  <span className="truncate max-w-[200px]">Session: {msg.sessionId}</span>
                  <span className="text-cyan-glow/40">{msg.type === 'voice' ? 'V-STREAM' : 'C-LINK'}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
              <Database size={32} className="text-slate-600" />
            </div>
            <h3 className="text-white font-display font-bold text-lg mb-2 uppercase tracking-tight">Archive Empty</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
              No local data packets detected. Initiate a chat or voice link to begin archiving.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-6 bg-white/5 border-t border-white/10 backdrop-blur-md">
        <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-[0.3em] font-bold">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-emerald-500" />
            <span>Local Integrity Verified</span>
          </div>
          <span>IndexedDB Protocol</span>
        </div>
      </div>
    </div>
  );
};
