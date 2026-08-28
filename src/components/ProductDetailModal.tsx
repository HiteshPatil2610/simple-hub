import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, ArrowUpRight } from 'lucide-react';
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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#2D3436]/70 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative bg-[#FFFBF0] rounded-[2.2rem] max-w-2xl w-full max-h-[92vh] overflow-y-auto border-4 border-[#2D3436] shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] z-10 my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              id="close-detail-modal-btn"
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#FF6B6B] hover:bg-[#ff5252] text-white border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] flex items-center justify-center transition"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </motion.button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7 p-5 sm:p-7">
              {/* Image */}
              <div className="flex flex-col gap-3">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border-3 border-[#2D3436] shadow-[4px_4px_0px_0px_rgba(45,52,54,1)]">
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
                  {/* Category */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-black text-[#FF6B6B] uppercase tracking-wider text-[11px]">
                      {product.category}
                    </span>
                    <span className="text-[10px] font-black uppercase text-[#2D3436] bg-[#FFE66D] px-2 py-0.5 rounded-md border-2 border-[#2D3436]">
                      Amazon Find
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg sm:text-xl font-black text-[#2D3436] leading-snug">
                    {product.title}
                  </h2>

                  {/* Small Description */}
                  <div className="text-[#2D3436]/80 text-xs sm:text-sm leading-relaxed my-3 font-semibold">
                    <p>{product.description}</p>
                  </div>
                </div>

                {/* Action CTA & Link */}
                <div className="space-y-3 pt-3 border-t-2 border-[#2D3436]/10">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    id="modal-buy-now-btn"
                    onClick={() => {
                      onAffiliateClick(product);
                      onClose();
                    }}
                    className="w-full min-h-[46px] py-3 px-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 border-3 border-[#2D3436] shadow-[4px_4px_0px_0px_rgba(45,52,54,1)] bg-[#FFE66D] hover:bg-[#FFD93D] text-[#2D3436] transition"
                  >
                    <span>View on Amazon</span>
                    <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                  </motion.button>

                  {/* Affiliate link copy */}
                  <div className="p-3 bg-white rounded-2xl border-2 border-[#2D3436] text-xs shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                    <div className="flex items-center justify-between text-[#2D3436] mb-1 font-black text-[10px] uppercase">
                      <span>Amazon Direct Link</span>
                      <button
                        id="copy-tracking-link-btn"
                        onClick={handleCopyLink}
                        className="flex items-center gap-1 text-[#FF6B6B] hover:text-[#2D3436] font-black"
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
                    <div className="font-mono text-[10px] text-[#2D3436] font-bold truncate bg-[#FFFBF0] p-1.5 rounded-lg border border-[#2D3436]">
                      {fullTrackingUrl}
                    </div>
                  </div>

                  {/* FTC Affiliate Disclaimer */}
                  <p className="text-[10px] text-[#2D3436]/60 text-center font-bold leading-normal">
                    As an Amazon Associate, Raccoon Hub earns from qualifying purchases.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
