import React from 'react';
import { Info as InfoIcon } from 'lucide-react';

export const Info: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const pricing = [
    { name: '20L Water Refill', price: '20rs' },
    { name: '20L Normal White Jar (Empty)', price: '180rs' },
    { name: '20L Colour Jar (Empty)', price: '200rs' },
    { name: 'Water Dispenser', price: '140rs' },
    { name: 'Manual Hand Pump', price: '160rs' },
  ];

  return (
    <div className="w-full max-w-sm p-8">
      <div className="flex items-center gap-3 mb-8">
        <InfoIcon className="text-blue-500" size={24} />
        <h2 className="text-2xl font-semibold text-white">Pricing Information</h2>
      </div>
      <div className="space-y-4">
        {pricing.map((item, i) => (
          <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-white/80">{item.name}</span>
            <span className="text-blue-400 font-bold">{item.price}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="w-full mt-8 py-3 rounded-xl bg-blue-600 text-white font-bold">Back</button>
    </div>
  );
};
