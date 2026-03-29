import React, { useState } from 'react';
import { ChatBot } from './components/ChatBot';
import { VoiceAssistant } from './components/VoiceAssistant';
import { HistoryView } from './components/HistoryView';
import { 
  Droplets, 
  MessageSquare, 
  PhoneCall, 
  History, 
  Database, 
  MapPin,
  Clock,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './db';

const SERVICE_AREAS = [
  { name: 'Akra', active: true },
  { name: 'Nangi', active: true },
  { name: 'Budge Budge', active: true },
  { name: 'Santoshpur', active: true },
  { name: 'Maheshtala', active: true },
  { name: 'Batanagar', active: true },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'voice' | 'history'>('voice');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

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
    <div className="min-h-screen bg-black text-slate-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-hidden flex flex-col">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-navy/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-glow/5 rounded-full blur-[150px] animate-pulse delay-1000" />
      </div>

      {/* Header / Logo */}
      <header className="relative z-20 p-8 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-cyan-glow/10 rounded-2xl shadow-[0_0_20px_rgba(72,202,228,0.2)] border border-cyan-glow/30">
            <Droplets size={32} className="text-cyan-glow" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tighter leading-none mb-1.5 text-white">AQUA QUENCE</h1>
            <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-glow font-bold opacity-80">by Indiversa Water</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
            className="p-3 text-slate-400 hover:text-cyan-glow transition-all glass-panel rounded-xl lg:hidden active:scale-90"
          >
            {isSidePanelOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="hidden lg:flex items-center gap-10">
            {[
              { id: 'voice', label: 'Voice Agent', icon: PhoneCall },
              { id: 'chat', label: 'Chat Link', icon: MessageSquare },
              { id: 'history', label: 'Archive', icon: History }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative py-2 ${
                  activeTab === tab.id ? 'text-cyan-glow' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute -bottom-8 left-0 right-0 h-0.5 bg-cyan-glow shadow-[0_0_10px_#48CAE4]"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative z-10 overflow-hidden">
        {/* Side Panel (Status & Local Intel) */}
        <aside className={`
          fixed inset-y-0 left-0 w-72 glass-panel border-r border-white/5 z-40 transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1) lg:relative lg:translate-x-0
          ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col p-10
        `}>
          <div className="mb-12">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-500 mb-8 flex items-center gap-3">
              <MapPin size={14} className="text-cyan-glow" />
              Service Grid
            </h3>
            <div className="space-y-6">
              {SERVICE_AREAS.map((area) => (
                <div key={area.name} className="flex items-center justify-between group cursor-default">
                  <span className="text-xs font-bold tracking-wider text-slate-400 group-hover:text-white transition-colors uppercase">{area.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-bold uppercase tracking-tighter text-emerald-500/50">Online</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-12">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-500 mb-8 flex items-center gap-3">
              <ShieldCheck size={14} className="text-cyan-glow" />
              Security
            </h3>
            <div className="p-5 rounded-none bg-white/5 border border-white/10">
              <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-medium">
                Quantum-safe encryption active. All voice packets are processed locally before uplink.
              </p>
            </div>
          </div>

          <div className="mt-auto pt-8 border-t border-white/5 space-y-8">
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-cyan-glow" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]">24/7 Intel</span>
              </div>
              <button
                onClick={clearAllHistory}
                className="p-2.5 text-slate-500 hover:text-rose-400 transition-all rounded-xl hover:bg-rose-400/10 border border-transparent hover:border-rose-400/20"
                title="Wipe Local Data"
              >
                <Database size={20} />
              </button>
            </div>
          </div>
        </aside>

        {/* Hero Section (Agent Focus) */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-16 relative overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20, filter: 'blur(20px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(20px)' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-5xl"
            >
              {activeTab === 'voice' && <VoiceAssistant />}
              {activeTab === 'chat' && <ChatBot />}
              {activeTab === 'history' && <HistoryView />}
            </motion.div>
          </AnimatePresence>

          {/* Tab Switcher (Mobile) */}
          <div className="lg:hidden fixed bottom-10 left-1/2 -translate-x-1/2 glass-panel rounded-full p-2 flex gap-2 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <button onClick={() => setActiveTab('voice')} className={`p-4 rounded-full transition-all ${activeTab === 'voice' ? 'bg-cyan-glow text-navy shadow-[0_0_20px_#48CAE4]' : 'text-slate-400'}`}><PhoneCall size={24} /></button>
            <button onClick={() => setActiveTab('chat')} className={`p-4 rounded-full transition-all ${activeTab === 'chat' ? 'bg-cyan-glow text-navy shadow-[0_0_20px_#48CAE4]' : 'text-slate-400'}`}><MessageSquare size={24} /></button>
            <button onClick={() => setActiveTab('history')} className={`p-4 rounded-full transition-all ${activeTab === 'history' ? 'bg-cyan-glow text-navy shadow-[0_0_20px_#48CAE4]' : 'text-slate-400'}`}><History size={24} /></button>
          </div>
        </main>
      </div>

      {/* Footer Branding */}
      <footer className="relative z-20 p-8 text-center border-t border-white/5 bg-black/40 backdrop-blur-md">
        <p className="text-[10px] text-slate-600 uppercase tracking-[0.6em] font-bold">
          Powered by Gemini 3.1 Pro & Crystal-Stream Technology • Aqua Quence v2.0
        </p>
      </footer>

      {/* Mobile Side Panel Overlay */}
      <AnimatePresence>
        {isSidePanelOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsSidePanelOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
