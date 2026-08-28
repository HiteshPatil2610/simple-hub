import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Search,
  ArrowUpRight,
  Filter,
  LayoutList,
  LayoutGrid,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';

interface OwnerProductManagerProps {
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onRefresh: () => void;
}

export const OwnerProductManager: React.FC<OwnerProductManagerProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list');

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCopyLink = (productId: string, affiliateUrl: string) => {
    const redirectUrl = api.getRedirectUrl(productId, {
      utm_source: 'raccoonhub_owner',
      utm_medium: 'catalog_link',
    });
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${redirectUrl}`
        : affiliateUrl;

    navigator.clipboard.writeText(fullUrl);
    setCopiedId(productId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="owner-product-manager"
      className="bg-white rounded-[2rem] border-4 border-[#2D3436] p-4 sm:p-7 shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#2D3436] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFE66D] border-2 border-[#2D3436] text-[10px] font-black uppercase text-[#2D3436]">
              Store Catalog Management
            </span>
            <span className="text-[11px] font-mono font-bold text-[#2D3436]/70">
              {filteredProducts.length} of {products.length} {products.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#2D3436] tracking-tight mt-1">
            Listed Products & Direct Links
          </h3>
          <p className="text-xs sm:text-sm text-[#2D3436]/75 mt-0.5 font-medium">
            Edit titles, images, descriptions, direct Amazon links, or remove products.
          </p>
        </div>

        {/* Action Controls: Add Product & Layout Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Desktop Layout Switcher */}
          <div className="hidden sm:inline-flex p-1 bg-[#FFFBF0] border-2 border-[#2D3436] rounded-xl shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
            <button
              type="button"
              onClick={() => setLayoutMode('list')}
              className={`p-1.5 rounded-lg text-xs font-black transition ${
                layoutMode === 'list'
                  ? 'bg-[#FFE66D] text-[#2D3436] border border-[#2D3436] shadow-[1px_1px_0px_0px_rgba(45,52,54,1)]'
                  : 'text-[#2D3436]/60 hover:text-[#2D3436]'
              }`}
              title="List View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-black transition ${
                layoutMode === 'grid'
                  ? 'bg-[#FFE66D] text-[#2D3436] border border-[#2D3436] shadow-[1px_1px_0px_0px_rgba(45,52,54,1)]'
                  : 'text-[#2D3436]/60 hover:text-[#2D3436]'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Action Button: Add Product */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            id="owner-add-product-btn"
            type="button"
            onClick={onAddProduct}
            className="min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] font-black uppercase text-xs sm:text-sm tracking-wider border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add New Product</span>
          </motion.button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#2D3436]/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="owner-search-input"
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by product name, description, ID..."
            className="w-full pl-10 pr-10 py-2.5 bg-[#FFFBF0] border-2 border-[#2D3436] rounded-xl text-xs text-[#2D3436] font-semibold placeholder-[#2D3436]/50 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FF6B6B] min-h-[44px]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#FF6B6B] hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-[#2D3436]/70 shrink-0 hidden sm:block" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border-2 border-[#2D3436] transition shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]'
                  : 'bg-white text-[#2D3436] hover:bg-[#FFFBF0] shadow-[1px_1px_0px_0px_rgba(45,52,54,1)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Header Info */}
      <div className="flex items-center justify-between text-xs text-[#2D3436] font-black bg-[#FFFBF0] px-4 py-2.5 rounded-xl border-2 border-[#2D3436]">
        <span>
          Products listed on store ({filteredProducts.length})
        </span>
        {(searchTerm || categoryFilter !== 'All') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setCategoryFilter('All');
            }}
            className="text-[#FF6B6B] hover:underline uppercase text-[11px]"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Product List Content: 100% Reliable HTML/Flex Layout */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 px-4 border-2 border-dashed border-[#2D3436]/30 rounded-2xl bg-[#FFFBF0]/60">
          <div className="w-12 h-12 rounded-2xl bg-[#FFE66D] border-2 border-[#2D3436] flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] text-xl">
            🦝
          </div>
          <p className="font-black text-[#2D3436] text-sm">No products found</p>
          <p className="text-xs text-[#2D3436]/70 mt-1">
            Try adjusting your search query or add a new Amazon product above.
          </p>
        </div>
      ) : layoutMode === 'grid' ? (
        /* ============ GRID CARDS VIEW ============ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredProducts.map(p => (
            <div
              key={p.id}
              id={`manage-card-${p.id}`}
              className="p-4 bg-[#FFFBF0] border-3 border-[#2D3436] rounded-2xl shadow-[4px_4px_0px_0px_rgba(45,52,54,1)] flex flex-col justify-between space-y-3"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    referrerPolicy="no-referrer"
                    className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-[#2D3436] bg-white shrink-0 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]"
                    onError={e => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase border border-[#2D3436] bg-[#FFE66D] text-[#2D3436] mb-1">
                      {p.category}
                    </span>
                    <h4 className="font-black text-[#2D3436] text-sm leading-snug line-clamp-2">
                      {p.title}
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-[#2D3436]/75 line-clamp-2 font-medium">
                  {p.description}
                </p>

                {/* Direct Link Info Box */}
                <div className="p-2.5 bg-white rounded-xl border border-[#2D3436] text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-[#2D3436]">
                    <span className="font-bold text-[10px] uppercase text-[#2D3436]/60">
                      Amazon Link
                    </span>
                    <a
                      href={`/api/redirect/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF6B6B] hover:text-[#2D3436] font-black inline-flex items-center gap-0.5 text-[10px]"
                    >
                      Test <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="font-mono text-[10px] text-[#2D3436] truncate" title={p.affiliateUrl}>
                    {p.affiliateUrl}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#2D3436]/10">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  id={`edit-grid-btn-${p.id}`}
                  onClick={() => onEditProduct(p)}
                  className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 bg-[#FFE66D] hover:bg-[#FFD93D] text-[#2D3436] font-black text-xs uppercase rounded-xl border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  id={`delete-grid-btn-${p.id}`}
                  onClick={() => {
                    if (confirm(`Remove "${p.title}" from Raccoon Hub?`)) {
                      onDeleteProduct(p);
                    }
                  }}
                  className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 bg-[#FF6B6B] hover:bg-[#ff5252] text-white font-black text-xs uppercase rounded-xl border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </motion.button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ============ DETAILED LIST VIEW (DEFAULT FOR DESKTOP & MOBILE) ============ */
        <div className="space-y-4">
          {filteredProducts.map(p => (
            <div
              key={p.id}
              id={`manage-item-${p.id}`}
              className="p-4 sm:p-5 bg-[#FFFBF0] border-3 border-[#2D3436] rounded-2xl shadow-[4px_4px_0px_0px_rgba(45,52,54,1)] hover:shadow-[6px_6px_0px_0px_rgba(45,52,54,1)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Product Info & Image */}
              <div className="flex items-start gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    referrerPolicy="no-referrer"
                    className="w-18 h-18 sm:w-22 sm:h-22 rounded-2xl object-cover border-2 border-[#2D3436] bg-white shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]"
                    onError={e => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border border-[#2D3436] bg-[#FFE66D] text-[#2D3436]">
                      {p.category}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#2D3436]/60">
                      ID: {p.id}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-500 text-[10px] font-black uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Live on Storefront
                    </span>
                  </div>

                  <h4 className="font-black text-[#2D3436] text-sm sm:text-base leading-snug line-clamp-1">
                    {p.title}
                  </h4>

                  <p className="text-xs text-[#2D3436]/75 line-clamp-2 font-medium">
                    {p.description}
                  </p>

                  {/* Amazon Affiliate Link Box with 1-click test & copy */}
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-[#2D3436] text-[11px] max-w-full sm:max-w-md">
                      <span className="font-bold text-[#2D3436]/60 shrink-0">
                        Link:
                      </span>
                      <span
                        className="font-mono text-[#2D3436] truncate max-w-[180px] sm:max-w-[240px]"
                        title={p.affiliateUrl}
                      >
                        {p.affiliateUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(p.id, p.affiliateUrl)}
                        className="text-[#FF6B6B] hover:text-[#2D3436] font-black inline-flex items-center gap-1 shrink-0 ml-1"
                      >
                        {copiedId === p.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <a
                      href={`/api/redirect/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-black text-[#2D3436] hover:text-[#FF6B6B] inline-flex items-center gap-1 underline underline-offset-2 shrink-0"
                    >
                      <span>Test Link</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit & Remove */}
              <div className="flex sm:flex-row md:flex-col lg:flex-row items-center gap-2.5 shrink-0 pt-3 md:pt-0 border-t-2 md:border-t-0 border-[#2D3436]/10">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  id={`edit-product-${p.id}`}
                  onClick={() => onEditProduct(p)}
                  className="flex-1 md:flex-initial min-h-[44px] px-4 sm:px-5 py-2.5 bg-[#FFE66D] hover:bg-[#FFD93D] text-[#2D3436] font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] flex items-center justify-center gap-1.5 transition"
                  title="Edit product name, image, description, or direct Amazon link"
                >
                  <Edit2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Edit Product</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  id={`delete-product-${p.id}`}
                  onClick={() => {
                    if (confirm(`Are you sure you want to remove "${p.title}" from the storefront?`)) {
                      onDeleteProduct(p);
                    }
                  }}
                  className="flex-1 md:flex-initial min-h-[44px] px-4 sm:px-5 py-2.5 bg-[#FF6B6B] hover:bg-[#ff5252] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl border-2 border-[#2D3436] shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] flex items-center justify-center gap-1.5 transition"
                  title="Remove product from storefront"
                >
                  <Trash2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Remove</span>
                </motion.button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

