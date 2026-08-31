import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Flame, ArrowUpDown, ShoppingBag, LayoutDashboard, BarChart3, Plus, Package, LayoutGrid, Grid, ArrowDown } from 'lucide-react';
import { Product, AnalyticsSummary, ViewMode } from './types';
import { api, getAuthToken, clearAuthToken } from './services/api';
import { Navbar } from './components/Navbar';
import { ProductCard, BentoVariant } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ProductAdminModal } from './components/ProductAdminModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { OwnerProductManager } from './components/OwnerProductManager';
import { OwnerGate } from './components/OwnerGate';
import { ChangePasswordModal } from './components/ChangePasswordModal';
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

  // Filters & Search & Layout
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'title-asc' | 'recent'>('popular');
  const [layoutMode, setLayoutMode] = useState<'bento' | 'classic'>('bento');

  // Modals & Notifications
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [redirectToastProduct, setRedirectToastProduct] = useState<Product | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Bento Variant Calculation per product index
  const getBentoVariantForIndex = (product: Product, index: number): BentoVariant => {
    if (layoutMode === 'classic') return 'standard';
    if (product.featured) return 'hero';
    
    const bentoPattern: BentoVariant[] = [
      'hero',
      'standard',
      'tall',
      'standard',
      'wide',
      'standard',
      'standard',
      'wide',
      'tall',
      'standard',
    ];
    return bentoPattern[index % bentoPattern.length];
  };

  // Owner Hub access gate
  const [isOwnerAuthed, setIsOwnerAuthed] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCheckingOwnerAuth, setIsCheckingOwnerAuth] = useState(true);

  // Dark mode state management
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('raccoon_hub_theme') === 'dark';
    }
    return false;
  });

  const isTransitioning = useRef(false);

  // Synchronously update HTML dark class and storage when isDarkMode updates
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark', 'dark-mode');
      localStorage.setItem('raccoon_hub_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark', 'dark-mode');
      localStorage.setItem('raccoon_hub_theme', 'light');
    }
  }, [isDarkMode]);

  // Dual-theme circular reveal/shrink transition using View Transitions API
  const handleToggleDarkMode = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (isTransitioning.current) return;

    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const goingDark = !isDarkMode;

    document.documentElement.style.setProperty('--x', `${x}px`);
    document.documentElement.style.setProperty('--y', `${y}px`);

    if (!(document as any).startViewTransition) {
      setIsDarkMode(goingDark);
      return;
    }

    isTransitioning.current = true;
    const transitionClass = goingDark ? 'theme-going-dark' : 'theme-going-light';
    document.documentElement.classList.add('theme-transitioning', transitionClass);

    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        setIsDarkMode(goingDark);
      });
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove(
        'theme-transitioning',
        'theme-going-dark',
        'theme-going-light'
      );
      isTransitioning.current = false;
    });
  }, [isDarkMode]);

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

  // Silently re-validate a previously-stored JWT so returning owners
  // aren't re-prompted every visit
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsCheckingOwnerAuth(false);
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.ok) {
          setIsOwnerAuthed(true);
          refreshAnalytics();
        } else {
          clearAuthToken();
        }
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
    setRedirectToastProduct(product);

    try {
      const res = await api.trackClick({
        productId: product.id,
        utmSource: 'raccoonhub',
        utmMedium: 'affiliate_card',
        utmCampaign: 'amazon_finds',
        subid: product.customSubId || 'raccoon_user',
      });
      if (res?.destinationUrl) {
        window.open(res.destinationUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch {
      // Fallback to server redirect route
    }

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

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter(
        p => p.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col font-sans selection:bg-[#FF6B6B] selection:text-white transition-colors duration-200">
      {/* Navigation Header */}
      <Navbar
        onViewChange={changeView}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        totalProducts={products.length}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-16">
        <AnimatePresence mode="wait">
          {isOwnerView ? (
            /* ================= PAGE 2: OWNER VIEW (RECORDS & PRODUCTS) ================= */
            <motion.div
              key="owner-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6"
            >
              {/* Owner Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--border)]/20 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFE600] border-2 border-[#111111] shadow-[2px_2px_0px_0px_var(--border)] text-[10px] font-black uppercase text-[#111111]">
                      Owner Control Hub
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--muted-text)]">
                      Live Catalog & Telemetry
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--foreground)] mt-1">
                    Curator’s Desk & Records
                  </h1>
                </div>

                {/* Owner Sub Tabs & Actions */}
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  {isOwnerAuthed && (
                    <button
                      type="button"
                      id="change-password-button"
                      data-testid="change-password-button"
                      onClick={() => setIsChangePasswordOpen(true)}
                      className="text-xs font-bold uppercase tracking-wider text-[var(--muted-text)] hover:text-[var(--foreground)] underline"
                    >
                      Change Password
                    </button>
                  )}
                  {isOwnerAuthed && (
                    <button
                      type="button"
                      id="logout-button"
                      data-testid="logout-button"
                      onClick={() => {
                        clearAuthToken();
                        setIsOwnerAuthed(false);
                      }}
                      className="text-xs font-bold uppercase tracking-wider text-[#FF6B6B] hover:underline"
                    >
                      Lock / Logout
                    </button>
                  )}
                  <div className="inline-flex p-1 bg-[var(--card)] border-2 border-[var(--border)] rounded-xl shadow-[3px_3px_0px_0px_var(--border)]">
                    <button
                      type="button"
                      id="manage-products-tab"
                      data-testid="manage-products-tab"
                      onClick={() => setOwnerSubTab('products')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                        ownerSubTab === 'products'
                          ? 'bg-[#FFE600] text-[#111111] border border-[#111111] shadow-[2px_2px_0px_0px_var(--border)]'
                          : 'text-[var(--foreground)]/70 hover:text-[var(--foreground)]'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      <span>Manage Products</span>
                    </button>

                    <button
                      type="button"
                      id="analytics-tab"
                      data-testid="analytics-tab"
                      onClick={() => setOwnerSubTab('analytics')}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                        ownerSubTab === 'analytics'
                          ? 'bg-[#4ECDC4] text-[#111111] border border-[#111111] shadow-[2px_2px_0px_0px_#111111]'
                          : 'text-[var(--foreground)]/70 hover:text-[var(--foreground)]'
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
                <div className="py-16 text-center text-sm font-bold text-[var(--muted-text)]">Checking access…</div>
              ) : !isOwnerAuthed ? (
                <OwnerGate
                  onUnlocked={() => {
                    setIsOwnerAuthed(true);
                    refreshAnalytics();
                  }}
                  onBackToStorefront={() => changeView('shop')}
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
            /* ================= PAGE 1: PUBLIC STOREFRONT (EXPRESSIVE HERO MATCHING SCREENSHOT 3 & 4) ================= */
            <motion.div
              key="storefront-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              {/* Expressive Hero Section */}
              <div className="relative border-b-3 border-[var(--border)] py-10 sm:py-14 px-4 sm:px-6 lg:px-8 bg-[var(--background)]">
                <div className="max-w-7xl mx-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                    {/* Left Column: Badges, Oversized Headline & CTAs */}
                    <div className="lg:col-span-7 space-y-6 text-left">
                      {/* Badges Pill Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-[#00E5FF] text-[#111111] text-[10px] font-black uppercase tracking-wider border-2 border-[#111111] shadow-[2px_2px_0px_0px_var(--border)]">
                          RACCOON FINDS / VOL. 01
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[#FFE600] text-[#111111] text-[10px] font-black uppercase tracking-wider border-2 border-[#111111] shadow-[2px_2px_0px_0px_var(--border)]">
                          A SMALL INTERNET TREASURE MAP
                        </span>
                      </div>

                      {/* Main Headline (Matching Screenshot 3) */}
                      <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[var(--foreground)] tracking-tight leading-[0.92]">
                        Good <br />
                        things, <br />
                        <span className="relative inline-block px-3 py-0.5 rounded-xl bg-[#FF5722] text-white border-3 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] -rotate-1">
                          found on
                        </span>{' '}
                        purpose.
                      </h1>

                      {/* Tagline */}
                      <p className="text-sm sm:text-base text-[var(--muted-text)] font-medium max-w-lg leading-relaxed">
                        A lovingly edited corner of the internet for clever objects, useful oddities, and the little upgrades that make everyday life feel more like yours.
                      </p>

                      {/* Hero Actions */}
                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <a
                          href="#product-viewing-area"
                          id="explore-finds-button"
                          data-testid="explore-finds-button"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('product-viewing-area')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF5722] hover:bg-[#e84e1b] text-white font-black text-xs sm:text-sm uppercase tracking-wider border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] active:translate-y-0.5 transition cursor-pointer"
                        >
                          <span>Explore the finds</span>
                          <ArrowDown className="w-4 h-4 stroke-[3]" />
                        </a>

                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted-text)]">
                          <span className="w-5 h-5 rounded-full bg-[#4ECDC4]/30 border border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--foreground)] font-black">✓</span>
                          <span>Direct links to Amazon</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Hero Framed Box (Matching Screenshot 3) */}
                    <div className="lg:col-span-5 relative">
                      <div className="relative bg-[#FFE600] border-3 border-[#111111] rounded-[1.75rem] p-4 sm:p-5 shadow-[6px_6px_0px_0px_var(--border)] overflow-hidden">
                        {/* Orbit / Dashed decorative lines */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none border-2 border-dashed border-[#111111] rounded-[1.75rem] m-2" />

                        {/* Sticker badge */}
                        <div className="absolute top-4 left-4 z-20 bg-[#FF6B6B] text-white border-2 border-[#111111] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_var(--border)] -rotate-3">
                          keep looking closer
                        </div>

                        {/* Framed photo */}
                        <div className="relative aspect-[4/3] bg-[#111111] border-2 border-[#111111] rounded-xl overflow-hidden mb-3">
                          <img
                            src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80"
                            alt="Curated Gadgets Composition"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Field note tag */}
                        <div className="flex items-center justify-between text-[9px] font-mono font-bold text-[#111111]">
                          <span className="bg-white px-2 py-0.5 rounded border border-[#111111]">
                            field note 014 / for curious people
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Header Bar (Matching Screenshot 4) */}
              <div id="product-viewing-area" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
                <div className="border-t-2 border-[var(--border)]/20 pt-6">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--muted-text)] mb-1">
                    THE CURRENT STASH
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[var(--border)] pb-4">
                    <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-[var(--foreground)] tracking-tight">
                      Worth a closer look<span className="text-[#FF5722]">.</span>
                    </h2>
                    <span
                      id="result-count"
                      data-testid="result-count"
                      className="inline-block px-3 py-1 rounded-md bg-[#00E5FF] text-[#111111] text-xs font-black uppercase tracking-wider border-2 border-[#111111] shadow-[2px_2px_0px_0px_var(--border)] self-start sm:self-auto"
                    >
                      {filteredProducts.length} finds in the wild
                    </span>
                  </div>
                </div>

                {/* Filter and Sort Toolbar */}
                <div className="py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Category Pills */}
                  <div
                    id="category-filters"
                    data-testid="category-filters"
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
                  >
                    {CATEGORIES.map(category => (
                      <button
                        key={category}
                        id={`category-btn-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        data-testid={
                          category === 'All'
                            ? 'category-filter-all-finds'
                            : `category-filter-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
                        }
                        onClick={() => setSelectedCategory(category)}
                        className={`min-h-[38px] px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition border-2 border-[#111111] active:translate-y-0.5 ${
                          selectedCategory === category
                            ? 'bg-[#4ECDC4] text-[#111111] shadow-[2px_2px_0px_0px_var(--border)]'
                            : 'bg-[var(--card)] text-[var(--foreground)] hover:bg-[#FFE600] hover:text-[#111111] shadow-[2px_2px_0px_0px_var(--border)]'
                        }`}
                      >
                        {category === 'All' ? 'All finds' : category}
                      </button>
                    ))}
                  </div>

                  {/* Sort select & clear */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 bg-[var(--card)] border-2 border-[var(--border)] rounded-xl px-3 py-1.5 shadow-[2px_2px_0px_0px_var(--border)] min-h-[38px]">
                      <ArrowUpDown className="w-3.5 h-3.5 text-[var(--foreground)]" />
                      <select
                        id="sort-select"
                        data-testid="sort-select"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className="bg-transparent text-xs font-black uppercase text-[var(--foreground)] focus:outline-none cursor-pointer"
                      >
                        <option value="popular">Most curious</option>
                        <option value="recent">Recently added</option>
                        <option value="title-asc">Title: A to Z</option>
                      </select>
                    </div>

                    {(selectedCategory !== 'All' || searchTerm) && (
                      <button
                        id="clear-filters-button"
                        data-testid="clear-filters-button"
                        onClick={() => {
                          setSelectedCategory('All');
                          setSearchTerm('');
                        }}
                        className="text-[#FF6B6B] hover:underline font-black text-xs uppercase"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Product Grid */}
                <div className="py-4">
                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-[var(--card)] rounded-2xl border-2 border-[var(--border)] p-4 space-y-4 shadow-[4px_4px_0px_0px_var(--border)] animate-pulse">
                          <div className="aspect-square bg-[var(--muted)] border-2 border-[var(--border)] rounded-xl" />
                          <div className="h-4 bg-[var(--muted)] rounded-md w-3/4" />
                          <div className="h-3 bg-[var(--muted)] rounded-md w-full" />
                          <div className="h-10 bg-[var(--muted)] rounded-xl border-2 border-[var(--border)]" />
                        </div>
                      ))}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div
                      id="empty-state"
                      data-testid="empty-state"
                      className="text-center py-16 bg-[var(--card)] rounded-2xl border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] max-w-lg mx-auto p-8"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#FFE600] border-2 border-[#111111] text-[#111111] flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_0px_#111111] text-2xl">
                        🦝
                      </div>
                      <h3 className="text-lg font-display font-extrabold text-[var(--foreground)]">No matching finds</h3>
                      <p className="text-xs text-[var(--muted-text)] mt-1 font-bold">
                        Try adjusting your search or category filters to discover products.
                      </p>
                      <button
                        id="empty-clear-button"
                        data-testid="empty-clear-button"
                        onClick={() => {
                          setSelectedCategory('All');
                          setSearchTerm('');
                        }}
                        className="mt-5 px-5 py-2.5 bg-[#FF5722] text-white border-2 border-[#111111] rounded-xl text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_#111111] hover:translate-y-0.5"
                      >
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    <div
                      id="product-grid"
                      data-testid="product-grid"
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                    >
                      {filteredProducts.map((product, idx) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          index={idx}
                          bentoVariant={getBentoVariantForIndex(product, idx)}
                          onQuickView={p => setQuickViewProduct(p)}
                          onAffiliateClick={handleAffiliateClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
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

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}

