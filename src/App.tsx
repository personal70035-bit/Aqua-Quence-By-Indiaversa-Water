import React, { useState } from 'react';
import { ChatBot } from './components/ChatBot';
import { VoiceAssistant } from './components/VoiceAssistant';
import { HistoryView } from './components/HistoryView';
import { 
  Droplets, 
  MessageSquare, 
  PhoneCall, 
  History, 
  Settings, 
  Database, 
  Trash2, 
  Menu, 
  X,
  MapPin,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './db';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'voice' | 'history'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const clearAllHistory = async () => {
    if (confirm("Are you sure you want to wipe the entire local database? This action is permanent.")) {
      await db.messages.clear();
      await db.sessions.clear();
      localStorage.removeItem('aqua_quence_session_id');
      localStorage.removeItem('aqua_quence_voice_session_id');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-hidden flex flex-col md:flex-row">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px] animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(15,23,42,0)_0%,rgba(2,6,23,1)_100%)]" />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Droplets size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Aqua Quence
          </h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/50 z-40 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6">
          {/* Logo Section */}
          <div className="hidden md:flex items-center gap-3 mb-10">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-xl shadow-indigo-500/20">
              <Droplets size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight leading-none mb-1">Aqua Quence</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-bold">by Indiversa Water</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-2">
            <button
              onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === 'chat' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <MessageSquare size={20} className={activeTab === 'chat' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
              <span className="font-semibold">Text Chatbot</span>
            </button>
            <button
              onClick={() => { setActiveTab('voice'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === 'voice' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <PhoneCall size={20} className={activeTab === 'voice' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
              <span className="font-semibold">Voice Assistant</span>
            </button>
            <button
              onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === 'history' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <History size={20} className={activeTab === 'history' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
              <span className="font-semibold">Local History</span>
            </button>
          </nav>

          {/* Local Info Section */}
          <div className="mt-auto pt-6 border-t border-slate-800/50 space-y-4">
            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <MapPin size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Maheshtala, Kolkata</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Serving Santoshpur, Batanagar, Nangi, Budge Budge & more.
              </p>
            </div>

            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-slate-500">
                <Clock size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">24/7 Service</span>
              </div>
              <button
                onClick={clearAllHistory}
                className="p-2 text-slate-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-400/10"
                title="Clear All Local History"
              >
                <Database size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col h-[calc(100vh-64px)] md:h-screen p-4 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="flex-1 max-w-5xl mx-auto w-full"
          >
            {activeTab === 'chat' && <ChatBot />}
            {activeTab === 'voice' && <VoiceAssistant />}
            {activeTab === 'history' && <HistoryView />}
          </motion.div>
        </AnimatePresence>

        {/* Footer Branding */}
        <footer className="mt-6 text-center">
          <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">
            Powered by Google Gemini AI & Dexie.js
          </p>
        </footer>
      </main>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
