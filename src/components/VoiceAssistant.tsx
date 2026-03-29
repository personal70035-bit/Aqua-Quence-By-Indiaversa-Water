import React, { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface VoiceAssistantProps {
  onTranscript?: (text: string) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onTranscript }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey || "");

  // ✅ FINAL FIX 1: Upgraded to gemini-2.0-flash for the new SDK
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const startAssistant = async () => {
    if (!apiKey) {
      setError("API Key missing! Check Cloudflare Environment Variables.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // ✅ FINAL FIX 2: Correctly formatted config to stop the warning
      const chat = model.startChat({
        history: [],
        generationConfig: {
          temperature: 1,
          topP: 0.95,
          maxOutputTokens: 1000,
        }
      });

      console.log("Assistant Connected!");
      setIsListening(true);
      
      // ✅ Test Message to prove it works
      const result = await chat.sendMessage("Hello! Are you there?");
      console.log("Gemini says:", result.response.text());

    } catch (err: any) {
      console.error("Connection failed:", err);
      setError("Could not reach Gemini. Check console for details.");
    } finally {
      setIsConnecting(false);
    } 
  };

  const stopAssistant = () => {
    setIsListening(false);
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white max-w-sm mx-auto">
      <h3 className="text-lg font-bold mb-2">Gemini Voice Assistant</h3>
      <p className="text-sm text-gray-600 mb-4">
        Status: {isListening ? '🟢 Active' : '⚪ Idle'}
      </p>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      
      <button 
        onClick={isListening ? stopAssistant : startAssistant}
        disabled={isConnecting}
        className={`w-full py-2 rounded font-medium transition ${
          isListening ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white'
        }`}
      >
        {isConnecting ? 'Connecting...' : isListening ? 'Stop Assistant' : 'Start Assistant'}
      </button>
    </div>
  );
};

export default VoiceAssistant;
