import { Product, ClickEvent, AnalyticsSummary, ConversionEvent } from '../types';

const OWNER_KEY_STORAGE = 'owner_hub_key';

export function getOwnerKey(): string {
  return sessionStorage.getItem(OWNER_KEY_STORAGE) || '';
}

export function setOwnerKey(key: string): void {
  sessionStorage.setItem(OWNER_KEY_STORAGE, key);
}

export function clearOwnerKey(): void {
  sessionStorage.removeItem(OWNER_KEY_STORAGE);
}

function ownerHeaders(): Record<string, string> {
  const key = getOwnerKey();
  return key ? { 'x-owner-key': key } : {};
}

export const api = {
  // Verify a candidate owner key against the server. Throws if invalid.
  async verifyOwnerKey(key: string): Promise<boolean> {
    const res = await fetch('/api/owner/verify', {
      method: 'POST',
      headers: { 'x-owner-key': key },
    });
    return res.ok;
  },

  // Products
  async getProducts(params?: { category?: string; search?: string; platform?: string }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.platform) query.append('platform', params.platform);

    const res = await fetch(`/api/products?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async getProduct(id: string): Promise<Product> {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create product');
    }
    return res.json();
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update product');
    }
    return res.json();
  },

  async deleteProduct(id: string): Promise<boolean> {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { ...ownerHeaders() } });
    if (!res.ok) throw new Error('Failed to delete product');
    return true;
  },

  // Upload image from device storage
  async uploadImage(dataUrl: string, filename?: string): Promise<string> {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
        body: JSON.stringify({ dataUrl, filename }),
      });
      if (!res.ok) {
        // A real validation/auth failure (bad type, too large, unauthorized)
        // should surface to the owner, not silently store a multi-MB base64
        // string as the product's imageUrl.
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload image');
      }
      const data = await res.json();
      return data.imageUrl || dataUrl;
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') throw err;
      // Network-level failure only: fall back to the raw dataUrl so the
      // image isn't lost while offline/unreachable.
      return dataUrl;
    }
  },

  // Redirection and Tracking
  getRedirectUrl(productId: string, params?: { utm_source?: string; utm_medium?: string; utm_campaign?: string; subid?: string }): string {
    const query = new URLSearchParams();
    if (params?.utm_source) query.append('utm_source', params.utm_source);
    if (params?.utm_medium) query.append('utm_medium', params.utm_medium);
    if (params?.utm_campaign) query.append('utm_campaign', params.utm_campaign);
    if (params?.subid) query.append('subid', params.subid);
    return `/api/redirect/${productId}?${query.toString()}`;
  },

  async trackClick(data: {
    productId: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    subid?: string;
    referrer?: string;
  }): Promise<{ success: boolean; destinationUrl: string; clickId: string }> {
    const res = await fetch('/api/track/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to track click');
    return res.json();
  },

  // Analytics
  async getAnalytics(): Promise<AnalyticsSummary> {
    const res = await fetch('/api/analytics', { headers: { ...ownerHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async getPublicAnalytics(): Promise<{ clicksToday: number }> {
    const res = await fetch('/api/analytics/public');
    if (!res.ok) throw new Error('Failed to fetch public analytics');
    return res.json();
  },

  async recordConversion(data: {
    productId: string;
    clickId?: string;
  }): Promise<ConversionEvent> {
    const res = await fetch('/api/analytics/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record conversion');
    return res.json();
  },

  async resetAnalytics(): Promise<boolean> {
    const res = await fetch('/api/analytics/reset', { method: 'POST', headers: { ...ownerHeaders() } });
    if (!res.ok) throw new Error('Failed to reset analytics');
    return true;
  },
};
