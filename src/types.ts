export interface Product {
  id: string;
  title: string;
  description: string;
  category: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  platform: 'Amazon';
  affiliateUrl: string;
  affiliateTag?: string;
  customSubId?: string;
  badge?: string;
  featured?: boolean;
  createdAt: string;
}

export interface ClickEvent {
  id: string;
  productId: string;
  productTitle: string;
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
  timestamp: string;
  platform: string;
}

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueVisitors: number;
  totalConversions: number;
  conversionRate: number; // percentage
  clicksToday: number;
  topProducts: {
    productId: string;
    productTitle: string;
    clicks: number;
    conversions: number;
    conversionRate: number;
    platform: string;
    imageUrl: string;
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
