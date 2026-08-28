import React from 'react';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import { ViewMode } from '../types';

interface NavbarProps {
  onViewChange: (view: ViewMode) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  totalProducts: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onViewChange,
  searchTerm,
  onSearchChange,
  totalProducts,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b-4 border-[#FFD93D] shadow-sm">
        {/* Main navigation container */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18 gap-3 sm:gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <motion.button
                id="brand-logo-btn"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onViewChange('shop')}
                className="flex items-center gap-2 sm:gap-3 text-left group"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#FFE66D] rounded-2xl flex items-center justify-center border-3 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] group-hover:rotate-6 transition-transform text-xl sm:text-2xl">
                  🦝
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight text-[#2D3436] flex items-center gap-1.5">
                    Raccoon <span className="text-[#FF6B6B]">Hub</span>
                  </h1>
                  <p className="text-[10px] sm:text-[11px] text-[#2D3436]/70 font-bold hidden sm:block">
                    {totalProducts} Curated Products
                  </p>
                </div>
              </motion.button>
            </div>

            {/* Desktop Search bar */}
            <div className="flex-1 max-w-xs xl:max-w-md hidden lg:block shrink min-w-0">
              <div className="relative">
                <Search className="w-4 h-4 text-[#2D3436]/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="global-search-input"
                  type="text"
                  value={searchTerm}
                  onChange={e => {
                    onSearchChange(e.target.value);
                  }}
                  placeholder="Search products in Raccoon Hub..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#FFFBF0] border-2 border-[#2D3436] rounded-xl text-[#2D3436] font-semibold placeholder-[#2D3436]/50 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FF6B6B] transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#FF6B6B] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Mobile search input */}
          <div className="py-2.5 md:hidden border-t-2 border-[#2D3436]/10">
            <div className="relative">
              <Search className="w-4 h-4 text-[#2D3436]/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="mobile-search-input"
                type="text"
                value={searchTerm}
                onChange={e => {
                  onSearchChange(e.target.value);
                }}
                placeholder="Search products in Raccoon Hub..."
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#FFFBF0] border-2 border-[#2D3436] rounded-xl text-[#2D3436] font-semibold placeholder-[#2D3436]/50 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:border-[#FF6B6B]"
              />
            </div>
          </div>
        </div>
    </header>
  );
};
