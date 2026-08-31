import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, CheckCircle2, Eye } from 'lucide-react';
import { Product } from '../types';

export type BentoVariant = 'hero' | 'wide' | 'tall' | 'standard';

interface ProductCardProps {
  product: Product;
  onAffiliateClick: (product: Product) => void;
  onQuickView?: (product: Product) => void;
  index?: number;
  bentoVariant?: BentoVariant;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAffiliateClick,
  onQuickView,
  index = 0,
  bentoVariant = 'standard',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [clickedRecently, setClickedRecently] = useState(false);

  const handleCardClick = () => {
    setClickedRecently(true);
    setTimeout(() => setClickedRecently(false), 2000);
    onAffiliateClick(product);
  };

  // Grid spans for Bento Grid layout
  const getBentoSpanClasses = () => {
    switch (bentoVariant) {
      case 'hero':
        return 'col-span-1 sm:col-span-2 md:col-span-2 row-span-2';
      case 'wide':
        return 'col-span-1 sm:col-span-2 md:col-span-2 row-span-1';
      case 'tall':
        return 'col-span-1 row-span-2';
      case 'standard':
      default:
        return 'col-span-1 row-span-1';
    }
  };

  // Image aspect ratio tailored to Bento tile dimensions
  const getImageAspectClass = () => {
    switch (bentoVariant) {
      case 'hero':
        return 'aspect-[16/10] max-h-80';
      case 'wide':
        return 'aspect-video max-h-52';
      case 'tall':
        return 'aspect-[3/4] max-h-80';
      case 'standard':
      default:
        return 'aspect-square max-h-60';
    }
  };

  const isHero = bentoVariant === 'hero' || product.featured;

  return (
    <motion.div
      layout
      layoutId={`product-card-${product.id}`}
      id={`product-card-${product.id}`}
      data-testid={`product-card-${product.id}`}
      onClick={handleCardClick}
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 10 }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 25,
        mass: 0.8,
        delay: Math.min(index * 0.03, 0.25),
      }}
      whileHover={{ y: -6, scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative border-2 border-[#111111] rounded-[1.25rem] p-4 sm:p-5 flex flex-col justify-between shadow-[4px_4px_0px_0px_var(--border)] hover:shadow-[7px_7px_0px_0px_var(--border)] transition-all duration-300 ease-out cursor-pointer ${
        isHero
          ? 'bg-[#FF6B6B] text-[#111111]'
          : 'bg-[var(--card)] text-[var(--foreground)]'
      } ${getBentoSpanClasses()}`}
    >
      {product.featured && (
        <span className="absolute top-3 left-3 z-10 px-2.5 py-1 bg-[#111111] text-[#FFE600] text-[9px] font-black uppercase tracking-wider rounded-full border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(17,17,17,1)] -rotate-2">
          EDITOR'S PICK
        </span>
      )}

      <div className="flex flex-col h-full justify-between">
        <div>
          {/* Product Image */}
          <div
            className={`relative w-full ${getImageAspectClass()} bg-[#FFE600]/10 rounded-xl border-2 border-[#111111] mb-3.5 sm:mb-4 overflow-hidden`}
          >
            {!imageLoaded && (
              <div className="absolute inset-0 bg-[var(--muted)] animate-pulse flex items-center justify-center text-[var(--foreground)] text-xs font-bold">
                Loading...
              </div>
            )}
            <img
              src={product.imageUrl}
              alt={product.title}
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              className={`w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80';
              }}
            />
            {onQuickView && (
              <motion.button
                type="button"
                id={`quick-view-${product.id}`}
                data-testid={`quick-view-${product.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickView(product);
                }}
                initial={{ opacity: 0, y: 6 }}
                whileHover={{ scale: 1.05 }}
                className="absolute bottom-2.5 right-2.5 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-white text-[10px] font-black uppercase tracking-wider rounded-full border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(255,255,255,0.4)]"
              >
                <Eye className="w-3 h-3 text-[#FFE600]" />
                <span>Quick view</span>
              </motion.button>
            )}
          </div>

          <span
            className={`inline-block px-2.5 py-0.5 mb-2 text-[9px] font-black uppercase tracking-wider rounded-full border ${
              isHero
                ? 'bg-[#111111] text-white border-[#111111]'
                : 'bg-[#00E5FF]/20 text-[var(--foreground)] border-[var(--border)]/40'
            }`}
          >
            {product.category}
          </span>

          {/* Product Name (Title) */}
          <h3
            className={`font-display font-bold leading-snug ${
              isHero ? 'text-xl sm:text-2xl text-[#111111]' : 'text-base sm:text-lg text-[var(--foreground)] group-hover:text-[#FF5722]'
            } line-clamp-2 transition-colors`}
            title={product.title}
          >
            {product.title}
          </h3>

          {/* Description */}
          <p
            className={`text-xs mt-2 leading-relaxed font-semibold ${
              isHero ? 'text-[#111111]/90 line-clamp-3' : 'text-[var(--muted-text)] line-clamp-2'
            }`}
          >
            {product.description}
          </p>
        </div>

        {/* View on Amazon Action Button */}
        <div className="mt-4 sm:mt-5 pt-3 border-t-2 border-[var(--border)]/15">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            id={`view-amazon-btn-${product.id}`}
            data-testid="amazon-link-button"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-2 border-[#111111] transition shadow-[3px_3px_0px_0px_var(--border)] active:translate-y-0.5 active:shadow-none ${
              clickedRecently
                ? 'bg-[#FFE600] text-[#111111]'
                : isHero
                ? 'bg-[#111111] text-white hover:bg-[#222222]'
                : 'bg-[#111111] text-white hover:bg-[#222222]'
            }`}
          >
            {clickedRecently ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#111111]" />
                <span>Opening Amazon...</span>
              </>
            ) : (
              <>
                <span>peek on Amazon</span>
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

