import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, CheckCircle, ShieldCheck, X } from 'lucide-react';
import { Product } from '../types';

interface RedirectNotificationProps {
  product: Product | null;
  onClose: () => void;
}

export const RedirectNotification: React.FC<RedirectNotificationProps> = ({ product, onClose }) => {
  useEffect(() => {
    if (!product) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [product, onClose]);

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          id="redirect-toast"
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 max-w-sm bg-[#FFFBF0] text-[#2D3436] rounded-2xl p-3.5 sm:p-4 shadow-[6px_6px_0px_0px_rgba(45,52,54,1)] border-3 border-[#2D3436]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4ECDC4] text-[#2D3436] flex items-center justify-center shrink-0 border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                <CheckCircle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#2D3436] uppercase">
                  <span>Redirect Verified</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B6B] stroke-[2.5]" />
                </div>
                <div className="text-xs font-bold text-[#2D3436]/85 line-clamp-1 mt-0.5">
                  Opening Amazon in new tab...
                </div>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="text-[#2D3436] hover:text-[#FF6B6B] transition p-1"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </motion.button>
          </div>

          <div className="mt-2 pt-2 border-t-2 border-[#2D3436]/10 flex items-center justify-between text-[10px] font-bold text-[#2D3436]/70">
            <span className="truncate max-w-[190px]">
              Direct Amazon Associate Link
            </span>
            <span className="text-[#2D3436] font-black uppercase flex items-center gap-1">
              New Tab <ExternalLink className="w-3 h-3 stroke-[2.5]" />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
