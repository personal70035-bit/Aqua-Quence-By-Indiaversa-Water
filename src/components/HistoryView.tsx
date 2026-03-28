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
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Database size={20} className="text-indigo-400" />
          <h2 className="text-slate-200 font-semibold">Local Storage History</h2>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages && messages.length > 0 ? (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${msg.type === 'voice' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {msg.type === 'voice' ? <PhoneCall size={14} /> : <MessageSquare size={14} />}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {msg.role === 'user' ? 'Customer' : 'Aqua Quence AI'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                    <Calendar size={10} />
                    {formatDate(msg.timestamp)}
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {msg.content}
                </p>
                <div className="mt-2 text-[10px] text-slate-600 font-mono truncate">
                  Session ID: {msg.sessionId}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-700">
              <Database size={32} className="text-slate-600" />
            </div>
            <h3 className="text-slate-300 font-semibold mb-1">No Local History</h3>
            <p className="text-slate-500 text-sm">
              Your conversation history will appear here once you start chatting or calling.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-slate-800/30 border-t border-slate-700/50">
        <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          <span>Local First Integrity</span>
          <span>IndexedDB Storage</span>
        </div>
      </div>
    </div>
  );
};
