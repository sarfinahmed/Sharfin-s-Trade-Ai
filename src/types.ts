import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: any;
  credits: number;
  role: 'admin' | 'user';
  isBlocked: boolean;
  walletBalance?: number;
  preferredCurrency?: 'BDT' | 'USD';
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
  category: 'game_topup' | 'subscription' | 'product' | 'offer' | 'others';
  requirements: string[];
  conditions: string;
  isActive: boolean;
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
  createdAt: any;
}
