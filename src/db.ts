import Dexie, { type EntityTable } from 'dexie';

export interface Message {
  id?: number;
  sessionId: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  type: 'text' | 'voice';
  mediaUrl?: string;
  mediaType?: string;
}

export interface Session {
  id: string;
  startTime: number;
  lastUpdateTime: number;
  transcript: string;
  status: 'active' | 'completed';
}

const db = new Dexie('AquaQuenceDB') as Dexie & {
  messages: EntityTable<Message, 'id'>;
  sessions: EntityTable<Session, 'id'>;
};

// Schema definition
db.version(1).stores({
  messages: '++id, sessionId, timestamp, type',
  sessions: 'id, startTime, lastUpdateTime, status'
});

export { db };
