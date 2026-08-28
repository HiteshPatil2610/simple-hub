import React from 'react';
import { Shield, LayoutDashboard } from 'lucide-react';

interface FooterProps {
  onGoToAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onGoToAdmin }) => {
  return (
    <footer className="bg-[#2D3436] text-[#FFFBF0] border-t-4 border-[#2D3436] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b-2 border-[#FFFBF0]/20">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFE66D] border-2 border-[#2D3436] flex items-center justify-center text-[#2D3436] font-black text-lg shadow-[2px_2px_0px_0px_rgba(255,251,240,1)]">
                🦝
              </div>
              <span className="text-2xl font-black tracking-tight text-[#FFFBF0]">
                Raccoon<span className="text-[#FF6B6B]">Hub</span>
              </span>
            </div>
            <p className="text-xs text-[#FFFBF0]/80 font-bold leading-relaxed max-w-md">
              Hand-picked viral gadgets, aesthetic desk setups, and quirky novelty finds on Amazon. Curated daily for quality, fun, and delightful utility.
            </p>
            <div className="flex items-center gap-4 text-xs text-[#FFFBF0]/70 font-bold">
              <span className="flex items-center gap-1.5 text-[#4ECDC4]">
                <Shield className="w-4 h-4 stroke-[2.5]" /> Direct Amazon Affiliate Redirection
              </span>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#FFE66D] mb-3">
              Categories
            </h4>
            <ul className="space-y-2 text-xs text-[#FFFBF0]/80 font-bold">
              <li><span>Tech & Gadgets</span></li>
              <li><span>Desk & Office Finds</span></li>
              <li><span>Home & Living Decor</span></li>
              <li><span>Quirky Novelties</span></li>
              <li><span>Gifts & Fun Finds</span></li>
            </ul>
          </div>

          {/* Affiliate Partner & Owner Access */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#FFE66D] mb-3">
              Affiliate Partner
            </h4>
            <ul className="space-y-2 text-xs text-[#FFFBF0]/80 font-bold">
              <li className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFE66D] border border-[#2D3436]"></span>
                <span>Amazon Associates Program</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4ECDC4] border border-[#2D3436]"></span>
                <span>Official Associate Tag: raccoonhub-20</span>
              </li>
              {onGoToAdmin && (
                <li className="pt-2">
                  <button
                    type="button"
                    onClick={onGoToAdmin}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#4ECDC4] text-[#2D3436] font-black text-xs uppercase border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(255,251,240,1)] hover:bg-[#3dbdb5] transition"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Owner & Records Portal</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* FTC Disclosure & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#FFFBF0]/60 font-bold">
          <div className="max-w-3xl leading-relaxed">
            <span className="font-black text-[#FFE66D]">Amazon Associate Disclosure:</span> Raccoon Hub is an independent product curation storefront. As an Amazon Associate, we earn from qualifying purchases made through our referral links at no additional cost to you.
          </div>
          <div className="whitespace-nowrap text-[#FFFBF0]/80 font-black">
            © {new Date().getFullYear()} Raccoon Hub. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

