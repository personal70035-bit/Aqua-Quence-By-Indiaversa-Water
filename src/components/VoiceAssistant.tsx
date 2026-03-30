import React, { useState, useRef } from 'react';
import { Phone, PhoneOff, Loader2, MapPin, User, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { MODELS, SYSTEM_INSTRUCTION } from '../services/gemini';
import { db } from '../db';

export const VoiceAssistant: React.FC = () => {
  const [isIdle, setIsIdle] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showDenied, setShowDenied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const startCall = async () => {
    setIsIdle(false);
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      // 1. Request Mic Permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
          channelCount: 1,
          sampleRate: 16000,
      } });
      streamRef.current = stream;

      // 2. Setup Audio Context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      nextPlayTimeRef.current = 0;

      // 3. Connect to Gemini Live
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const session = await ai.live.connect({
        model: MODELS.LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);

            // 4. Start processing mic input and sending to Gemini
            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(2048, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              const buffer = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < buffer.byteLength; i++) {
                binary += String.fromCharCode(buffer[i]);
              }
              const base64 = btoa(binary);
              
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({
                  audio: { data: base64, mimeType: "audio/pcm;rate=16000" }
                });
              }
            };
            
            source.connect(processor);
            processor.connect(audioCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // 5. Handle incoming audio
            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = 0; // Reset playback queue on interruption
            }
            
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binary = atob(base64Audio);
              const buffer = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                buffer[i] = binary.charCodeAt(i);
              }
              const pcm16 = new Int16Array(buffer.buffer);
              
              // Live API returns 24kHz PCM
              const audioBuffer = audioContextRef.current.createBuffer(1, pcm16.length, 24000);
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 32768.0;
              }
              
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);
              
              const currentTime = audioContextRef.current.currentTime;
              const startTime = Math.max(currentTime, nextPlayTimeRef.current);
              source.start(startTime);
              nextPlayTimeRef.current = startTime + audioBuffer.duration;
            }
          },
          onclose: () => stopCall(),
          onerror: (error) => {
            console.error("Live API Error:", error);
            stopCall();
          }
        }
      });
      sessionRef.current = session;
    } catch (error: any) {
      console.error("Failed to start call:", error);
      setIsConnecting(false);
      setIsIdle(true);
      if (error?.message?.includes("403") || error?.message?.includes("PERMISSION_DENIED") || error?.message?.includes("API_KEY_SERVICE_BLOCKED")) {
        setErrorMsg("API Error: The Generative Language API is blocked or disabled for this key.");
      } else if (error?.name === 'NotAllowedError' || error?.name === 'NotFoundError') {
        setErrorMsg("Microphone access denied. Please allow microphone permissions in your browser.");
      } else {
        setShowDenied(true);
        setTimeout(() => setShowDenied(false), 3000);
      }
    }
  };

  const declineCall = () => {
    setIsConnecting(false);
    setIsIdle(true);
    setShowDenied(true);
    setTimeout(() => setShowDenied(false), 3000);
  };

  const stopCall = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
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
      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-24 bg-red-500/90 text-white px-6 py-4 rounded-2xl shadow-lg z-20 max-w-md text-center border border-red-400"
        >
          <p className="text-sm font-medium">{errorMsg}</p>
          <button 
            onClick={() => {
              setErrorMsg(null);
              (window as any).aistudio?.openSelectKey?.();
            }} 
            className="mt-3 text-xs bg-white text-red-600 hover:bg-red-50 px-4 py-2 rounded-full font-bold transition-colors"
          >
            Select Different API Key
          </button>
        </motion.div>
      )}
      <div className="relative flex items-center justify-center mt-12 md:mt-0">
        <button
          onClick={isIdle ? startCall : stopCall}
          className={`w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 transition-all duration-500 relative overflow-hidden ${
            isActive ? 'bg-red-500' : 'bg-blue-600'
          } shadow-2xl shadow-blue-500/20`}
        >
          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div
                className="absolute w-full h-full bg-white/20 rounded-full"
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
              />
              <motion.div
                className="absolute w-full h-full bg-white/20 rounded-full"
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut", delay: 0.75 }}
              />
            </div>
          )}
          
          {isConnecting ? (
            <Loader2 className="animate-spin text-white relative z-10" size={64} />
          ) : isEnding ? (
            <span className="text-white font-bold tracking-widest uppercase relative z-10">Call End</span>
          ) : (
            <>
              {isActive ? (
                <div className="flex items-center justify-center gap-1.5 h-12 mb-1 relative z-10">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-white rounded-full"
                      animate={{ height: ["20%", "100%", "20%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1,
                        delay: i * 0.15,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Phone className="text-white relative z-10" size={48} />
              )}
              <span className="text-white font-bold tracking-widest uppercase relative z-10">
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

      <div className="grid grid-cols-3 gap-4 w-full max-w-4xl mt-8 px-4">
        <div className="flex flex-col items-center gap-2">
          <MapPin className="text-blue-500" size={24} />
          <div className="text-center">
            <p className="text-white font-semibold">Location</p>
            <p className="text-white/60 text-xs sm:text-sm">Maheshtala, Kolkata</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Clock className="text-blue-500" size={24} />
          <div className="text-center">
            <p className="text-white font-semibold">Office Timings</p>
            <p className="text-white/60 text-xs sm:text-sm">10:00 AM - 1:00 PM<br/>6:00 PM - 9:00 PM</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <User className="text-blue-500" size={24} />
          <div className="text-center">
            <p className="text-white font-semibold">Owner</p>
            <p className="text-white/60 text-xs sm:text-sm">Anisul Alam</p>
          </div>
        </div>
      </div>
    </div>
  );
};
