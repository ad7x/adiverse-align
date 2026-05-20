import React from 'react';
import { motion } from 'framer-motion';

export function CustomIcon({ collapsed }: { collapsed?: boolean }) {
  return (
    <motion.div
      className="relative flex flex-col justify-between items-center w-6 h-[18px] hover:opacity-100 opacity-80 transition-all cursor-pointer group"
    >
      <motion.div className="w-[14px] h-[2px] bg-white rounded-full self-start group-hover:shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-shadow" />
      <motion.div className="w-[20px] h-[2px] bg-white rounded-full group-hover:shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-shadow" />
      <motion.div className="w-[14px] h-[2px] bg-white rounded-full self-end group-hover:shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-shadow" />
    </motion.div>
  );
}
