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
          // Fields set directly on config to avoid deprecation warnings
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
          onerror: (e) => { console.error("Live Error:", e); stopCall(); }
        }
      });
    } catch (e) {
      console.error("Connection Failed:", e);
      setIsConnecting(false);
    }
