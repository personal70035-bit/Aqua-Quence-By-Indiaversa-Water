import { db } from "../db";

// This is the Google Sheets Web App URL.
// The user will need to provide this in their environment variables.
const GOOGLE_SHEETS_WEB_APP_URL = import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL || process.env.VITE_GOOGLE_SHEETS_WEB_APP_URL || "";

export interface SyncData {
  sessionId: string;
  timestamp: number;
  transcript: string;
  lastMessage: string;
  status: string;
  type: 'text' | 'voice';
}

/**
 * Syncs the current session data to Google Sheets.
 * This should be called every time the AI finishes a response.
 */
export const syncToGoogleSheets = async (sessionId: string) => {
  if (!GOOGLE_SHEETS_WEB_APP_URL) {
    console.warn("Google Sheets Web App URL is not configured. Sync skipped.");
    return;
  }

  try {
    // Fetch all messages for this session from Dexie.js
    const messages = await db.messages.where('sessionId').equals(sessionId).sortBy('timestamp');
    
    if (messages.length === 0) return;

    const transcript = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const lastMessage = messages[messages.length - 1].content;
    const type = messages[0].type; // Use the type of the first message in the session

    const data: SyncData = {
      sessionId,
      timestamp: Date.now(),
      transcript,
      lastMessage,
      status: 'active',
      type
    };

    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors', // Google Apps Script often requires no-cors for simple POSTs
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    console.log(`Synced session ${sessionId} to Google Sheets.`);
  } catch (error) {
    console.error("Failed to sync to Google Sheets:", error);
  }
};
