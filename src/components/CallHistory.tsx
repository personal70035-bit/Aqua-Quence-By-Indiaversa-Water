import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Clock } from 'lucide-react';

export const CallHistory: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const history = useLiveQuery(() => 
    db.messages.orderBy('timestamp').reverse().toArray()
  );

  return (
    <div className="w-full max-w-2xl p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-500" size={24} />
          <h2 className="text-2xl font-semibold text-white">History</h2>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white">Back</button>
      </div>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {history?.length === 0 && <p className="text-white/40 text-center">No history found.</p>}
        {history?.map((msg, i) => (
          <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/60 text-xs">{new Date(msg.timestamp).toLocaleString()}</p>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${msg.mode === 'voice' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                {msg.mode}
              </span>
            </div>
            <p className="text-white text-sm">{msg.content?.substring(0, 100)}{msg.content?.length > 100 ? '...' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
