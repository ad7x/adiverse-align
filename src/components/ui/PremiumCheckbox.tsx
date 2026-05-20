import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Variant = 'modern' | 'circle-glow' | 'neon' | 'minimal' | 'gradient';

interface PremiumCheckboxProps {
  checked: boolean;
  onChange: () => void;
  variant?: Variant;
  size?: number;
  disabled?: boolean;
}

const variantStyles: Record<Variant, {
  shape: string;
  border: string;
  bg: string;
  checkedBg: string;
  glow: string;
  glowShape: string;
}> = {
  modern: {
    shape: 'rounded-[8px]',
    border: 'border-[hsl(var(--foreground)/0.15)] hover:border-[hsl(var(--foreground)/0.3)]',
    bg: 'bg-[hsl(var(--muted)/0.3)]',
    checkedBg: 'bg-[hsl(var(--primary))]',
    glow: 'hsl(var(--primary))',
    glowShape: 'rounded-[8px]',
  },
  'circle-glow': {
    shape: 'rounded-full',
    border: 'border-[hsl(var(--primary)/0.45)] hover:border-[hsl(var(--primary)/0.7)]',
    bg: 'bg-transparent',
    checkedBg: 'bg-[hsl(var(--primary))]',
    glow: 'hsl(var(--primary))',
    glowShape: 'rounded-full',
  },
  neon: {
    shape: 'rounded-lg',
    border: 'border-[hsl(var(--primary)/0.6)] hover:border-[hsl(var(--primary)/0.8)]',
    bg: 'bg-[hsl(var(--primary)/0.05)]',
    checkedBg: 'bg-[hsl(var(--primary)/0.95)]',
    glow: 'hsl(var(--primary))',
    glowShape: 'rounded-lg',
  },
  minimal: {
    shape: 'rounded-md',
    border: 'border-[hsl(var(--foreground)/0.25)] hover:border-[hsl(var(--foreground)/0.45)]',
    bg: 'bg-transparent',
    checkedBg: 'bg-[hsl(var(--foreground)/0.9)]',
    glow: 'hsl(var(--foreground))',
    glowShape: 'rounded-md',
  },
  gradient: {
    shape: 'rounded-xl',
    border: 'border-[hsl(var(--primary)/0.45)] hover:border-[hsl(var(--primary)/0.75)]',
    bg: 'bg-[hsl(var(--muted)/0.2)]',
    checkedBg: 'bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)]',
    glow: 'hsl(var(--primary))',
    glowShape: 'rounded-xl',
  },
};

export function PremiumCheckbox({
  checked,
  onChange,
  variant = 'modern',
  size = 30,
  disabled = false,
}: PremiumCheckboxProps) {
  const prevChecked = useRef(checked);
  const [showRipple, setShowRipple] = useState(false);
  const style = variantStyles[variant] || variantStyles.modern;

  // Only trigger ripple on false→true transition
  useEffect(() => {
    if (checked && !prevChecked.current) {
      setShowRipple(true);
      const timer = setTimeout(() => setShowRipple(false), 500);
      prevChecked.current = checked;
      return () => clearTimeout(timer);
    }
    prevChecked.current = checked;
  }, [checked]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange();
    }
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Glow halo */}
      <AnimatePresence>
        {checked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-0 ${style.glowShape} pointer-events-none`}
            style={{ boxShadow: `0 0 6px ${style.glow}`, opacity: 0.08 }}
          />
        )}
      </AnimatePresence>

      {/* Ripple effect */}
      <AnimatePresence>
        {showRipple && (
          <motion.div
            initial={{ opacity: 0.4, scale: 0.5 }}
            animate={{ opacity: 0, scale: 1.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={`absolute inset-0 ${style.glowShape} pointer-events-none`}
            style={{ border: `1.5px solid ${style.glow}` }}
          />
        )}
      </AnimatePresence>

      {/* Checkbox container */}
      <motion.div
        role="checkbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onChange()}
        onKeyDown={handleKeyDown}
        whileHover={disabled ? {} : { scale: 1.1 }}
        whileTap={disabled ? {} : { scale: 0.9 }}
        animate={checked ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={{ duration: 0.25 }}
        className={`
          relative flex items-center justify-center cursor-pointer select-none
          border-2 transition-colors duration-200 outline-none
          focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2
          focus-visible:ring-offset-[hsl(var(--background))]
          ${style.shape}
          ${checked ? style.checkedBg : style.bg}
          ${checked ? (variant === 'minimal' ? 'border-[hsl(var(--foreground))]' : 'border-[hsl(var(--primary))]') : style.border}
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
        style={{ width: size, height: size }}
      >
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
                transition={{ duration: 0.3, delay: 0.05 }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
