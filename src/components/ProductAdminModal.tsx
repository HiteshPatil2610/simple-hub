import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Link as LinkIcon,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';

interface ProductAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Partial<Product>) => Promise<void>;
  editingProduct: Product | null;
}

const CATEGORIES = [
  'Tech & Gadgets',
  'Desk & Office',
  'Home & Living',
  'Quirky Finds',
  'Fun & Novelty',
];

const SAMPLE_IMAGES = [
  { label: 'Floating Lamp', url: 'https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?w=800&auto=format&fit=crop&q=80' },
  { label: 'Capybara Light', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80' },
  { label: 'Galaxy Projector', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80' },
  { label: 'Clicky Switch', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80' },
  { label: 'Retro Speaker', url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80' },
];

export const ProductAdminModal: React.FC<ProductAdminModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingProduct,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageFileSize, setImageFileSize] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingProduct) {
      setTitle(editingProduct.title || '');
      setDescription(editingProduct.description || '');
      setCategory(editingProduct.category || CATEGORIES[0]);
      setImageUrl(editingProduct.imageUrl || '');
      setAffiliateUrl(editingProduct.affiliateUrl || '');
      setImageFileName(editingProduct.title ? 'Current product image' : '');
      setImageFileSize('');
    } else {
      setTitle('');
      setDescription('');
      setCategory(CATEGORIES[0]);
      setImageUrl('');
      setAffiliateUrl('');
      setImageFileName('');
      setImageFileSize('');
    }
    setError('');
    setIsDragging(false);
    setShowUrlFallback(false);
  }, [editingProduct, isOpen]);

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Compress image client-side to keep uploads snappy and fast
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image file'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Process a device file
  const handleProcessFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WEBP, etc.) from your device.');
      return;
    }

    try {
      setIsUploading(true);
      setError('');
      setImageFileName(file.name);
      setImageFileSize(formatBytes(file.size));

      // Fast client-side compression
      const compressedDataUrl = await compressImage(file);

      // Upload to server
      const uploadedUrl = await api.uploadImage(compressedDataUrl, file.name);
      setImageUrl(uploadedUrl);
    } catch (err: any) {
      console.error('File upload failed:', err);
      setError(err?.message || 'Failed to upload image. Please try again or use another image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImageFileName('');
    setImageFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a product title.');
      return;
    }
    if (!affiliateUrl.trim()) {
      setError('Please paste your direct Amazon affiliate link.');
      return;
    }
    if (!imageUrl.trim()) {
      setError('Please upload a product image from your device storage.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      // Extract tag if present in the affiliate link, else fallback
      let extractedTag = 'raccoonhub-20';
      try {
        const urlMatch = affiliateUrl.match(/[?&]tag=([a-zA-Z0-9_-]+)/);
        if (urlMatch && urlMatch[1]) {
          extractedTag = urlMatch[1];
        }
      } catch {
        // use default
      }

      await onSave({
        title: title.trim(),
        description: description.trim() || 'Curated Amazon find hand-picked for Raccoon Hub.',
        category,
        platform: 'Amazon',
        price: editingProduct?.price || 0,
        rating: editingProduct?.rating || 5,
        reviewCount: editingProduct?.reviewCount || 100,
        imageUrl: imageUrl.trim(),
        affiliateUrl: affiliateUrl.trim(),
        affiliateTag: extractedTag,
        commissionRate: editingProduct?.commissionRate || 4,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="product-admin-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#2D3436]/70 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative bg-[#FFFBF0] rounded-[2.2rem] max-w-xl w-full max-h-[92vh] flex flex-col border-4 border-[#2D3436] shadow-[8px_8px_0px_0px_rgba(45,52,54,1)] overflow-hidden z-10 my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-3 border-[#2D3436] p-5 sm:p-6 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFE66D] border-2 border-[#2D3436] flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                  🦝
                </div>
                <div>
                  <span className="text-[10px] font-black text-[#FF6B6B] uppercase tracking-wider">
                    Raccoon Hub Catalog
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-[#2D3436] leading-tight">
                    {editingProduct ? 'Edit Amazon Product' : 'Add New Amazon Product'}
                  </h2>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-[#FF6B6B] hover:bg-[#ff5252] text-white border-2 border-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] flex items-center justify-center transition"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </motion.button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl bg-[#FF6B6B]/20 border-2 border-[#2D3436] text-[#2D3436] text-xs font-black flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]"
                >
                  <AlertCircle className="w-4 h-4 text-[#FF6B6B] shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <form id="product-admin-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Product Name */}
                <div>
                  <label className="block font-black uppercase text-[#2D3436] mb-1.5 text-[11px] tracking-wider">
                    Product Name *
                  </label>
                  <input
                    id="admin-product-title"
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Floating Magnetic Cloud Levitating Lamp"
                    className="w-full p-3 bg-white border-2 border-[#2D3436] rounded-xl text-[#2D3436] font-bold shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] transition text-xs sm:text-sm min-h-[44px]"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block font-black uppercase text-[#2D3436] mb-1.5 text-[11px] tracking-wider">
                    Category *
                  </label>
                  <select
                    id="admin-product-category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full p-3 bg-white border-2 border-[#2D3436] rounded-xl text-[#2D3436] font-bold shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] transition text-xs sm:text-sm min-h-[44px]"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Small Description */}
                <div>
                  <label className="block font-black uppercase text-[#2D3436] mb-1.5 text-[11px] tracking-wider">
                    Small Description *
                  </label>
                  <textarea
                    id="admin-product-desc"
                    rows={2}
                    required
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="A concise, fun summary of what makes this product amazing..."
                    className="w-full p-3 bg-white border-2 border-[#2D3436] rounded-xl text-[#2D3436] font-medium shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B] transition text-xs sm:text-sm leading-relaxed"
                  />
                </div>

                {/* Direct Amazon Affiliate Link Input */}
                <div className="p-4 bg-[#E0FBFC] border-3 border-[#2D3436] rounded-2xl space-y-2.5 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 text-[#2D3436] font-black uppercase text-xs">
                      <LinkIcon className="w-4 h-4 stroke-[2.5] text-[#2D3436]" />
                      <span>Direct Amazon Affiliate Link *</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#FFE66D] border border-[#2D3436] text-[10px] font-black text-[#2D3436]">
                      Direct Link
                    </span>
                  </div>

                  <p className="text-[11px] text-[#2D3436]/80 font-medium">
                    Paste your direct Amazon affiliate link (e.g. <span className="font-mono font-bold">https://amzn.to/...</span> or your full Amazon affiliate link). No need for separate product URL or tag setup!
                  </p>

                  <input
                    id="admin-product-aff-url"
                    type="url"
                    required
                    value={affiliateUrl}
                    onChange={e => setAffiliateUrl(e.target.value)}
                    placeholder="https://amzn.to/3xyz or https://www.amazon.com/dp/B08XYZ?tag=yourtag-20"
                    className="w-full p-3 bg-white border-2 border-[#2D3436] rounded-xl text-[#2D3436] font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4] transition min-h-[44px]"
                  />

                  {affiliateUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-[11px] text-[#2D3436] font-mono bg-white p-2.5 rounded-lg border border-[#2D3436] flex items-center gap-1.5 truncate"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-bold">Affiliate target set:</span>
                      <span className="truncate text-[#2D3436]/80">{affiliateUrl}</span>
                    </motion.div>
                  )}
                </div>

                {/* Upload Image from Device Storage */}
                <div className="p-4 bg-white border-3 border-[#2D3436] rounded-2xl space-y-3 shadow-[3px_3px_0px_0px_rgba(45,52,54,1)]">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 text-[#2D3436] font-black uppercase text-xs">
                      <ImageIcon className="w-4 h-4 text-[#2D3436]" />
                      <span>Upload Product Image *</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#4ECDC4] border border-[#2D3436] text-[10px] font-black text-[#2D3436]">
                      From Device Storage
                    </span>
                  </div>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {/* Upload State / Preview */}
                  {imageUrl ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-3.5 p-3 bg-[#FFFBF0] rounded-xl border-2 border-[#2D3436]"
                    >
                      <img
                        src={imageUrl}
                        alt="Product Preview"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-xl object-cover border-2 border-[#2D3436] bg-white shrink-0 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-black text-xs text-[#2D3436] truncate">
                            {imageFileName || 'Image Ready'}
                          </span>
                        </div>
                        {imageFileSize && (
                          <span className="text-[10px] font-mono text-[#2D3436]/70 block mt-0.5">
                            Size: {imageFileSize}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-lg bg-[#FFE66D] border border-[#2D3436] text-[10px] font-black text-[#2D3436] uppercase shadow-[1px_1px_0px_0px_rgba(45,52,54,1)]"
                          >
                            Replace Image
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-2.5 py-1 rounded-lg bg-[#FF6B6B] border border-[#2D3436] text-[10px] font-black text-white uppercase shadow-[1px_1px_0px_0px_rgba(45,52,54,1)] flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    /* Dropzone */
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 text-center ${
                        isDragging
                          ? 'border-[#FF6B6B] bg-[#FF6B6B]/10 scale-[1.01]'
                          : 'border-[#2D3436] bg-[#FFFBF0] hover:bg-[#FFE66D]/20'
                      }`}
                    >
                      {isUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-8 h-8 text-[#FF6B6B] animate-spin" />
                          <p className="font-black text-xs text-[#2D3436]">Processing and uploading image...</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-[#FFE66D] border-2 border-[#2D3436] flex items-center justify-center mb-2 shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                            <UploadCloud className="w-6 h-6 text-[#2D3436]" />
                          </div>
                          <p className="font-black text-xs sm:text-sm text-[#2D3436]">
                            Click to browse image from your device
                          </p>
                          <p className="text-[11px] text-[#2D3436]/70 mt-1 font-medium">
                            Supports PNG, JPG, WEBP, GIF or drag & drop here
                          </p>
                          <span className="mt-3 px-3 py-1.5 rounded-xl bg-[#4ECDC4] border-2 border-[#2D3436] text-[11px] font-black uppercase text-[#2D3436] shadow-[2px_2px_0px_0px_rgba(45,52,54,1)]">
                            Select Photo from Storage
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Fallback presets or paste URL option */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUrlFallback(!showUrlFallback)}
                      className="text-[11px] font-black text-[#2D3436]/70 hover:text-[#2D3436] underline"
                    >
                      {showUrlFallback ? 'Hide sample presets' : 'Or choose from sample presets / paste URL'}
                    </button>

                    {showUrlFallback && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2.5 space-y-2 pt-2 border-t border-[#2D3436]/10"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-[#2D3436] font-black uppercase">Sample presets:</span>
                          {SAMPLE_IMAGES.map((img, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setImageUrl(img.url);
                                setImageFileName(img.label);
                                setImageFileSize('Preset');
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border border-[#2D3436] transition ${
                                imageUrl === img.url
                                  ? 'bg-[#FFE66D] text-[#2D3436]'
                                  : 'bg-white text-[#2D3436] hover:bg-[#FFE66D]/30'
                              }`}
                            >
                              {img.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={e => {
                            setImageUrl(e.target.value);
                            setImageFileName('Web Image URL');
                            setImageFileSize('');
                          }}
                          placeholder="Or paste direct image URL (https://...)"
                          className="w-full p-2 bg-white border border-[#2D3436] rounded-lg text-[11px] font-mono text-[#2D3436]"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Modal Footer / Actions */}
            <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t-3 border-[#2D3436] bg-white shrink-0">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border-2 border-[#2D3436] bg-white text-[#2D3436] font-black uppercase text-xs hover:bg-[#2D3436]/5 transition shadow-[2px_2px_0px_0px_rgba(45,52,54,1)] min-h-[44px]"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                id="save-product-btn"
                type="submit"
                form="product-admin-form"
                disabled={isSubmitting || isUploading}
                className="px-6 py-2.5 rounded-xl bg-[#4ECDC4] hover:bg-[#3dbdb5] text-[#2D3436] font-black uppercase tracking-wider border-2 border-[#2D3436] transition shadow-[3px_3px_0px_0px_rgba(45,52,54,1)] active:translate-y-0.5 disabled:opacity-50 min-h-[44px] flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : editingProduct ? (
                  'Update Product'
                ) : (
                  'Add to Raccoon Hub'
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
