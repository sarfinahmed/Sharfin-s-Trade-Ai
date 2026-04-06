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
}

export interface CreditRequest {
  id?: string;
  userId: string;
  userEmail: string;
  amount: number;
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
}

export interface UsageHistory {
  id?: string;
  userId: string;
  userEmail: string;
  action: string;
  timestamp: any;
  creditsDeducted: number;
}
