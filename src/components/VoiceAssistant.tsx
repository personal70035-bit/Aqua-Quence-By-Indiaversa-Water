import React, { useState, useEffect } from 'react';

// Define any interfaces if you are using TypeScript strictly
interface VoiceAssistantProps {
  onTranscript?: (text: string) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onTranscript }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAssistant = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Logic for connecting to your voice service (e.g., OpenAI, Web Speech API)
      console.log("Connecting to voice service...");
      
      // Simulate connection logic
      setIsListening(true);
      
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Could not start voice assistant.");
    } finally {
      // This is line 90-91 from your error log
      setIsConnecting(false);
    } 
  }; // <--- This closes startAssistant

  const stopAssistant = () => {
    setIsListening(false);
  };

  return (
    <div className="voice-assistant-container">
      <h3>Voice Assistant</h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      <button 
        onClick={isListening ? stopAssistant : startAssistant}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting...' : isListening ? 'Stop Listening' : 'Start Assistant'}
      </button>

      <div className="status-indicator">
        Status: {isListening ? 'Active' : 'Idle'}
      </div>
    </div>
  );
}; // <--- This closes the Component (The missing bracket!)

export default VoiceAssistant;
