import { Product, ClickEvent, AnalyticsSummary, ConversionEvent } from '../types';

// ④ Multi-user auth: store JWT in session storage instead of the raw owner key.
const TOKEN_STORAGE = 'owner_hub_token';

export function getAuthToken(): string {
  return sessionStorage.getItem(TOKEN_STORAGE) || '';
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE, token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE);
}

// Legacy aliases for compatibility with components that still call setOwnerKey.
// They now write/read the JWT token slot instead.
/** @deprecated Use setAuthToken() */
export const setOwnerKey = setAuthToken;
/** @deprecated Use clearAuthToken() */
export const clearOwnerKey = clearAuthToken;
/** @deprecated Use getAuthToken() */
export const getOwnerKey = getAuthToken;

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // ④ Login with username + password, returns JWT token.
  async login(username: string, password: string): Promise<{ token: string; username: string; role: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setAuthToken(data.token);
    return data;
  },

  // Legacy passcode verify — kept for compatibility. New code should use login().
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
    if (params?.search)   query.append('search',   params.search);
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
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update product');
    }
    return res.json();
  },

  async deleteProduct(id: string): Promise<boolean> {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return true;
  },

  // Upload image from device storage
  async uploadImage(dataUrl: string, filename?: string): Promise<string> {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ dataUrl, filename }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload image');
      }
      const data = await res.json();
      return data.imageUrl || dataUrl;
    } catch (err) {
      if (err instanceof Error && err.message !== 'Failed to fetch') throw err;
      return dataUrl;
    }
  },

  // Redirection and Tracking
  getRedirectUrl(productId: string, params?: { utm_source?: string; utm_medium?: string; utm_campaign?: string; subid?: string }): string {
    const query = new URLSearchParams();
    if (params?.utm_source)   query.append('utm_source',   params.utm_source);
    if (params?.utm_medium)   query.append('utm_medium',   params.utm_medium);
    if (params?.utm_campaign) query.append('utm_campaign', params.utm_campaign);
    if (params?.subid)        query.append('subid',        params.subid);
    return `/api/redirect/${productId}?${query.toString()}`;
  },

  async trackClick(data: {
    productId: string;
    utmSource?:   string;
    utmMedium?:   string;
    utmCampaign?: string;
    subid?:       string;
    referrer?:    string;
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
    const res = await fetch('/api/analytics', { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async getPublicAnalytics(): Promise<{ clicksToday: number }> {
    const res = await fetch('/api/analytics/public');
    if (!res.ok) throw new Error('Failed to fetch public analytics');
    return res.json();
  },

  async recordConversion(data: { productId: string; clickId?: string }): Promise<ConversionEvent> {
    const res = await fetch('/api/analytics/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record conversion');
    return res.json();
  },

  async resetAnalytics(): Promise<boolean> {
    const res = await fetch('/api/analytics/reset', {
      method: 'POST',
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error('Failed to reset analytics');
    return true;
  },
};
