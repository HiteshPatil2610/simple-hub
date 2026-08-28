import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
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
        return 'aspect-[16/10] max-h-72';
      case 'wide':
        return 'aspect-video max-h-48';
      case 'tall':
        return 'aspect-[3/4] max-h-72';
      case 'standard':
      default:
        return 'aspect-square';
    }
  };

  return (
    <motion.div
      id={`product-card-${product.id}`}
      onClick={handleCardClick}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.04, 0.35),
        ease: [0.25, 0.1, 0.25, 1],
      }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      className={`group relative bg-white border-4 border-[#2D3436] rounded-[2rem] p-4 sm:p-5 flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(45,52,54,1)] hover:shadow-[10px_10px_0px_0px_rgba(45,52,54,1)] transition-shadow duration-200 cursor-pointer ${getBentoSpanClasses()}`}
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          {/* Product Image */}
          <div
            className={`relative w-full ${getImageAspectClass()} bg-[#FFE66D]/20 rounded-[1.5rem] border-2 border-[#2D3436] mb-3.5 sm:mb-4 overflow-hidden`}
          >
            {!imageLoaded && (
              <div className="absolute inset-0 bg-[#FFE66D]/30 animate-pulse flex items-center justify-center text-[#2D3436] text-xs font-bold">
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
          </div>

          {/* Product Name (Title) */}
          <h3
            className={`font-black text-[#2D3436] leading-snug group-hover:text-[#FF6B6B] transition-colors ${
              bentoVariant === 'hero' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
            } line-clamp-2`}
            title={product.title}
          >
            {product.title}
          </h3>

          {/* Description */}
          <p
            className={`text-xs text-[#2D3436]/75 mt-2 leading-relaxed font-semibold ${
              bentoVariant === 'hero' || bentoVariant === 'tall' ? 'line-clamp-4' : 'line-clamp-3'
            }`}
          >
            {product.description}
          </p>
        </div>

        {/* View on Amazon Action Button */}
        <div className="mt-4 sm:mt-5 pt-3 border-t-2 border-[#2D3436]/10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            id={`view-amazon-btn-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-2 border-[#2D3436] transition shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] group-hover:shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 active:shadow-none ${
              clickedRecently
                ? 'bg-[#FFE66D] text-[#2D3436]'
                : 'bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436]'
            }`}
          >
            {clickedRecently ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#2D3436]" />
                <span>Opening Amazon...</span>
              </>
            ) : (
              <>
                <span>View on Amazon</span>
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
