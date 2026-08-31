import React from 'react';
import { Shield, LayoutDashboard } from 'lucide-react';

interface FooterProps {
  onGoToAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onGoToAdmin }) => {
  return (
    <footer className="bg-[#111111] text-[#F7F3E8] border-t-3 border-[#111111] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b-2 border-[#F7F3E8]/20">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FFE600] border-2 border-[#111111] flex items-center justify-center text-[#111111] font-black text-base shadow-[2px_2px_0px_0px_#F7F3E8]">
                🦝
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight text-[#F7F3E8]">
                raccoon<span className="text-[#FF5722]">hub</span>
              </span>
            </div>
            <p className="text-xs text-[#F7F3E8]/80 font-medium leading-relaxed max-w-md">
              A lovingly edited corner of the internet for clever objects, useful oddities, and the little upgrades that make everyday life feel more like yours.
            </p>
            <div className="flex items-center gap-4 text-xs text-[#F7F3E8]/70 font-bold">
              <span className="flex items-center gap-1.5 text-[#4ECDC4]">
                <Shield className="w-4 h-4 stroke-[2.5]" /> Direct Amazon Affiliate Redirection
              </span>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#FFE600] mb-3">
              Categories
            </h4>
            <ul className="space-y-2 text-xs text-[#F7F3E8]/80 font-medium">
              <li><span>Tech & Gadgets</span></li>
              <li><span>Desk & Office</span></li>
              <li><span>Home & Living</span></li>
              <li><span>Quirky Finds</span></li>
              <li><span>Fun & Novelty</span></li>
            </ul>
          </div>

          {/* Affiliate Partner & Owner Access */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#FFE600] mb-3">
              Curator Desk
            </h4>
            <ul className="space-y-2 text-xs text-[#F7F3E8]/80 font-medium">
              <li className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFE600] border border-[#111111]"></span>
                <span>Amazon Associates Program</span>
              </li>
              {onGoToAdmin && (
                <li className="pt-2">
                  <button
                    type="button"
                    id="footer-owner-link"
                    data-testid="footer-owner-link"
                    onClick={onGoToAdmin}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFE600] text-[#111111] font-black text-xs uppercase border-2 border-[#111111] shadow-[2px_2px_0px_0px_#F7F3E8] hover:bg-[#ffea2e] transition"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Owner Hub & Records</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* FTC Disclosure & Copyright */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#F7F3E8]/60 font-medium">
          <div className="max-w-3xl leading-relaxed">
            <span className="font-bold text-[#FFE600]">Amazon Associate Disclosure:</span> As an Amazon Associate, Raccoon Hub earns from qualifying purchases made through outbound links.
          </div>
          <div className="whitespace-nowrap text-[#F7F3E8]/80 font-mono text-[10px]">
            Field notes from the hub © {new Date().getFullYear()} Raccoon Hub
          </div>
        </div>
      </div>
    </footer>
  );
};


