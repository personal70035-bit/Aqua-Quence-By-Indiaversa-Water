import { GoogleGenAI, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are the 24/7 Virtual Assistant for 'Aqua Quence by Indiversa Water' based in Maheshtala, Kolkata.
... (keep your existing instructions here) ...
`;

export const getGeminiFlash = () => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return ai.models.generateContent({
    // REMOVED "-latest" and added "models/"
    model: "models/gemini-1.5-flash", 
    contents: [{ parts: [{ text: "" }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const createChat = () => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return ai.chats.create({
    // REMOVED "-latest" and added "models/"
    model: "models/gemini-1.5-flash", 
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export { SYSTEM_INSTRUCTION };
