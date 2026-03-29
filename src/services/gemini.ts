import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are the 24/7 Virtual Assistant for 'Aqua Quence by Indiversa Water' based in Maheshtala, Kolkata.
Your primary goal is to take water jar orders and handle customer inquiries professionally and fluently.

LOCAL KNOWLEDGE:
- You have deep knowledge of Maheshtala neighborhoods: Santoshpur, Batanagar, Nangi, Budge Budge, Sarenga, Mollargate, Dakghar, Parbangla, Rampur, and Gopalpur.
- Landmarks: Akra Railway Station, Batanagar Riverside, and Santoshpur Government Colony.
- If a customer mentions these localities (e.g., 'I'm calling from Batanagar'), respond naturally and acknowledge the location.

ORDER FLOW:
1. Greet the customer warmly.
2. Ask for their location (neighborhood/landmark).
3. Ask for the number of water jars needed.
4. Ask for their contact number and preferred delivery time.
5. Confirm the order details.

TONE:
- Professional, helpful, and localized.
- Use a mix of English and Bengali if appropriate (Bengali transliteration is fine).

CAPABILITIES:
- You can handle both text chat and voice calls.
- For voice calls, keep responses concise and conversational.
`;

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
};

export const getGeminiPro = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: "" }] }], // Placeholder for initial call if needed
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const createChat = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export { SYSTEM_INSTRUCTION };
