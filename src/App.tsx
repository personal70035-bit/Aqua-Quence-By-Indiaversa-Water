import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  MessageSquare, 
  Clock, 
  Droplets, 
  MapPin, 
  ChevronRight,
  Info,
  Trash2,
  LayoutGrid
} from 'lucide-react';
import { VoiceAssistant } from './components/VoiceAssistant';
import { ChatBot } from './components/ChatBot';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';

// --- Types ---
type View = 'call' | 'chat' | 'history' | 'services';

const App: React.FC = () => {
  const [view, setView] = useState<View>('call');
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [droplets, setDroplets] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  const messages = useLiveQuery(
    () => db.messages.orderBy('timestamp').reverse().toArray(),
    []
  );

  // Background Effects
  useEffect(() => {
    const rippleInterval = setInterval(() => {
      setRipples(prev => [
        ...prev, 
        { id: Date.now(), x: Math.random() * 100, y: Math.random() * 100 }
      ].slice(-3));
    }, 4000);

    // Initialize droplets
    setDroplets([...Array(8)].map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5
    })));

    return () => clearInterval(rippleInterval);
  }, []);

  const clearHistory = async () => {
    if (confirm('Purge all call history and logs?')) {
      await db.messages.clear();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full relative overflow-hidden bg-space-black">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {ripples.map(ripple => (
          <motion.div
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.3 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 6, ease: "easeOut" }}
            className="ripple-circle"
            style={{ left: `${ripple.x}%`, top: `${ripple.y}%`, width: '100px', height: '100px' }}
          />
        ))}
        {droplets.map(droplet => (
          <motion.div
            key={droplet.id}
            animate={{ 
              y: [0, -20, 0],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ 
              duration: 4 + Math.random() * 2, 
              repeat: Infinity, 
              delay: droplet.delay,
              ease: "easeInOut"
            }}
            className="droplet w-2 h-3"
            style={{ left: `${droplet.x}%`, top: `${droplet.y}%` }}
          />
        ))}
      </div>

      {/* Top Bar: Metallic Header */}
      <header className="z-50 border-b border-white/5 bg-space-black/50 backdrop-blur-xl">
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-aqua-cyan to-electric-blue flex items-center justify-center shadow-[0_0_20px_rgba(0,245,255,0.3)]">
              <Droplets size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tighter text-silver-light font-display">AQUA QUENCE</span>
              <span className="text-[8px] font-bold tracking-[0.3em] text-metallic-silver uppercase">By Indiversa</span>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 text-metallic-silver">
            <MapPin size={12} className="text-aqua-cyan" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Akra Station Road • Maheshtala</span>
          </div>

          <div className="sm:hidden flex items-center gap-1 text-metallic-silver">
            <MapPin size={10} className="text-aqua-cyan" />
            <span className="text-[8px] font-bold uppercase tracking-widest">KOLKATA</span>
          </div>
        </div>

        {/* Scrolling Ticker */}
        <div className="h-8 border-t border-white/5 flex items-center overflow-hidden bg-white/2">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="flex gap-12 whitespace-nowrap px-6"
          >
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-12">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-metallic-silver/40">Serving Akra Station Road</span>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-metallic-silver/40">Nangi</span>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-metallic-silver/40">Budge Budge</span>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-metallic-silver/40">Santoshpur</span>
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'call' && (
            <motion.div
              key="call"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <VoiceAssistant />
            </motion.div>
          )}

          {view === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="h-full"
            >
              <ChatBot />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full p-6 overflow-y-auto no-scrollbar pb-32"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xs font-black uppercase tracking-[0.4em] text-metallic-silver font-display">Communication Logs</h2>
                <button 
                  onClick={clearHistory}
                  className="p-2 rounded-full hover:bg-crimson-red/10 text-crimson-red/40 hover:text-crimson-red transition-all"
                  title="Purge Logs"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="space-y-4">
                {messages && messages.length > 0 ? (
                  messages.map((msg) => (
                    <div key={msg.id} className="glass-panel p-4 silver-border flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${msg.role === 'user' ? 'bg-metallic-silver' : 'bg-aqua-cyan'}`} />
                          <span className="text-[9px] font-black uppercase tracking-widest text-metallic-silver">
                            {msg.role === 'user' ? 'User_Input' : 'Agent_Response'}
                          </span>
                        </div>
                        <span className="text-[8px] font-bold text-metallic-silver/40 uppercase">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-silver-light/80 leading-relaxed font-medium">
                        {msg.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="glass-panel p-12 text-center opacity-30 silver-border">
                    <Clock size={32} className="mx-auto mb-4" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Archive Empty</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'services' && (
            <motion.div
              key="services"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full p-6 overflow-y-auto no-scrollbar pb-32"
            >
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-metallic-silver mb-8 font-display">Inventory & Rates</h2>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { name: '20L Jar (Standard)', price: '₹30', detail: 'Home Delivery' },
                  { name: '20L Jar (Standard)', price: '₹25', detail: 'Shop Pickup' },
                  { name: '20L Jar (Chilled)', price: '₹35', detail: 'Instant Cold' },
                  { name: '1L Bottle Case', price: '₹180', detail: '12 Units' },
                ].map((service, i) => (
                  <div key={i} className="glass-panel p-5 silver-border flex items-center justify-between group hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Droplets size={20} className="text-aqua-cyan" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest">{service.name}</p>
                        <p className="text-[9px] text-metallic-silver font-bold uppercase tracking-tighter">{service.detail}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-aqua-cyan aqua-glow">{service.price}</p>
                      <ChevronRight size={12} className="text-metallic-silver ml-auto mt-1" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 glass-panel p-5 silver-border bg-aqua-cyan/5">
                <div className="flex items-center gap-3 mb-3">
                  <Info size={14} className="text-aqua-cyan" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-aqua-cyan">Service Protocol</p>
                </div>
                <ul className="space-y-2">
                  <li className="text-[9px] font-bold text-metallic-silver leading-relaxed">
                    • DELIVERY RADIUS: Akra, Nangi, Budge Budge, Santoshpur.
                  </li>
                  <li className="text-[9px] font-bold text-metallic-silver leading-relaxed">
                    • JAR DEPOSIT: ₹150 refundable security per standard jar.
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation: Nav Glass */}
      <nav className="nav-glass">
        {[
          { id: 'call', icon: Phone, label: 'Call' },
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
          { id: 'history', icon: Clock, label: 'History' },
          { id: 'services', icon: LayoutGrid, label: 'Services' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as View)}
            className="flex flex-col items-center gap-1 group relative px-4"
          >
            <div className={`p-2 rounded-2xl transition-all duration-300 ${
              view === item.id ? 'bg-aqua-cyan/20 scale-110' : 'hover:bg-white/5'
            }`}>
              <item.icon 
                size={22} 
                className={`transition-colors duration-300 ${
                  view === item.id ? 'text-aqua-cyan drop-shadow-[0_0_10px_rgba(0,245,255,0.5)]' : 'text-metallic-silver'
                }`} 
              />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${
              view === item.id ? 'text-aqua-cyan' : 'text-metallic-silver/50'
            }`}>
              {item.label}
            </span>
            {view === item.id && (
              <motion.div 
                layoutId="nav-glow"
                className="absolute -bottom-2 w-1 h-1 rounded-full bg-aqua-cyan shadow-[0_0_15px_rgba(0,245,255,0.8)]"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
