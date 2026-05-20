import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type CloneOption = 
  | 'completion'
  | 'completion_notes'
  | 'completion_descriptions'
  | 'completion_notes_descriptions_tags'
  | 'empty_fresh';

interface SmartCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, option: CloneOption) => void;
}

export function SmartCloneModal({ isOpen, onClose, onConfirm }: SmartCloneModalProps) {
  const [name, setName] = useState('');
  const [selectedOption, setSelectedOption] = useState<CloneOption>('completion');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden flex flex-col p-6">
          <h2 className="text-xl font-semibold mb-2">Create New Instance</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">What should be reset for this new instance? Structure is always preserved unless 'Fresh Empty' is selected.</p>
          
          <div className="flex flex-col gap-4 mb-6">
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Instance Name (e.g., Mock Prep)"
              className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm focus:border-[hsl(var(--primary))] outline-none"
              autoFocus
            />

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Reset Options</label>
              
              <OptionRow 
                title="Reset completion only"
                selected={selectedOption === 'completion'}
                onClick={() => setSelectedOption('completion')}
              />
              <OptionRow 
                title="Reset completion + notes"
                selected={selectedOption === 'completion_notes'}
                onClick={() => setSelectedOption('completion_notes')}
              />
              <OptionRow 
                title="Reset completion + descriptions"
                selected={selectedOption === 'completion_descriptions'}
                onClick={() => setSelectedOption('completion_descriptions')}
              />
              <OptionRow 
                title="Reset completion + notes + descriptions + tags"
                selected={selectedOption === 'completion_notes_descriptions_tags'}
                onClick={() => setSelectedOption('completion_notes_descriptions_tags')}
              />
              
              <div className="h-px bg-[hsl(var(--border))] my-2" />
              
              <OptionRow 
                title="Create fully empty fresh instance"
                selected={selectedOption === 'empty_fresh'}
                onClick={() => setSelectedOption('empty_fresh')}
                danger
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium transition-colors">Cancel</button>
            <button 
              onClick={() => {
                if (name.trim()) onConfirm(name.trim(), selectedOption);
              }} 
              disabled={!name.trim()}
              className="px-5 py-2 rounded-xl bg-[hsl(var(--primary))] text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              Create Instance
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function OptionRow({ title, selected, onClick, danger }: { title: string, selected: boolean, onClick: () => void, danger?: boolean }) {
  return (
    <div 
      onClick={onClick}
      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors flex items-center gap-3 ${
        selected 
          ? (danger ? 'border-red-500 bg-red-500/10' : 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]') 
          : 'border-transparent bg-[hsl(var(--background))] hover:border-[hsl(var(--border))]'
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? (danger ? 'border-red-500' : 'border-[hsl(var(--primary))]') : 'border-[hsl(var(--muted-foreground))]'}`}>
        {selected && <div className={`w-2 h-2 rounded-full ${danger ? 'bg-red-500' : 'bg-[hsl(var(--primary))]'}`} />}
      </div>
      <span className={`text-sm font-medium ${danger && selected ? 'text-red-500' : 'text-[hsl(var(--foreground))]'}`}>{title}</span>
    </div>
  );
}
