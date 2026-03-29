import React, { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface VoiceAssistantProps {
  onTranscript?: (text: string) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onTranscript }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Setup the Gemini API (Use your Environment Variable here)
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const startAssistant = async () => {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError("API Key missing! Please add VITE_GEMINI_API_KEY to your settings.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // 2. This is the part I updated to avoid the "deprecated" warning
      // We set the fields directly on the config object
      const chat = model.startChat({
        history: [],
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        },
      });

      console.log("Gemini Session Started");
      setIsListening(true);
      
      // Note: Full voice-to-voice requires Web Speech API integration
      // For now, this establishes the connection to the AI
      
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to connect to Gemini AI.");
    } finally {
      setIsConnecting(false);
    } 
  };

  const stopAssistant = () => {
    setIsListening(false);
  };

  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md space-y-4 border border-slate-200">
      <div className="text-center">
        <h3 className="text-xl font-medium text-black">Gemini Voice Assistant</h3>
        <p className="text-slate-500 text-sm">Status: {isListening ? '🟢 Listening' : '🔴 Idle'}</p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <div className="flex justify-center">
        <button 
          onClick={isListening ? stopAssistant : startAssistant}
          disabled={isConnecting}
          className={`px-4 py-2 rounded-full font-semibold text-white transition-all ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isConnecting ? 'Connecting...' : isListening ? 'Stop Assistant' : 'Start Assistant'}
        </button>
      </div>
    </div>
  );
};

export default VoiceAssistant;
