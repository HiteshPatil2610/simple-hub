import React from 'react';
import { motion } from 'motion/react';
import { Search, Lock, Moon, Sun, Menu } from 'lucide-react';
import { ViewMode } from '../types';

interface NavbarProps {
  onViewChange: (view: ViewMode) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  totalProducts: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onViewChange,
  searchTerm,
  onSearchChange,
  totalProducts,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[var(--nav-bg)] backdrop-blur-md border-b-3 border-[var(--border)] transition-colors duration-200">
      {/* Main navigation container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#FFE600] rounded-2xl flex items-center justify-center border-2 border-[#111111] shadow-[3px_3px_0px_0px_var(--border)] group-hover:rotate-6 transition-transform text-xl sm:text-2xl">
                🦝
              </div>
              <div>
                <h1 className="font-display text-lg sm:text-2xl font-black tracking-tight text-[var(--foreground)] flex items-center gap-1">
                  raccoon<span className="text-[#FF5722]">hub</span>
                </h1>
              </div>
            </motion.button>
          </div>

          {/* Desktop Search bar */}
          <div className="flex-1 max-w-xs xl:max-w-md hidden lg:block shrink min-w-0">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--foreground)]/60 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                id="global-search-input"
                data-testid="storefront-search-input"
                type="text"
                value={searchTerm}
                onChange={e => {
                  onSearchChange(e.target.value);
                }}
                placeholder="Search the stash..."
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-[var(--card)] border-2 border-[var(--border)] rounded-full text-[var(--foreground)] font-semibold placeholder-[var(--foreground)]/50 shadow-[3px_3px_0px_0px_var(--border)] focus:outline-none focus:ring-2 focus:ring-[#00E5FF] transition"
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

          {/* Right side: catalog count + Dark Mode Toggle + Owner Hub link */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden md:inline text-[10px] font-black uppercase tracking-wider text-[var(--foreground)]/60 whitespace-nowrap">
              {totalProducts} HAND-PICKED FINDS
            </span>

            {/* Dark mode toggle */}
            {onToggleDarkMode && (
              <button
                type="button"
                data-testid="theme-toggle-button"
                aria-label={isDarkMode ? 'Light mode' : 'Dark mode'}
                onClick={(e) => onToggleDarkMode(e)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--card)] text-[var(--foreground)] font-bold text-xs rounded-full border-2 border-[var(--border)] shadow-[2px_2px_0px_0px_var(--border)] hover:bg-[var(--muted)] transition"
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#FFE600]" />
                    <span className="hidden sm:inline">Light mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span className="hidden sm:inline">Dark mode</span>
                  </>
                )}
              </button>
            )}

            <motion.button
              id="owner-hub-link"
              data-testid="owner-hub-link"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onViewChange('owner')}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#FFE600] text-[#111111] font-black text-[11px] sm:text-xs uppercase tracking-wider rounded-full border-2 border-[#111111] shadow-[2px_2px_0px_0px_var(--border)] hover:shadow-[3px_3px_0px_0px_var(--border)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Owner hub</span>
            </motion.button>

            {/* Mobile Menu Button */}
            <button
              type="button"
              id="mobile-menu-button"
              data-testid="mobile-menu-button"
              className="lg:hidden p-2 rounded-xl bg-[var(--card)] border-2 border-[var(--border)] text-[var(--foreground)] shadow-[2px_2px_0px_0px_var(--border)]"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile search input */}
        <div className="py-2.5 lg:hidden border-t-2 border-[var(--border)]/20">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--foreground)]/60 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="mobile-search-input"
              type="text"
              value={searchTerm}
              onChange={e => {
                onSearchChange(e.target.value);
              }}
              placeholder="Search products in Raccoon Hub..."
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-[var(--card)] border-2 border-[var(--border)] rounded-xl text-[var(--foreground)] font-semibold placeholder-[var(--foreground)]/50 shadow-[2px_2px_0px_0px_var(--border)] focus:outline-none focus:border-[#FF6B6B]"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

