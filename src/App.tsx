import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Flame, ArrowUpDown, ShoppingBag, LayoutDashboard, BarChart3, Plus, Package } from 'lucide-react';
import { Product, AnalyticsSummary, ViewMode } from './types';
import { api, getOwnerKey, clearOwnerKey } from './services/api';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ProductAdminModal } from './components/ProductAdminModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { OwnerProductManager } from './components/OwnerProductManager';
import { OwnerGate } from './components/OwnerGate';
import { RedirectNotification } from './components/RedirectNotification';
import { Footer } from './components/Footer';

const CATEGORIES = [
  'All',
  'Tech & Gadgets',
  'Desk & Office',
  'Home & Living',
  'Quirky Finds',
  'Fun & Novelty',
];

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('shop');
  const [ownerSubTab, setOwnerSubTab] = useState<'products' | 'analytics'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [clicksToday, setClicksToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'title-asc' | 'recent'>('popular');

  // Modals & Notifications
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [redirectToastProduct, setRedirectToastProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Owner Hub access gate
  const [isOwnerAuthed, setIsOwnerAuthed] = useState(false);
  const [isCheckingOwnerAuth, setIsCheckingOwnerAuth] = useState(true);

  // Initial load & URL Hash listener
  useEffect(() => {
    loadStoreData();

    const handleHash = () => {
      if (
        window.location.hash === '#admin' ||
        window.location.hash === '#owner' ||
        window.location.search.includes('view=admin') ||
        window.location.search.includes('view=owner')
      ) {
        setCurrentView('owner');
        setOwnerSubTab('products');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Silently re-validate a previously-stored owner key so returning owners
  // aren't re-prompted every visit, without ever trusting session storage alone.
  useEffect(() => {
    const storedKey = getOwnerKey();
    api
      .verifyOwnerKey(storedKey)
      .then(ok => {
        if (ok) {
          setIsOwnerAuthed(true);
          refreshAnalytics();
        }
        else clearOwnerKey();
      })
      .catch(() => {})
      .finally(() => setIsCheckingOwnerAuth(false));
  }, []);

  const changeView = (view: ViewMode) => {
    setCurrentView(view);
    if (view === 'owner' || view === 'admin') {
      window.location.hash = 'admin';
    } else if (view === 'shop') {
      if (window.location.hash === '#admin' || window.location.hash === '#owner') {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
      }
    }
  };

  const loadStoreData = async () => {
    try {
      setIsLoading(true);
      const [prodsData, publicAnalytics] = await Promise.all([
        api.getProducts(),
        api.getPublicAnalytics(),
      ]);
      setProducts(prodsData);
      setClicksToday(publicAnalytics.clicksToday);
    } catch (err) {
      console.error('Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    try {
      setIsRefreshing(true);
      const analyticsData = await api.getAnalytics();
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Failed to refresh analytics');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Seamless Affiliate Redirection Handler
  const handleAffiliateClick = async (product: Product) => {
    // 1. Show immediate visual feedback toast
    setRedirectToastProduct(product);

    // 2. Track click beacon
    try {
      api.trackClick({
        productId: product.id,
        utmSource: 'raccoonhub_storefront',
        utmMedium: 'product_card',
        utmCampaign: 'curated_amazon_finds',
      }).then(() => {
        refreshAnalytics();
      });
    } catch (err) {
      console.error('Tracking beacon error');
    }

    // 3. Seamlessly redirect via tracking route in new tab
    const redirectUrl = api.getRedirectUrl(product.id, {
      utm_source: 'raccoonhub',
      utm_medium: 'affiliate_card',
      utm_campaign: 'amazon_finds',
      subid: product.customSubId || 'raccoon_user',
    });

    window.open(redirectUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle Save Product (create or edit)
  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (editingProduct) {
      const updated = await api.updateProduct(editingProduct.id, {
        ...productData,
        platform: 'Amazon',
      });
      setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    } else {
      const created = await api.createProduct({
        ...productData,
        platform: 'Amazon',
      });
      setProducts(prev => [created, ...prev]);
    }
    setEditingProduct(null);
    refreshAnalytics();
  };

  // Handle Delete Product
  const handleDeleteProduct = async (product: Product) => {
    await api.deleteProduct(product.id);
    setProducts(prev => prev.filter(p => p.id !== product.id));
    refreshAnalytics();
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      result = result.filter(
        p => p.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'popular':
        default:
          return b.reviewCount - a.reviewCount;
      }
    });

    return result;
  }, [products, searchTerm, selectedCategory, sortBy]);

  const isOwnerView = currentView === 'owner' || currentView === 'analytics' || currentView === 'admin';

  return (
    <div className="min-h-screen bg-[#FFFBF0] text-[#2D3436] flex flex-col font-sans selection:bg-[#FF6B6B] selection:text-white">
      {/* Navigation */}
      <Navbar
        currentView={currentView}
        onViewChange={view => {
          changeView(view);
          if (view === 'analytics') setOwnerSubTab('analytics');
          if (view === 'owner') setOwnerSubTab('products');
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenAddModal={() => {
          setEditingProduct(null);
          setIsAddModalOpen(true);
        }}
        totalProducts={products.length}
        totalClicksToday={clicksToday}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-20 sm:pb-10">
        <AnimatePresence mode="wait">
          {isOwnerView ? (
            /* ================= PAGE 2: OWNER VIEW (RECORDS, STATS & ADD/REMOVE/EDIT PRODUCTS) ================= */
            <motion.div
              key="owner-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6"
            >
              {/* Owner Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-[#2D3436] pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFE66D] border-2 border-[#2D3436] text-[10px] font-black uppercase text-[#2D3436]">
                      Owner Control Hub
                    </span>
                    <span className="text-xs font-mono font-bold text-[#2D3436]/60">
                      Live Catalog & Telemetry
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-[#2D3436] mt-1">
                    Raccoon Hub Records & Management
                  </h1>
                  <p className="text-xs sm:text-sm text-[#2D3436]/75 font-semibold mt-0.5">
                    Control all products shown on the public storefront, track outbound clicks, and examine performance records.
                  </p>
                </div>

                {/* Owner Sub Tabs Switcher */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                {isOwnerAuthed && (
                  <button
                    type="button"
                    onClick={() => {
                      clearOwnerKey();
                      setIsOwnerAuthed(false);
                    }}
                    className="text-[10px] font-black uppercase tracking-wider text-[#2D3436]/60 hover:text-[#FF6B6B] underline"
                    title="Lock the Owner Hub"
                  >
                    Lock
                  </button>
                )}
                <div className="inline-flex p-1.5 bg-white border-3 border-[#2D3436] rounded-2xl shadow-[4px_4px_0px_0px_rgba(45,52,54,1)]">
                  <button
                    type="button"
                    id="owner-tab-products"
                    onClick={() => setOwnerSubTab('products')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                      ownerSubTab === 'products'
                        ? 'bg-[#FFE66D] text-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] border-2 border-[#2D3436]'
                        : 'text-[#2D3436]/70 hover:text-[#2D3436]'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>Manage Products</span>
                  </button>

                  <button
                    type="button"
                    id="owner-tab-records"
                    onClick={() => setOwnerSubTab('analytics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                      ownerSubTab === 'analytics'
                        ? 'bg-[#4ECDC4] text-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] border-2 border-[#2D3436]'
                        : 'text-[#2D3436]/70 hover:text-[#2D3436]'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Records & Clicks</span>
                  </button>
                </div>
                </div>
              </div>

              {/* Sub-view switcher: gated behind owner authentication */}
              {isCheckingOwnerAuth ? (
                <div className="py-16 text-center text-sm font-bold text-[#2D3436]/60">Checking access…</div>
              ) : !isOwnerAuthed ? (
                <OwnerGate
                  onUnlocked={() => {
                    setIsOwnerAuthed(true);
                    refreshAnalytics();
                  }}
                />
              ) : ownerSubTab === 'products' ? (
                <OwnerProductManager
                  products={products}
                  onAddProduct={() => {
                    setEditingProduct(null);
                    setIsAddModalOpen(true);
                  }}
                  onEditProduct={product => {
                    setEditingProduct(product);
                    setIsAddModalOpen(true);
                  }}
                  onDeleteProduct={handleDeleteProduct}
                  onRefresh={loadStoreData}
                />
              ) : (
                <AnalyticsDashboard
                  analytics={analytics}
                  products={products}
                  isLoading={isLoading || isRefreshing}
                  onRefresh={refreshAnalytics}
                  onSelectProduct={p => {
                    setQuickViewProduct(p);
                  }}
                />
              )}
            </motion.div>
          ) : (
            /* ================= PAGE 1: PUBLIC STOREFRONT (WHAT ALL USERS WILL SEE) ================= */
            <motion.div
              key="storefront-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {/* Hero Section */}
              <div className="bg-[#FFFBF0] border-b-4 border-[#2D3436] py-8 sm:py-14 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto text-center">
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#FFE66D] border-2 border-[#2D3436] text-[#2D3436] text-[11px] sm:text-xs font-black uppercase shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] mb-3 sm:mb-4"
                  >
                    <span className="text-base leading-none">🦝</span>
                    <span>Curated Amazon Finds</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2D3436]"></span>
                    <span className="text-[#FF6B6B] font-black">Direct Affiliate Links</span>
                  </motion.div>

                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#2D3436] tracking-tight max-w-4xl mx-auto leading-[1.15]">
                    Curated <span className="text-[#FF6B6B]">Amazon Finds</span> You Didn’t Know You Needed.
                  </h1>

                  <p className="mt-3 sm:mt-4 text-xs sm:text-base text-[#2D3436]/80 font-bold max-w-2xl mx-auto leading-relaxed">
                    Hand-picked viral gadgets, aesthetic desk setups, and clever novelties. Click any find to view and purchase directly on Amazon.
                  </p>

                  {/* Trust badges & Store Manager Quick Access */}
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-5 sm:mt-6 text-[11px] sm:text-xs text-[#2D3436] font-black">
                    <div className="flex items-center gap-1.5 bg-white border-2 border-[#2D3436] px-3 py-1 rounded-full shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Direct Amazon Links</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border-2 border-[#2D3436] px-3 py-1 rounded-full shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                      <span className="w-2 h-2 rounded-full bg-[#FF6B6B]"></span>
                      <span>Verified Affiliate Tracking</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border-2 border-[#2D3436] px-3 py-1 rounded-full shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                      <span className="w-2 h-2 rounded-full bg-[#FFD93D]"></span>
                      <span>Curated Hand-Picked Quality</span>
                    </div>
                    <button
                      type="button"
                      id="hero-manage-products-btn"
                      onClick={() => {
                        changeView('owner');
                        setOwnerSubTab('products');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1.5 bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] border-2 border-[#2D3436] px-3.5 py-1 rounded-full shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] transition active:translate-y-0.5 cursor-pointer"
                      title="Open Owner & Records Product Manager"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Owner Hub: Edit Products</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter and Control Bar */}
              <div className="sticky top-16 z-30 bg-[#FFFBF0]/95 backdrop-blur-md border-b-4 border-[#2D3436] py-3 sm:py-4 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2.5 sm:space-y-3">
                  {/* Categories scrolling bar */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {CATEGORIES.map(category => (
                      <button
                        key={category}
                        id={`category-btn-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        onClick={() => setSelectedCategory(category)}
                        className={`min-h-[38px] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition border-2 border-[#2D3436] active:translate-y-0.5 ${
                          selectedCategory === category
                            ? 'bg-[#FF6B6B] text-white shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]'
                            : 'bg-white text-[#2D3436] hover:bg-[#FFE66D] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  {/* Sub row: Count & Sort */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[#2D3436] font-bold text-[11px] sm:text-xs">
                        Showing <strong className="font-black text-[#FF6B6B]">{filteredProducts.length}</strong> Amazon items
                      </span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 bg-white border-2 border-[#2D3436] rounded-xl px-2.5 sm:px-3 py-1 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] min-h-[36px]">
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#2D3436]" />
                        <select
                          id="sort-select"
                          value={sortBy}
                          onChange={e => setSortBy(e.target.value as any)}
                          className="bg-transparent text-[11px] sm:text-xs font-black uppercase text-[#2D3436] focus:outline-none cursor-pointer"
                        >
                          <option value="popular">Most Popular</option>
                          <option value="recent">Recently Added</option>
                          <option value="title-asc">Title: A to Z</option>
                        </select>
                      </div>

                      {(selectedCategory !== 'All' || searchTerm) && (
                        <button
                          onClick={() => {
                            setSelectedCategory('All');
                            setSearchTerm('');
                          }}
                          className="text-[#FF6B6B] hover:text-[#2D3436] font-black underline uppercase text-xs"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Grid: Displays Image, Title, Description, and Amazon CTA ONLY */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="bg-white rounded-[2rem] border-4 border-[#2D3436] p-5 space-y-4 shadow-[6px_6px_0px_0px_rgba(45,52,54,1)] animate-pulse">
                        <div className="aspect-square bg-[#FFE66D]/30 border-2 border-[#2D3436] rounded-[1.5rem]"></div>
                        <div className="h-5 bg-[#2D3436]/20 rounded-md w-3/4"></div>
                        <div className="h-4 bg-[#2D3436]/10 rounded-md w-full"></div>
                        <div className="h-10 bg-[#FFD93D]/50 rounded-xl border-2 border-[#2D3436]"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-[2rem] border-4 border-[#2D3436] shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] max-w-lg mx-auto p-8">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFE66D] border-2 border-[#2D3436] text-[#2D3436] flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] text-2xl">
                      🦝
                    </div>
                    <h3 className="text-lg font-black text-[#2D3436]">No matching finds</h3>
                    <p className="text-xs text-[#2D3436]/70 mt-1 font-bold">
                      Try adjusting your search or category filters to find curated Amazon products.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedCategory('All');
                        setSearchTerm('');
                      }}
                      className="mt-5 px-5 py-2.5 bg-[#FF6B6B] text-white border-2 border-[#2D3436] rounded-xl text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] hover:translate-y-0.5"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                    {filteredProducts.map((product, idx) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        index={idx}
                        onQuickView={p => setQuickViewProduct(p)}
                        onAffiliateClick={handleAffiliateClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer
        onGoToAdmin={() => {
          changeView('owner');
          setOwnerSubTab('products');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Quick View / Detail Modal */}
      <ProductDetailModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAffiliateClick={handleAffiliateClick}
      />

      {/* Add / Edit Product Admin Modal */}
      <ProductAdminModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        editingProduct={editingProduct}
      />

      {/* Redirect Notification Toast */}
      <RedirectNotification
        product={redirectToastProduct}
        onClose={() => setRedirectToastProduct(null)}
      />
    </div>
  );
}
