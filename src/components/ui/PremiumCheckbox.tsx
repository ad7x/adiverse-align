import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';

type Variant = 'modern' | 'circle-glow' | 'neon' | 'minimal' | 'gradient';

interface PremiumCheckboxProps {
  checked: boolean;
  onChange: () => void;
  variant?: Variant;
  size?: number;
  disabled?: boolean;
}

interface Sparkle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

const variantStyles: Record<Variant, {
  shape: string;
  border: string;
  bg: string;
  checkedBg: string;
  color: string;
}> = {
  modern: {
    shape: 'rounded-[8px]',
    border: 'border-[hsl(var(--foreground)/0.15)] hover:border-[hsl(var(--foreground)/0.3)]',
    bg: 'bg-[hsl(var(--muted)/0.3)]',
    checkedBg: 'bg-[hsl(var(--primary))]',
    color: 'hsl(var(--primary))',
  },
  'circle-glow': {
    shape: 'rounded-full',
    border: 'border-[hsl(var(--primary)/0.45)] hover:border-[hsl(var(--primary)/0.75)]',
    bg: 'bg-transparent',
    checkedBg: 'bg-[hsl(var(--primary))]',
    color: 'hsl(var(--primary))',
  },
  neon: {
    shape: 'rounded-lg',
    border: 'border-[hsl(var(--primary)/0.6)] hover:border-[hsl(var(--primary)/0.8)]',
    bg: 'bg-[hsl(var(--primary)/0.05)]',
    checkedBg: 'bg-[hsl(var(--primary)/0.95)]',
    color: 'hsl(var(--primary))',
  },
  minimal: {
    shape: 'rounded-md',
    border: 'border-[hsl(var(--foreground)/0.25)] hover:border-[hsl(var(--foreground)/0.45)]',
    bg: 'bg-transparent',
    checkedBg: 'bg-[hsl(var(--foreground)/0.9)]',
    color: 'hsl(var(--foreground))',
  },
  gradient: {
    shape: 'rounded-xl',
    border: 'border-[hsl(var(--primary)/0.45)] hover:border-[hsl(var(--primary)/0.75)]',
    bg: 'bg-[hsl(var(--muted)/0.2)]',
    checkedBg: 'bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)]',
    color: 'hsl(var(--primary))',
  },
};

const playRewardSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // 1. Mechanical snap transient for tactile feel
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1200, now);
    snapOsc.frequency.exponentialRampToValueAtTime(150, now + 0.02);
    snapGain.gain.setValueAtTime(0.08, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.03);

    // 2. Main warm ambient chime: major 9th chord (C5, E5, G5, B5, D6)
    // Delay each note slightly (35ms) for an arpeggiated, harp-like cascade
    const freqs = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5, E5, G5, B5, D6
    const delayStep = 0.035;

    // Echo/reverb bus
    const delayNode = ctx.createDelay();
    delayNode.delayTime.setValueAtTime(0.12, now);
    const feedbackNode = ctx.createGain();
    feedbackNode.gain.setValueAtTime(0.3, now); // soft feedback echo
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);

    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode);
    delayNode.connect(filter);
    filter.connect(ctx.destination);

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Soft mix of sine and triangle for premium round tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * delayStep);
      
      const start = now + i * delayStep;
      const duration = 0.5 - (i * 0.04); // high notes end faster
      
      gainNode.gain.setValueAtTime(0.0, start);
      // Soft attack
      gainNode.gain.linearRampToValueAtTime(0.12, start + 0.015);
      // Exponential decay
      gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gainNode);
      // Connect to direct out and delay out
      gainNode.connect(ctx.destination);
      gainNode.connect(delayNode);

      osc.start(start);
      osc.stop(start + duration + 0.1);
    });
  } catch (err) {
    console.warn('Failed to play reward sound:', err);
  }
};

export function PremiumCheckbox({
  checked,
  onChange,
  variant = 'modern',
  size = 30,
  disabled = false,
}: PremiumCheckboxProps) {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const soundEnabled = settings?.soundEnabled ?? true;
  const celebrationEnabled = settings?.celebrationEnabled ?? true;

  const prevChecked = useRef(checked);
  const [showRipple, setShowRipple] = useState(false);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const style = variantStyles[variant] || variantStyles.modern;

  // Trigger sound & sparkles ONLY on false -> true transitions
  useEffect(() => {
    if (checked && !prevChecked.current) {
      if (celebrationEnabled) {
        setShowRipple(true);
        const rippleTimer = setTimeout(() => setShowRipple(false), 500);

        // Subtle, elegant sparkles burst (4 symmetric starlets)
        const newSparkles = [
          { id: Math.random(), angle: 45, distance: size * 0.5 + 8, size: 4, color: 'hsl(45, 100%, 60%)' },
          { id: Math.random(), angle: 135, distance: size * 0.5 + 8, size: 3.5, color: 'hsl(45, 100%, 60%)' },
          { id: Math.random(), angle: 225, distance: size * 0.5 + 8, size: 4, color: 'hsl(45, 100%, 60%)' },
          { id: Math.random(), angle: 315, distance: size * 0.5 + 8, size: 3.5, color: 'hsl(45, 100%, 60%)' },
        ];
        setSparkles(newSparkles);
        const sparkleTimer = setTimeout(() => setSparkles([]), 600);

        prevChecked.current = checked;
        return () => {
          clearTimeout(rippleTimer);
          clearTimeout(sparkleTimer);
        };
      } else {
        prevChecked.current = checked;
      }

      if (soundEnabled) {
        // Play achievement chime sound
        playRewardSound();
      }
    }
    prevChecked.current = checked;
  }, [checked, size, style.color, soundEnabled, celebrationEnabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) onChange();
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center premium-checkbox select-none" 
      style={{ width: size, height: size }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Ripple wave effect */}
      <AnimatePresence>
        {showRipple && celebrationEnabled && (
          <motion.div
            initial={{ opacity: 0.5, scale: 0.5 }}
            animate={{ opacity: 0, scale: 1.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className={`absolute inset-0 ${style.shape} pointer-events-none`}
            style={{ border: `1.5px solid ${style.color}` }}
          />
        )}
      </AnimatePresence>

      {/* Starlet sparkles burst */}
      {sparkles.map(sp => {
        const rad = (sp.angle * Math.PI) / 180;
        const x = Math.cos(rad) * sp.distance;
        const y = Math.sin(rad) * sp.distance;
        return (
          <motion.div
            key={sp.id}
            className="absolute pointer-events-none rotate-45"
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ x, y, scale: [0, 1.2, 0.5, 0], opacity: [1, 1, 0.4, 0] }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{
              width: sp.size,
              height: sp.size,
              backgroundColor: sp.color,
              zIndex: 10,
            }}
          />
        );
      })}

      {/* Checkbox container */}
      <motion.div
        role="checkbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange();
        }}
        onKeyDown={handleKeyDown}
        whileHover={disabled ? {} : { scale: 1.06 }}
        whileTap={disabled ? {} : { scale: 0.94 }}
        animate={checked ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`
          relative flex items-center justify-center cursor-pointer select-none
          border-2 transition-colors duration-200 outline-none overflow-hidden
          focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2
          focus-visible:ring-offset-[hsl(var(--background))]
          ${style.shape}
          ${checked ? style.checkedBg : style.bg}
          ${checked ? (variant === 'minimal' ? 'border-[hsl(var(--foreground))]' : 'border-[hsl(var(--primary))]') : style.border}
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
        style={{ width: size, height: size }}
      >
        {/* Animated sheen sweep on checked */}
        {checked && celebrationEnabled && (
          <motion.div
            initial={{ left: '-100%', opacity: 0.5 }}
            animate={{ left: '100%', opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeInOut' }}
            className="absolute top-0 bottom-0 w-full bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none skew-x-12 z-0"
          />
        )}

        {/* Animated checkmark */}
        <AnimatePresence>
          {checked && (
            <motion.svg
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              viewBox="0 0 24 24"
              fill="none"
              className="z-10"
              style={{ width: size * 0.55, height: size * 0.55 }}
            >
              <motion.path
                d="M5 13l4 4L19 7"
                stroke={variant === 'minimal' ? 'hsl(var(--background))' : 'white'}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25, delay: 0.04 }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
