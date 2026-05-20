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
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
          className="max-w-md w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-8 rounded-[32px] shadow-2xl"
        >
          <div className="flex justify-center mb-8">
            <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" className="w-12 h-12" alt="Aurora Logo" />
          </div>
          <h1 className="text-3xl font-semibold text-center text-[hsl(var(--foreground))] mb-8 tracking-tight">What should we call you?</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input 
              autoFocus
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="Your name..."
              className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl px-6 py-4 text-xl text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))] transition-all text-center placeholder:text-[hsl(var(--muted-foreground))]"
            />
            <button 
              type="submit"
              disabled={!name.trim()}
              className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] font-medium py-4 rounded-2xl transition-colors disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
