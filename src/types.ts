import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: any;
  credits: number;
  creditBalances?: {
    bronze: number;
    silver: number;
    gold: number;
    diamond: number;
  };
  role: 'admin' | 'user';
  isBlocked: boolean;
  walletBalance?: number;
  preferredCurrency?: 'BDT' | 'USD';
  toolLimits?: Record<string, number>;
}

export interface CreditRequest {
  id?: string;
  userId: string;
  userEmail: string;
  amount: number;
  type?: 'credit' | 'money';
  status: 'pending' | 'approved' | 'rejected';
  paymentMethod: string;
  transactionId: string;
  createdAt: any;
}

export interface AppSettings {
  appName: string;
  appSubtitle?: string;
  logoUrl: string;
  defaultCredits: number;
  paymentMethodInfo: string;
  globalNotice?: string;
  geminiApiKey?: string;
  maintenanceMode?: boolean;
  supportTelegram?: string;
  supportWhatsapp?: string;
  supportPhone?: string;
  promoBannerUrl?: string;
}

export interface UsageHistory {
  id?: string;
  userId: string;
  userEmail: string;
  action: string;
  timestamp: any;
  creditsDeducted: number;
}

export interface PaymentMethod {
  id?: string;
  name: string;
  details: string;
  instructions: string;
  isActive: boolean;
  qrCodeUrl?: string;
}

export interface Product {
  id?: string;
  title: string;
  description: string;
  priceDisplay: string;
  price?: number;
  imageUrl?: string;
  imageRatio?: '1:1' | '16:9' | '4:3' | 'auto';
  category: 'game_topup' | 'subscription' | 'product' | 'offer' | 'others';
  requirements: string[];
  conditions: string;
  isActive: boolean;
  isAutoUnipin?: boolean;
  createdAt?: any;
}

export interface Order {
  id?: string;
  userId: string;
  userEmail: string;
  productId: string;
  productTitle: string;
  priceDisplay: string;
  price?: number;
  status: 'pending' | 'completed' | 'rejected';
  userInputs: Record<string, string>;
  paymentType?: 'wallet' | 'direct';
  paymentMethodName: string;
  transactionId: string;
  unipinCode?: string;
  createdAt: any;
}

export interface UnipinCode {
  id?: string;
  productId: string;
  code: string;
  status: 'unused' | 'used';
  usedBy?: string;
  usedAt?: any;
  createdAt: any;
}

export interface AITool {
  id?: string;
  title: string;
  description: string;
  type: 'text_to_image' | 'image_to_image' | 'text_to_video' | 'image_to_video' | 'text_to_text';
  apiKey?: string;
  model: string;
  systemPrompt: string;
  userPromptAllowed: boolean;
  cost: number;
  costType: 'credit' | 'wallet' | 'bronze' | 'silver' | 'gold' | 'diamond';
  defaultFreeUses: number;
  isActive: boolean;
  createdAt?: any;
}

export interface AIToolUsage {
  id?: string;
  userId: string;
  toolId: string;
  createdAt: any;
}
