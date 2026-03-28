import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from 'lucide-react';
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
  const [sessionId] = useState<string>(() => {
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
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      
      sessionRef.current = await ai.live.connect({
        model: "models/gemini-2.0-flash-exp", 
        config: {
          generationConfig: { responseModalities: [Modality.AUDIO] },
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
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const audioData = base64ToUint8Array(part.inlineData.data);
                  audioQueueRef.current.push(new Int16Array(audioData.buffer));
                  if (!isPlayingRef.current) {
                    setIsSpeaking(true);
                    playNextInQueue();
                  }
                }
                if (part.text) {
                  currentTurnText += part.text;
                  if (currentMessageId === null) {
                    currentMessageId = await db.messages.add({
                      sessionId, role: 'model', content: currentTurnText, timestamp: Date.now(), type: 'voice'
                    }) as number;
                  } else {
                    await db.messages.update(currentMessageId, { content: currentTurnText });
                  }
                }
              }
            }
            if (message.serverContent?.turnComplete) {
              if (currentMessageId !== null) await syncToGoogleSheets(sessionId);
              currentTurnText = '';
              currentMessageId = null;
            }
          },
          onclose: () => stopCall(),
          onerror: (e) => { console.error(e); stopCall(); }
        }
      });
    } catch (e) {
      console.error(e);
      setIsConnecting(false);
    }
  };

  const stopCall = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
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
        if (isMuted || !sessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        sessionRef.current.sendRealtimeInput({
          audio: { data: uint8ArrayToBase64(new Uint8Array(pcmData.buffer)), mimeType: 'audio/pcm;rate=16000' }
        });
      };
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (e) { console.error(e); }
  };

  const stopAudioCapture = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
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
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const buffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) data[i] = pcmData[i] / 32768;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => playNextInQueue();
    source.start();
  };

  const base64ToUint8Array = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const uint8ArrayToBase64 = (u8: Uint8Array) => btoa(Array.from(u8).map(b => String.fromCharCode(b)).join(''));
  const floatTo16BitPCM = (f32: Float32Array) => {
    const b = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      b[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return b;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden relative">
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50 z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          <h2 className="text-slate-200 font-semibold">Aqua Quence Voice</h2>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
        <motion.div animate={isConnected ? { scale: [1, 1.1, 1] } : {}} className="w-32 h-32 rounded-full border-4 flex items-center justify-center mb-8">
           {isConnected ? <Volume2 size={48} className="text-indigo-400" /> : <Phone size={48} className="text-slate-500" />}
        </motion.div>
        <button 
          onClick={isConnected ? stopCall : startCall} 
          disabled={isConnecting}
          className={`px-8 py-4 rounded-full font-bold text-white ${isConnected ? 'bg-rose-500' : 'bg-indigo-600'}`}
        >
          {isConnecting ? <Loader2 className="animate-spin" /> : isConnected ? "End Call" : "Call Aqua Quence"}
        </button>
      </div>
    </div>
  );
};
