import React, { useState, useRef } from 'react';
import { Mic, PhoneOff, Loader2, MapPin, User } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { MODELS, SYSTEM_INSTRUCTION } from '../services/gemini';
import { db } from '../db';

export const VoiceAssistant: React.FC = () => {
  const [isIdle, setIsIdle] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showDenied, setShowDenied] = useState(false);
  const sessionRef = useRef<any>(null);

  const startCall = async () => {
    setIsIdle(false);
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      sessionRef.current = await ai.live.connect({
        model: MODELS.LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
          },
          onmessage: async (message) => {
            // Handle audio/transcription
          },
          onclose: () => stopCall(),
          onerror: (error) => {
            console.error("Live API Error:", error);
            stopCall();
          }
        }
      });
    } catch (error) {
      console.error("Failed to start call:", error);
      setIsConnecting(false);
      setIsIdle(true);
      setShowDenied(true);
      setTimeout(() => setShowDenied(false), 3000);
    }
  };

  const declineCall = () => {
    setIsConnecting(false);
    setIsIdle(true);
    setShowDenied(true);
    setTimeout(() => setShowDenied(false), 3000);
  };

  const stopCall = () => {
    if (sessionRef.current) sessionRef.current.close();
    setIsActive(false);
    setIsEnding(true);
    setTimeout(() => {
      setIsEnding(false);
      setIsIdle(true);
    }, 2000);
  };

  const endLiveCall = () => {
    stopCall();
    setShowDenied(true);
    setTimeout(() => setShowDenied(false), 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {showDenied && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-24 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg z-20"
        >
          Call Denied
        </motion.div>
      )}
      <div className="relative flex items-center justify-center">
        <button
          onClick={isIdle ? startCall : stopCall}
          className={`w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-500 ${
            isActive ? 'bg-red-500' : 'bg-blue-600'
          } shadow-2xl shadow-blue-500/20`}
        >
          {isConnecting ? (
            <Loader2 className="animate-spin text-white" size={64} />
          ) : isEnding ? (
            <span className="text-white font-bold tracking-widest uppercase">Call End</span>
          ) : (
            <>
              <Mic className="text-white" size={48} />
              <span className="text-white font-bold tracking-widest uppercase">
                {isActive ? 'Live' : 'Call Aqua'}
              </span>
            </>
          )}
        </button>
        {isActive && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <span className="w-2 h-2 bg-white rounded-full" />
            LIVE
          </div>
        )}
      </div>
      {isConnecting && (
        <button 
          onClick={declineCall} 
          className="w-full max-w-xs bg-red-600 hover:bg-red-700 text-white py-4 rounded-full font-bold tracking-widest uppercase shadow-lg transition-all"
        >
          Decline Call
        </button>
      )}
      {isActive && (
        <button 
          onClick={endLiveCall} 
          className="w-full max-w-xs bg-red-600 hover:bg-red-700 text-white py-4 rounded-full font-bold tracking-widest uppercase shadow-lg transition-all"
        >
          Decline Call
        </button>
      )}
      <div className="text-center">
        <h2 className="text-2xl font-light text-white">Need fresh water?</h2>
        <p className="text-white/40 mt-2">Call our AI assistant to place your order for Maheshtala delivery.</p>
      </div>

      <div className="flex items-center justify-center gap-12 mt-8">
        <div className="flex flex-col items-center gap-2">
          <MapPin className="text-blue-500" size={24} />
          <div className="text-center">
            <p className="text-white font-semibold">Location</p>
            <p className="text-white/60 text-sm">Maheshtala, Kolkata</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <User className="text-blue-500" size={24} />
          <div className="text-center">
            <p className="text-white font-semibold">Owner</p>
            <p className="text-white/60 text-sm">Anisul Alam</p>
          </div>
        </div>
      </div>
    </div>
  );
};
