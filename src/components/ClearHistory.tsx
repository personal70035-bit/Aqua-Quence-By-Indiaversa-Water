import React from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '../db';

export const ClearHistory: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const clearAllHistory = async () => {
    try {
      await db.delete();
      window.location.reload();
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  return (
    <div className="w-full max-w-sm p-8 text-center">
      <Trash2 className="mx-auto text-red-500 mb-6" size={48} />
      <h2 className="text-2xl font-semibold text-white mb-4">Clear All History</h2>
      <p className="text-white/60 mb-8">This action cannot be undone. All your chat and call history will be permanently deleted.</p>
      <div className="flex gap-4">
        <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white">Cancel</button>
        <button onClick={clearAllHistory} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">Delete All</button>
      </div>
    </div>
  );
};
