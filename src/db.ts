import Dexie, { Table } from 'dexie';

export interface Message {
  id?: number;
  sessionId: string;
  mode: 'voice' | 'chat';
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  type: 'text' | 'audio';
}

export interface Media {
  id?: number;
  sessionId: string;
  type: string;
  timestamp: number;
}

export class AquaQuenceDB extends Dexie {
  messages!: Table<Message>;
  media!: Table<Media>;

  constructor() {
    super('AquaQuenceDB');
    this.version(1).stores({
      messages: '++id, sessionId, role, timestamp',
      media: '++id, sessionId, type, timestamp'
    });
    this.version(2).stores({
      messages: '++id, sessionId, mode, role, timestamp',
      media: '++id, sessionId, type, timestamp'
    });
  }
}

export const db = new AquaQuenceDB();
