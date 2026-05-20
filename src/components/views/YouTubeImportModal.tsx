import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, Loader2, X } from 'lucide-react';
import { fetchPlaylist } from '../../lib/youtube';

export type YoutubeImportMode = 'flat' | 'new_section';

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

  // Reset on open
  useEffect(() => {
    if (isOpen) { setUrl(''); setMode('new_section'); setError(''); setLoading(false); }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, loading]);

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
      setError(err.message || 'Failed to fetch playlist. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => !loading && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
          className="w-full max-w-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl overflow-hidden flex flex-col p-6 relative"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onClose} disabled={loading} className="absolute top-4 right-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] p-1 rounded-md disabled:opacity-50"><X size={18} /></button>

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
              className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm focus:border-red-500 outline-none text-[hsl(var(--foreground))]"
              autoFocus
              disabled={loading}
              onKeyDown={e => { if (e.key === 'Enter') handleFetchAndImport(); }}
            />

            {error && (
              <div className="text-red-500 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-xl p-3 whitespace-pre-line">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Import Mode</label>

              <div
                onClick={() => setMode('new_section')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors flex items-center gap-3 ${mode === 'new_section' ? 'border-red-500 bg-red-500/10' : 'border-transparent bg-[hsl(var(--background))] hover:border-[hsl(var(--border))]'}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === 'new_section' ? 'border-red-500' : 'border-[hsl(var(--muted-foreground))]'}`}>
                  {mode === 'new_section' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <span className="text-sm font-medium text-[hsl(var(--foreground))]">Create new Section from Playlist Title</span>
              </div>

              <div
                onClick={() => setMode('flat')}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-colors flex items-center gap-3 ${mode === 'flat' ? 'border-red-500 bg-red-500/10' : 'border-transparent bg-[hsl(var(--background))] hover:border-[hsl(var(--border))]'}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${mode === 'flat' ? 'border-red-500' : 'border-[hsl(var(--muted-foreground))]'}`}>
                  {mode === 'flat' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <span className="text-sm font-medium text-[hsl(var(--foreground))]">Import as flat standalone tasks</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl hover:bg-[hsl(var(--muted))] text-sm font-medium transition-colors text-[hsl(var(--foreground))] disabled:opacity-50">Cancel</button>
            <button
              onClick={handleFetchAndImport}
              disabled={!url.trim() || loading}
              className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Fetching...' : 'Import'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
