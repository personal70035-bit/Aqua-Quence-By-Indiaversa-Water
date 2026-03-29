import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MicOff, Phone, PhoneOff, Activity, Clock as ClockIcon } from 'lucide-react';
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { syncToGoogleSheets } from '../services/googleSheets';
import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_INSTRUCTION } from '../services/gemini';

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0]) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

export const VoiceAssistant: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId] = useState<string>(() => {
    const saved = localStorage.getItem('aqua_quence_voice_session_id');
    if (saved) return saved;
    const newId = uuidv4();
    localStorage.setItem('aqua_quence_voice_session_id', newId);
    return newId;
  });

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<any>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const isPlayingRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const isClosingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    if (isConnected || isConnecting) return;
    isClosingRef.current = false;
    setIsConnecting(true);
    let currentTurnText = '';
    let currentMessageId: number | null = null;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.error("AudioContext init failed:", e);
    }

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
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
            isSessionActiveRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            startAudioCapture();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (isClosingRef.current || !isSessionActiveRef.current) return;
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
            if (message.serverContent?.turnComplete) {
              if (currentMessageId !== null) {
                await syncToGoogleSheets(sessionId);
              }
              currentTurnText = '';
              currentMessageId = null;
            }
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              currentTurnText = '';
              currentMessageId = null;
            }
          },
          onclose: () => {
            isSessionActiveRef.current = false;
            stopCall();
          },
          onerror: (error) => {
            console.error("Live API Error:", error);
            isSessionActiveRef.current = false;
            stopCall();
          }
        }
      });
    } catch (error: any) {
      isSessionActiveRef.current = false;
      setIsConnecting(false);
      console.error("Failed to start call:", error);
      alert("Connection failed. Please check your network and API key.");
    }
  };

  const stopCall = () => {
    isClosingRef.current = true;
    isSessionActiveRef.current = false;
    stopAudioCapture();
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend().catch(() => {});
    }
  };

  const startAudioCapture = async () => {
    if (isClosingRef.current) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      
      await audioContextRef.current.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
      workletNode.port.onmessage = (event) => {
        if (!sessionRef.current || !isSessionActiveRef.current || isClosingRef.current) {
          setMicLevel(0);
          return;
        }
        let inputData = event.data;
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        setMicLevel(Math.min(100, rms * 500));
        
        if (audioContextRef.current && audioContextRef.current.sampleRate !== 16000) {
          inputData = resample(inputData, audioContextRef.current.sampleRate, 16000);
        }
        const pcmData = floatTo16BitPCM(inputData);
        const base64Data = uint8ArrayToBase64(new Uint8Array(pcmData.buffer));
        
        if (sessionRef.current && isSessionActiveRef.current && !isClosingRef.current) {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          }).catch(() => {});
        }
      };

      sourceRef.current.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);
      processorRef.current = workletNode;
    } catch (error) {
      console.error("Error capturing audio:", error);
    }
  };

  const stopAudioCapture = () => {
    setMicLevel(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      if (processorRef.current instanceof AudioWorkletNode) processorRef.current.port.onmessage = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
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
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) channelData[i] = pcmData[i] / 32768;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => playNextInQueue();
    source.start();
  };

  const base64ToUint8Array = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const uint8ArrayToBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
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

  const resample = (data: Float32Array, fromRate: number, toRate: number) => {
    if (Math.abs(fromRate - toRate) < 1) return data;
    const ratio = fromRate / toRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const frac = pos - index;
      if (index + 1 < data.length) {
        result[i] = data[index] * (1 - frac) + data[index + 1] * frac;
      } else {
        result[i] = data[index];
      }
    }
    return result;
  };

  const messages = useLiveQuery(() => db.messages.where('sessionId').equals(sessionId).toArray(), [sessionId]);
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'active' | 'end'>('idle');

  const handleButtonClick = async () => {
    if (buttonState === 'idle') {
      setButtonState('loading');
      try {
        await startCall();
        setButtonState('active');
      } catch (err) {
        setButtonState('idle');
      }
    } else if (buttonState === 'active') {
      setButtonState('end');
      stopCall();
      setTimeout(() => setButtonState('idle'), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Ongoing Call Log Section */}
      <div className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black text-metallic-silver uppercase tracking-[0.3em] font-display">
            Active Connection Log
          </h3>
          {isConnected && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-aqua-cyan/10 border border-aqua-cyan/20">
              <div className="w-1.5 h-1.5 rounded-full bg-aqua-cyan animate-pulse" />
              <span className="text-[9px] font-black text-aqua-cyan font-mono">{formatDuration(callDuration)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {messages && messages.length > 0 ? (
            messages.slice(-4).map((msg, i) => (
              <motion.div 
                key={msg.id || i} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-panel p-3 silver-border flex items-center gap-3"
              >
                <div className={`w-1 h-1 rounded-full ${msg.role === 'user' ? 'bg-metallic-silver' : 'bg-aqua-cyan'}`} />
                <span className="text-[9px] font-bold text-metallic-silver/40 font-mono">
                  [{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                </span>
                <span className={`uppercase tracking-tighter text-[9px] font-black ${
                  msg.role === 'user' ? 'text-metallic-silver' : 'text-aqua-cyan'
                }`}>
                  {msg.role === 'user' ? 'User_Link' : 'Agent_Link'}
                </span>
              </motion.div>
            ))
          ) : (
            <div className="glass-panel p-6 opacity-20 italic text-[10px] uppercase tracking-widest text-center silver-border">
              Standby: No Active Streams
            </div>
          )}
        </div>
      </div>

      {/* Main Hero Area: Aqua Trigger */}
      <div className="h-[55vh] flex flex-col items-center justify-center relative">
        {/* Waveform Visualizer (Only when active) */}
        <AnimatePresence>
          {buttonState === 'active' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-12 flex items-end gap-1 h-12"
            >
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    height: isSpeaking ? [8, 32, 8] : [4, 8, 4],
                    opacity: isSpeaking ? 1 : 0.3
                  }}
                  transition={{ 
                    duration: 0.4, 
                    repeat: Infinity, 
                    delay: i * 0.05,
                    ease: "easeInOut"
                  }}
                  className="w-1 bg-aqua-cyan rounded-full"
                  style={{ height: `${4 + (micLevel / 10) * (i % 3 + 1)}px` }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Trigger Button */}
        <motion.div
          onClick={handleButtonClick}
          className={`aqua-trigger-btn ${
            buttonState === 'active' ? 'aqua-trigger-active' : 
            buttonState === 'end' ? 'aqua-trigger-end' :
            'aqua-trigger-inactive'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={buttonState}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="flex flex-col items-center gap-4"
            >
              {buttonState === 'idle' ? (
                <>
                  <div className="w-14 h-14 rounded-full border border-aqua-cyan/30 flex items-center justify-center bg-aqua-cyan/5">
                    <Phone size={28} className="text-aqua-cyan" />
                  </div>
                  <div className="text-center">
                    <span className="block text-[12px] font-black uppercase tracking-[0.4em] font-display">Call Aqua Quence</span>
                    <span className="block text-[8px] font-bold text-metallic-silver uppercase tracking-widest mt-1">Tap to Connect</span>
                  </div>
                </>
              ) : buttonState === 'loading' ? (
                <>
                  <div className="w-14 h-14 rounded-full border-2 border-aqua-cyan/20 border-t-aqua-cyan animate-spin" />
                  <span className="text-[12px] font-black uppercase tracking-[0.4em] font-display">Establishing...</span>
                </>
              ) : buttonState === 'active' ? (
                <>
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center"
                  >
                    <Activity size={32} className="text-white" />
                  </motion.div>
                  <div className="text-center">
                    <span className="block text-[12px] font-black uppercase tracking-[0.4em] font-display">Connected</span>
                    <span className="block text-[8px] font-bold text-white/70 uppercase tracking-widest mt-1">Now Talking</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <PhoneOff size={28} className="text-white" />
                  </div>
                  <span className="text-[12px] font-black uppercase tracking-[0.4em] font-display">Call Ended</span>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Pulsing Rings when active */}
          {buttonState === 'active' && (
            <>
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-aqua-cyan"
              />
              <motion.div
                animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="absolute inset-0 rounded-full border border-aqua-cyan"
              />
            </>
          )}
        </motion.div>

        {/* Footer Info */}
        <div className="mt-16 flex flex-col items-center gap-2 opacity-40">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-aqua-cyan animate-pulse' : 'bg-metallic-silver'}`} />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-metallic-silver">
              {isConnected ? 'Link_Active' : 'System_Standby'}
            </span>
          </div>
          <span className="text-[7px] font-bold text-metallic-silver/50 uppercase tracking-[0.5em]">Encrypted_Connection_v2.4</span>
        </div>
      </div>
    </div>
  );
};
