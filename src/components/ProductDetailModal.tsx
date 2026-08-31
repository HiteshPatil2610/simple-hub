import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAffiliateClick: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAffiliateClick,
}) => {
  const [copied, setCopied] = useState(false);

  const redirectUrl = product
    ? api.getRedirectUrl(product.id, {
        utm_source: 'raccoonhub_modal',
        utm_medium: 'quick_view',
        utm_campaign: 'amazon_finds',
      })
    : '';

  const fullTrackingUrl =
    typeof window !== 'undefined' && product
      ? `${window.location.origin}${redirectUrl}`
      : redirectUrl;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullTrackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {product && (
        <div
          id="product-detail-modal"
          data-testid="quick-view-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#111111]/75 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative bg-[var(--card)] rounded-[1.5rem] max-w-2xl w-full max-h-[92vh] overflow-y-auto border-3 border-[#111111] shadow-[8px_8px_0px_0px_#111111] z-10 my-auto text-[var(--foreground)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button in yellow box */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              id="close-detail-modal-btn"
              data-testid="quick-view-close-button"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FFE600] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_0px_#111111] flex items-center justify-center transition hover:bg-[#ffea2e]"
            >
              <X className="w-5 h-5 stroke-[3]" />
            </motion.button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7 p-5 sm:p-7">
              {/* Image */}
              <div className="flex flex-col gap-3">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-white border-2 border-[#111111] shadow-[4px_4px_0px_0px_#111111]">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
              </div>

              {/* Details & CTA */}
              <div className="flex flex-col justify-between">
                <div>
                  {/* Category Badge */}
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-black text-[#111111] uppercase tracking-wider text-[10px] bg-[#FFE600] px-3 py-1 rounded-full border-2 border-[#111111] shadow-[2px_2px_0px_0px_#111111]">
                      {product.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[var(--foreground)] leading-tight">
                    {product.title}
                  </h2>

                  {/* Description */}
                  <div className="text-[var(--muted-text)] text-xs sm:text-sm leading-relaxed my-3 font-medium">
                    <p>{product.description}</p>
                  </div>
                </div>

                {/* Action CTA & Link */}
                <div className="space-y-3 pt-3 border-t-2 border-[var(--border)]/15">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    id="modal-buy-now-btn"
                    data-testid="amazon-link-button"
                    onClick={() => {
                      onAffiliateClick(product);
                      onClose();
                    }}
                    className="w-full min-h-[46px] py-3 px-5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 border-2 border-[#111111] shadow-[4px_4px_0px_0px_#111111] active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#111111] bg-[#111111] hover:bg-[#222222] text-white transition"
                  >
                    <span>peek on Amazon</span>
                    <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                  </motion.button>

                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-[var(--muted-text)]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#4ECDC4]" />
                    <span>secure outbound link</span>
                  </div>

                  {/* Direct link copy */}
                  <div className="p-3 bg-[var(--muted)] rounded-xl border-2 border-[var(--border)] text-xs shadow-[2px_2px_0px_0px_var(--border)]">
                    <div className="flex items-center justify-between text-[var(--foreground)] mb-1 font-black text-[10px] uppercase tracking-wider">
                      <span>Amazon Direct Link</span>
                      <button
                        id="copy-tracking-link-btn"
                        onClick={handleCopyLink}
                        className="flex items-center gap-1 text-[#FF6B6B] hover:underline font-black"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 stroke-[2.5]" /> Copy Link
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-[10px] text-[var(--foreground)] font-bold truncate bg-[var(--card)] p-1.5 rounded-lg border border-[var(--border)]">
                      {fullTrackingUrl}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

