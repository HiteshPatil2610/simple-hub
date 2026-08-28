export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  platform: 'Amazon' | 'TikTok Shop' | 'AliExpress' | 'Etsy' | 'Other';
  affiliateUrl: string;
  affiliateTag?: string;
  customSubId?: string;
  badge?: string;
  featured?: boolean;
  commissionRate?: number; // e.g. 5 means 5%
  createdAt: string;
}

export interface ClickEvent {
  id: string;
  productId: string;
  productTitle: string;
  productPrice: number;
  platform: string;
  category: string;
  timestamp: string; // ISO string
  referrer: string;
  device: 'Mobile' | 'Desktop' | 'Tablet';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  destinationUrl: string;
  visitorHash?: string; // anonymous per-day fingerprint, used for real unique-visitor counts
}

export interface ConversionEvent {
  id: string;
  clickId?: string;
  productId: string;
  productTitle: string;
  orderValue: number;
  commissionEarned: number;
  timestamp: string;
  platform: string;
}

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueVisitors: number;
  totalConversions: number;
  conversionRate: number; // percentage
  estimatedGrossVolume: number;
  estimatedCommission: number;
  clicksToday: number;
  topProducts: {
    productId: string;
    productTitle: string;
    clicks: number;
    conversions: number;
    conversionRate: number;
    platform: string;
    imageUrl: string;
    price: number;
  }[];
  clicksByDay: {
    date: string;
    clicks: number;
    conversions: number;
  }[];
  platformBreakdown: {
    platform: string;
    clicks: number;
    percentage: number;
  }[];
  categoryBreakdown: {
    category: string;
    clicks: number;
    percentage: number;
  }[];
  deviceBreakdown: {
    device: string;
    clicks: number;
    percentage: number;
  }[];
  recentClicks: ClickEvent[];
}

export type ViewMode = 'shop' | 'owner' | 'analytics' | 'admin';
