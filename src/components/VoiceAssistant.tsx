import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { db } from '../db';
import { syncToGoogleSheets } from '../services/googleSheets';
import { v4 as uuidv4 } from 'uuid';
import { SYSTEM_INSTRUCTION } from '../services/gemini';

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0]) {
      // Send the first channel data to the main thread
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
  const processorRef = useRef<any>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const isPlayingRef = useRef(false);
  const isConnectedRef = useRef(false);
  const isClosingRef = useRef(false);
  const isSessionActiveRef = useRef(false);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      isClosingRef.current = true;
      isSessionActiveRef.current = false;
      stopAudioCapture();
      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  const startCall = async () => {
    if (isConnected || isConnecting) return;
    isClosingRef.current = false;
    setIsConnecting(true);
    let currentTurnText = '';
    let currentMessageId: number | null = null;

    // CRITICAL: Initialize AudioContext immediately on user gesture for mobile/Samsung compatibility
    try {
      if (!audioContextRef.current) {
        // ALWAYS use default rate first on mobile/Samsung to avoid hardware rejection
        // We will resample everything to 16000 for the AI
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Play a tiny silent sound to "warm up" the context on mobile/Samsung
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      oscillator.start(0);
      oscillator.stop(0.1);
      
      console.log("AudioContext initialized/resumed successfully. Sample rate:", audioContextRef.current.sampleRate);
    } catch (e) {
      console.error("Failed to initialize AudioContext on gesture:", e);
    }

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
            isSessionActiveRef.current = true;
            setIsConnected(true);
            setIsConnecting(false);
            startAudioCapture();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (isClosingRef.current || !isSessionActiveRef.current) return;
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
      console.error("Failed to start call:", error);
      setIsConnecting(false);
      
      let errorMessage = "Failed to connect to voice assistant.";
      
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        errorMessage = "Microphone access was denied. On Samsung devices, please check: \n1. Site Settings in your browser\n2. Phone Settings > Apps > [Browser] > Permissions\n3. Phone Settings > Security & Privacy > Privacy > Microphone Access (MUST BE ON)\n4. Ensure no other app is using the microphone.";
      } else if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.status === 429) {
        errorMessage = "Aqua Quence is currently handling too many voice calls (Quota Exceeded). Please wait about 60 seconds and try again.";
      } else if (error?.message?.includes("leaked") || error?.message?.includes("403") || error?.status === 403) {
        errorMessage = "Your Gemini API key has been reported as leaked and disabled. Please go to the AI Studio Settings (top right) and provide a fresh API key to continue.";
      }
      
      alert(errorMessage);
    }
  };

  const stopCall = () => {
    isClosingRef.current = true;
    isSessionActiveRef.current = false;
    stopAudioCapture();
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
      sessionRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    // Suspend AudioContext to release resources but don't close it
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend().catch(() => {});
    }
  };

  const startAudioCapture = async () => {
    if (isClosingRef.current) return;
    
    try {
      // AudioContext should already be initialized from startCall gesture
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      if (isClosingRef.current) return;

      // Check for getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support microphone access. Please try a modern browser like Chrome or Samsung Internet.");
      }

      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      } catch (err) {
        console.warn("Failed to get audio with constraints, falling back to simple audio: true", err);
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      if (isClosingRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        return;
      }

      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      // Use AudioWorklet instead of ScriptProcessor to avoid deprecation warnings and improve performance
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      
      try {
        if (!audioContextRef.current.audioWorklet) {
          throw new Error("AudioWorklet not supported in this browser");
        }
        
        await audioContextRef.current.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        console.log("AudioWorklet loaded successfully");
        
        if (isClosingRef.current) return;
        
        const workletNode = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
        console.log("AudioWorkletNode created successfully");
        
        workletNode.port.onmessage = (event) => {
          // Strict state checks to prevent sending data to a closed/closing socket
          if (isMuted || !sessionRef.current || !isSessionActiveRef.current || isClosingRef.current) {
            setMicLevel(0);
            return;
          }
          
          let inputData = event.data;
          
          // Calculate mic level for visual feedback
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setMicLevel(Math.min(100, rms * 500));
          
          // Resample to 16000 if needed
          if (audioContextRef.current && audioContextRef.current.sampleRate !== 16000) {
            inputData = resample(inputData, audioContextRef.current.sampleRate, 16000);
          }
          
          const pcmData = floatTo16BitPCM(inputData);
          const base64Data = uint8ArrayToBase64(new Uint8Array(pcmData.buffer));
          
          try {
            // Double check session state before sending
            if (sessionRef.current && isSessionActiveRef.current && !isClosingRef.current) {
              sessionRef.current.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              }).catch(() => {
                // Silently handle any send errors during transition
              });
            }
          } catch (err) {
            // Silently catch WebSocket errors during closing transitions
          }
        };

        if (isClosingRef.current) {
          workletNode.port.onmessage = null;
          workletNode.disconnect();
          return;
        }

        sourceRef.current.connect(workletNode);
        workletNode.connect(audioContextRef.current.destination);
        processorRef.current = workletNode;
      } catch (workletError) {
        console.error("AudioWorklet failed, falling back to ScriptProcessor:", workletError);
        
        if (isClosingRef.current) return;

        // Fallback to ScriptProcessor if AudioWorklet is not supported (unlikely in modern browsers)
        const scriptNode = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        scriptNode.onaudioprocess = (e) => {
          if (isMuted || !sessionRef.current || !isSessionActiveRef.current || isClosingRef.current) {
            setMicLevel(0);
            return;
          }
          let inputData = e.inputBuffer.getChannelData(0);
          
          // Calculate mic level for visual feedback
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setMicLevel(Math.min(100, rms * 500));
          
          // Resample to 16000 if needed
          if (audioContextRef.current && audioContextRef.current.sampleRate !== 16000) {
            inputData = resample(inputData, audioContextRef.current.sampleRate, 16000);
          }
          
          const pcmData = floatTo16BitPCM(inputData);
          const base64Data = uint8ArrayToBase64(new Uint8Array(pcmData.buffer));
          try {
            if (sessionRef.current && isSessionActiveRef.current && !isClosingRef.current) {
              sessionRef.current.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              }).catch(() => {});
            }
          } catch (err) {}
        };
        
        if (isClosingRef.current) {
          scriptNode.onaudioprocess = null;
          scriptNode.disconnect();
          return;
        }

        sourceRef.current.connect(scriptNode);
        scriptNode.connect(audioContextRef.current.destination);
        processorRef.current = scriptNode;
      }
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
      if (processorRef.current instanceof AudioWorkletNode) {
        processorRef.current.port.onmessage = null;
      } else {
        processorRef.current.onaudioprocess = null;
      }
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    // Don't close AudioContext here as it might be needed for playback
    // Instead, just suspend it to save resources
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend().catch(console.error);
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

  return (
    <div className="flex flex-col h-full glass-panel rounded-3xl overflow-hidden relative min-h-[600px]">
      {/* Background Glows */}
      <AnimatePresence>
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0 pointer-events-none"
          >
            <div className="absolute inset-0 bg-cyan-glow/5 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-cyan-glow animate-pulse shadow-[0_0_10px_#48CAE4]' : 'bg-slate-600'}`} />
          <h2 className="text-white font-display font-bold tracking-tight uppercase text-sm">Comm-Center Agent</h2>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && !isMuted && (
            <div className="flex gap-1 items-end h-5 w-16">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    height: isSpeaking ? [4, 20, 4] : [4, Math.max(4, micLevel * (0.6 + Math.random())), 4] 
                  }}
                  transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.08 }}
                  className="w-1 bg-cyan-glow rounded-full shadow-[0_0_8px_#48CAE4]"
                />
              ))}
            </div>
          )}
          {isConnected && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-xl transition-all ${
                isMuted ? 'text-rose-400 bg-rose-400/10 border border-rose-400/20' : 'text-slate-400 hover:text-cyan-glow hover:bg-cyan-glow/10 border border-transparent'
              }`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Content (Agent Focus) */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 z-10">
        <div className="relative mb-16">
          {/* Pulsing Orb / Liquid Waveform */}
          <motion.div
            animate={isConnected ? { 
              scale: isSpeaking ? [1, 1.15, 1] : [1, 1.05, 1],
              boxShadow: isSpeaking 
                ? ["0 0 40px 10px rgba(72, 202, 228, 0.2)", "0 0 80px 30px rgba(72, 202, 228, 0.4)", "0 0 40px 10px rgba(72, 202, 228, 0.2)"]
                : ["0 0 40px 10px rgba(72, 202, 228, 0.1)", "0 0 60px 20px rgba(72, 202, 228, 0.2)", "0 0 40px 10px rgba(72, 202, 228, 0.1)"]
            } : {}}
            transition={{ repeat: Infinity, duration: isSpeaking ? 1.5 : 3, ease: "easeInOut" }}
            className={`w-48 h-48 rounded-full flex items-center justify-center border-2 transition-all duration-700 relative overflow-hidden ${
              isConnected 
                ? 'border-cyan-glow/50 bg-cyan-glow/10' 
                : 'border-white/10 bg-white/5'
            }`}
          >
            {/* Liquid Wave Effect inside the orb */}
            {isConnected && (
              <motion.div 
                animate={{ y: isSpeaking ? [0, -10, 0] : [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 opacity-30 pointer-events-none"
              >
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-cyan-glow blur-2xl" />
              </motion.div>
            )}
            
            <div className="relative z-10">
              {isConnected ? (
                <Volume2 size={64} className="text-cyan-glow drop-shadow-[0_0_15px_#48CAE4]" />
              ) : (
                <Phone size={64} className="text-slate-600" />
              )}
            </div>
          </motion.div>
          
          {/* External Ripple for Voice Activation Button area */}
          {!isConnected && !isConnecting && (
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="w-48 h-48 rounded-full border border-cyan-glow/20 animate-[ping_3s_infinite]" />
              <div className="absolute w-48 h-48 rounded-full border border-cyan-glow/10 animate-[ping_3s_infinite_1s]" />
            </div>
          )}
        </div>

        <div className="text-center mb-16">
          <h3 className="text-2xl font-display font-bold text-white mb-3 tracking-tight">
            {isConnected 
              ? (isSpeaking ? "Agent Speaking" : "Listening...") 
              : isConnecting ? "Establishing Link..." : "Voice Activation"}
          </h3>
          <div className="flex flex-col items-center gap-2">
            <p className="text-slate-400 text-sm max-w-xs mx-auto font-medium leading-relaxed">
              {isConnected 
                ? (isSpeaking ? "Aqua Quence is processing your request." : "Tell us what you need for your hydration.") 
                : "Initiate a secure voice link to our automated supply agent."}
            </p>
            {isConnected && (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-glow font-bold">Active Hydration</span>
              </div>
            )}
          </div>
        </div>

        {/* Floating Voice Activation Button */}
        <div className="ripple-container">
          {!isConnected && !isConnecting && (
            <>
              <div className="ripple" style={{ animationDuration: '3s' }} />
              <div className="ripple" style={{ animationDuration: '3s', animationDelay: '1s' }} />
            </>
          )}
          
          <button
            onClick={isConnected ? stopCall : startCall}
            disabled={isConnecting}
            className={`group relative z-10 flex items-center justify-center w-20 h-20 rounded-full transition-all duration-500 transform hover:scale-110 active:scale-95 ${
              isConnected 
                ? 'bg-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)]' 
                : 'metallic-button !p-0 !rounded-full shadow-[0_0_30px_rgba(72,202,228,0.3)]'
            }`}
          >
            {isConnecting ? (
              <Loader2 size={32} className="animate-spin text-navy" />
            ) : isConnected ? (
              <PhoneOff size={32} className="text-white" />
            ) : (
              <Mic size={32} className="text-navy" />
            )}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="p-6 bg-white/5 border-t border-white/10 text-center z-10 backdrop-blur-md">
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Latency</span>
            <span className="text-xs font-mono text-cyan-glow">24ms</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Encryption</span>
            <span className="text-xs font-mono text-cyan-glow">AES-256</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Protocol</span>
            <span className="text-xs font-mono text-cyan-glow">V-STREAM</span>
          </div>
        </div>
      </div>
    </div>
  );
};
