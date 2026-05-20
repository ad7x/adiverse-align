import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';

export function OnboardingModal() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const [name, setName] = useState('');

  if (settings === undefined) return null;
  if (settings?.hasCompletedOnboarding) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await db.settings.update('settings', { 
      userName: name.trim(), 
      hasCompletedOnboarding: true 
    });
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="flex justify-center mb-8">
            <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" className="w-12 h-12" alt="Aurora Logo" />
          </div>
          <h1 className="text-3xl font-semibold text-center text-white mb-8 tracking-tight">What should we call you?</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input 
              autoFocus
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="Your name..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xl text-white outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all text-center placeholder:text-zinc-600"
            />
            <button 
              type="submit"
              disabled={!name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-4 rounded-2xl transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
            >
              Continue
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
