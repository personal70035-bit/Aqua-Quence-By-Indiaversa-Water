import React, { useState } from 'react';
import { Droplets, Phone, MessageSquare, Clock, Info as InfoIcon, Database } from 'lucide-react';
import { VoiceAssistant } from './components/VoiceAssistant';
import { ChatBot } from './components/ChatBot';
import { CallHistory } from './components/CallHistory';
import { ClearHistory } from './components/ClearHistory';
import { Info } from './components/Info';

export default function App() {
  const [currentView, setCurrentView] = useState<'voice' | 'chat' | 'history' | 'clear' | 'info'>('voice');

  return (
    <div className="min-h-screen bg-[#0a0502] text-white font-sans">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-900/20 rounded-full blur-[120px]" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 p-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Droplets size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Aqua Quence</h1>
            <p className="text-xs text-blue-400/60 uppercase tracking-widest">By Indiversa Water</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
          <div className="bg-white/5 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setCurrentView('voice')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-all ${currentView === 'voice' ? 'bg-blue-600' : 'text-white/40'}`}
            >
              <Phone size={16} /> <span className="hidden sm:inline">Voice</span>
            </button>
            <button
              onClick={() => setCurrentView('chat')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-all ${currentView === 'chat' ? 'bg-blue-600' : 'text-white/40'}`}
            >
              <MessageSquare size={16} /> <span className="hidden sm:inline">Chat</span>
            </button>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors" onClick={() => setCurrentView('clear')}>
            <Database size={16} /> <span className="text-sm hidden lg:block">Clear History</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors" onClick={() => setCurrentView('history')}>
            <Clock size={16} /> <span className="text-sm hidden lg:block">History</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors" onClick={() => setCurrentView('info')}>
            <InfoIcon size={16} /> <span className="text-sm hidden lg:block">Info</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-160px)] pt-24">
        {currentView === 'voice' && <VoiceAssistant />}
        {currentView === 'chat' && <ChatBot />}
        {currentView === 'history' && <CallHistory onClose={() => setCurrentView('voice')} />}
        {currentView === 'clear' && <ClearHistory onClose={() => setCurrentView('voice')} />}
        {currentView === 'info' && <Info onClose={() => setCurrentView('voice')} />}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 text-center text-[10px] text-white/20 uppercase tracking-widest z-10">
        © 2026 Aqua Quence By Indiversa Water
      </footer>
    </div>
  );
}
