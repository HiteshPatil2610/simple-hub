import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Search, ShoppingBag, LayoutDashboard, PlusCircle, ExternalLink } from 'lucide-react';
import { ViewMode } from '../types';

interface NavbarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onOpenAddModal: () => void;
  totalProducts: number;
  totalClicksToday: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  searchTerm,
  onSearchChange,
  onOpenAddModal,
  totalProducts,
  totalClicksToday,
}) => {
  const isOwnerView = currentView === 'owner' || currentView === 'analytics' || currentView === 'admin';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b-4 border-[#FFD93D] shadow-sm">
        {/* Top announcement bar */}
        <div className="bg-[#2D3436] text-[#FFFBF0] text-xs py-2 px-3 sm:px-4 border-b border-[#3F4648]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold min-w-0">
              <span className="inline-flex items-center gap-1 bg-[#FFE66D] text-[#2D3436] px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] shrink-0">
                🦝 Amazon Finds
              </span>
              <span className="hidden sm:inline text-white/90 font-medium truncate">
                Raccoon Hub — Hand-picked curated products with direct Amazon affiliate links
              </span>
              <span className="sm:hidden text-white/90 truncate text-[11px]">
                Curated Amazon Finds
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="bg-[#E0FBFC] text-[#2D3436] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border-2 border-[#2D3436] flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] text-[10px] sm:text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-black uppercase tracking-wider hidden sm:inline">Clicks Today:</span>
                <span className="font-mono font-black">{totalClicksToday}</span>
              </div>

              {/* Direct Admin switch in top bar */}
              <button
                type="button"
                id="topbar-admin-btn"
                onClick={() => onViewChange(isOwnerView ? 'shop' : 'owner')}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 rounded-full border-2 border-[#2D3436] text-[10px] sm:text-xs font-black uppercase tracking-wider transition ${
                  isOwnerView
                    ? 'bg-[#4ECDC4] text-[#2D3436] shadow-[2px_2px_0px_0px_rgba(255,251,240,1)]'
                    : 'bg-[#FFE66D] text-[#2D3436] hover:bg-[#FFD93D] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
                }`}
                title="Switch between Storefront and Admin / Owner Portal"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>{isOwnerView ? 'View Storefront' : 'Admin & Records'}</span>
              </button>
            </div>
          </div>
        </div>

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
                    <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-[#E0FBFC] text-[#2D3436] border-2 border-[#2D3436] shadow-[1px_1px_0px_0px_rgba(45,52,54,1)]">
                      Amazon
                    </span>
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
                    if (isOwnerView) onViewChange('shop');
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

            {/* Desktop Action buttons */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Page 1: User Storefront */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                id="nav-shop-btn"
                onClick={() => onViewChange('shop')}
                className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition border-2 border-[#2D3436] whitespace-nowrap shrink-0 ${
                  !isOwnerView
                    ? 'bg-[#FF6B6B] text-white shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]'
                    : 'bg-white text-[#2D3436] hover:bg-[#FFFBF0] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Storefront</span>
              </motion.button>

              {/* Page 2: Owner Hub */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                id="nav-owner-btn"
                onClick={() => onViewChange('owner')}
                className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition border-2 border-[#2D3436] whitespace-nowrap shrink-0 ${
                  isOwnerView
                    ? 'bg-[#4ECDC4] text-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] ring-2 ring-[#2D3436]'
                    : 'bg-[#E0FBFC] text-[#2D3436] hover:bg-[#4ECDC4]/40 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 stroke-[2.5]" />
                <span>Owner & Records</span>
              </motion.button>

              {/* Quick Add Product */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                id="nav-add-product-btn"
                onClick={onOpenAddModal}
                className="min-h-[44px] flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-[#FFD93D] hover:bg-[#FFE66D] text-[#2D3436] rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] transition whitespace-nowrap shrink-0"
              >
                <PlusCircle className="w-4 h-4 text-[#2D3436]" />
                <span>Add Product</span>
              </motion.button>
            </div>

            {/* Mobile Header Quick Actions */}
            <div className="flex sm:hidden items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onOpenAddModal}
                className="min-h-[44px] px-3 py-1.5 bg-[#FFD93D] text-[#2D3436] rounded-xl text-xs font-black uppercase border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] flex items-center gap-1"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add</span>
              </motion.button>
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
                  if (isOwnerView) onViewChange('shop');
                }}
                placeholder="Search products in Raccoon Hub..."
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#FFFBF0] border-2 border-[#2D3436] rounded-xl text-[#2D3436] font-semibold placeholder-[#2D3436]/50 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:border-[#FF6B6B]"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Mobile Bottom Navigation Dock for effortless thumb switching on mobile */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-3 border-[#2D3436] px-3 py-2 shadow-[0_-4px_10px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around gap-2 max-w-md mx-auto">
          {/* Storefront Tab */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => onViewChange('shop')}
            className={`flex-1 min-h-[44px] py-2 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-2 border-[#2D3436] transition ${
              !isOwnerView
                ? 'bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]'
                : 'bg-white text-[#2D3436]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Storefront</span>
          </motion.button>

          {/* Owner & Records Tab */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => onViewChange('owner')}
            className={`flex-1 min-h-[44px] py-2 px-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-2 border-[#2D3436] transition ${
              isOwnerView
                ? 'bg-[#4ECDC4] text-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]'
                : 'bg-white text-[#2D3436]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Owner Hub</span>
          </motion.button>

          {/* Quick Add Product Floating Button */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onOpenAddModal}
            className="w-11 h-11 rounded-xl bg-[#FFD93D] border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] flex items-center justify-center text-[#2D3436]"
            title="Add Product"
          >
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          </motion.button>
        </div>
      </div>
    </>
  );
};
