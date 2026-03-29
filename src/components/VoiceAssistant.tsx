import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { db } from '../db';
import { syncToGoogleSheets } from '../services/googleSheets';
import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_INSTRUCTION } from '../services/gemini';

export const VoiceAssistant: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('aqua_quence_voice_session_id');
    if (saved) return saved;
    const newId = uuidv4();
    localStorage.setItem('aqua_quence_voice_session_id', newId);
    return newId;
  });

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isPlayingRef = useRef(false);

  const startCall = async () => {
    setIsConnecting(true);
    let currentTurnText = '';
    let currentMessageId: number | null = null;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not set. Please check your environment variables.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      sessionRef.current = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            startAudioCapture();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const base64Audio = part.inlineData.data;
                  const audioData = base64ToUint8Array(base64Audio);
                  const pcmData = new Int16Array(audioData.buffer);
                  audioQueueRef.current.push(pcmData);
                  if (!isPlayingRef.current) {
                    setIsSpeaking(true);
                    playNextInQueue();
                  }
                }

                if (part.text) {
                  currentTurnText += part.text;
                  
                  if (currentMessageId === null) {
                    currentMessageId = await db.messages.add({
                      sessionId,
                      role: 'model',
                      content: currentTurnText,
                      timestamp: Date.now(),
                      type: 'voice'
                    }) as number;
                  } else {
                    await db.messages.update(currentMessageId, { content: currentTurnText });
                  }
                }
              }
            }

            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              if (currentMessageId !== null) {
                await syncToGoogleSheets(sessionId);
              }
              currentTurnText = '';
              currentMessageId = null;
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              currentTurnText = '';
              currentMessageId = null;
            }
          },
          onclose: () => {
            stopCall();
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            stopCall();
          }
        }
      });
    } catch (error) {
      console.error("Failed to start call:", error);
      setIsConnecting(false);
    }
  };

  const stopCall = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopAudioCapture();
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  const startAudioCapture = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64Data = uint8ArrayToBase64(new Uint8Array(pcmData.buffer));
        
        sessionRef.current?.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error("Error capturing audio:", error);
    }
  };

  const stopAudioCapture = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
  };

  const playNextInQueue = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const pcmData = audioQueueRef.current.shift()!;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => playNextInQueue();
    source.start();
  };

  // Helper functions
  const base64ToUint8Array = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const uint8ArrayToBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buffer;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl relative">
      {/* Background Animation */}
      <AnimatePresence>
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-ping opacity-30" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50 z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          <h2 className="text-slate-200 font-semibold">Aqua Quence Voice</h2>
        </div>
        {isConnected && (
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg transition-colors ${
              isMuted ? 'text-rose-400 bg-rose-400/10' : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10'
            }`}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
        <div className="relative mb-12">
          <motion.div
            animate={isConnected ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
              isConnected ? 'border-indigo-500 bg-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.3)]' : 'border-slate-700 bg-slate-800'
            }`}
          >
            {isConnected ? (
              <Volume2 size={48} className="text-indigo-400" />
            ) : (
              <Phone size={48} className="text-slate-500" />
            )}
          </motion.div>
          
          {isConnected && (
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  animate={{ height: [8, 24, 8] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                  className="w-1 bg-indigo-400 rounded-full"
                />
              ))}
            </div>
          )}
        </div>

        <div className="text-center mb-12">
          <h3 className="text-xl font-bold text-slate-100 mb-2">
            {isConnected 
              ? (isSpeaking ? "Aqua Quence is Speaking..." : "Aqua Quence is Listening...") 
              : isConnecting ? "Connecting..." : "Start Voice Order"}
          </h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            {isConnected 
              ? (isSpeaking ? "Please wait while we respond." : "Speak naturally to place your order.") 
              : "Experience our 24/7 AI Voice Assistant for instant water jar delivery."}
          </p>
        </div>

        <button
          onClick={isConnected ? stopCall : startCall}
          disabled={isConnecting}
          className={`group relative flex items-center gap-3 px-8 py-4 rounded-full font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            isConnected 
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          {isConnecting ? (
            <Loader2 size={24} className="animate-spin" />
          ) : isConnected ? (
            <>
              <PhoneOff size={24} />
              <span>End Call</span>
            </>
          ) : (
            <>
              <Phone size={24} />
              <span>Call Aqua Quence</span>
            </>
          )}
        </button>
      </div>

      {/* Status Bar */}
      <div className="p-4 bg-slate-800/30 border-t border-slate-700/50 text-center z-10">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
          Powered by Gemini Live API
        </span>
      </div>
    </div>
  );
};
