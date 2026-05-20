import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, Loader2 } from 'lucide-react';
import { fetchPlaylist } from '../../lib/youtube';

export type YoutubeImportMode = 'flat' | 'new_section'; // 'existing_section' omitted for simplicity in global import, better handled by dragging

interface YouTubeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (playlist: any, mode: YoutubeImportMode) => void;
}

export function YouTubeImportModal({ isOpen, onClose, onImport }: YouTubeImportModalProps) {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<YoutubeImportMode>('new_section');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFetchAndImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    
    try {
      const playlist = await fetchPlaylist(url);
      onImport(playlist, mode);
      setUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch playlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden flex flex-col p-6">
          <div className="flex items-center gap-2 mb-2 text-red-500">
             <Youtube size={24} />
             <h2 className="text-xl font-semibold">Import YouTube Playlist</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">Fetch videos from a YouTube playlist and automatically generate tasks for each video.</p>
          
          <div className="flex flex-col gap-4 mb-6">
            <input 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="Paste YouTube Playlist URL (https://www.youtube.com/playlist?list=...)"
              className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm focus:border-red-500 outline-none"
              autoFocus
            />

            {error && <div className="text-red-500 text-sm font-medium">{error}</div>}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Import Mode</label>
              
              <div 
                onClick={() => setMode('new_section')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors flex items-center gap-3 ${mode === 'new_section' ? 'border-red-500 bg-red-500/10 text-[hsl(var(--foreground))]' : 'border-transparent bg-[hsl(var(--background))] hover:border-[hsl(var(--border))]'}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === 'new_section' ? 'border-red-500' : 'border-[hsl(var(--muted-foreground))]'}`}>
                  {mode === 'new_section' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <span className="text-sm font-medium text-inherit">Create new Section from Playlist Title</span>
              </div>
              
              <div 
                onClick={() => setMode('flat')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors flex items-center gap-3 ${mode === 'flat' ? 'border-red-500 bg-red-500/10 text-[hsl(var(--foreground))]' : 'border-transparent bg-[hsl(var(--background))] hover:border-[hsl(var(--border))]'}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === 'flat' ? 'border-red-500' : 'border-[hsl(var(--muted-foreground))]'}`}>
                  {mode === 'flat' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <span className="text-sm font-medium text-inherit">Import as flat standalone tasks</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium transition-colors">Cancel</button>
            <button 
              onClick={handleFetchAndImport} 
              disabled={!url.trim() || loading}
              className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Import
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
