import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, CreditRequest, AppSettings, UsageHistory, PaymentMethod, Product, Order, AITool } from '../types';
import { Users, CreditCard, Settings, Activity, Trash2, CheckCircle, XCircle, Shield, ShieldOff, Save, LayoutDashboard, Bell, Plus, Minus, Search, ShoppingBag, Wallet, ShoppingCart, Edit, PlusCircle, Check, Cpu, Zap } from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'requests' | 'history' | 'settings' | 'payments' | 'store' | 'orders' | 'ai_tools' | 'referrals'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [aiTools, setAiTools] = useState<AITool[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralSettings, setReferralSettings] = useState({
    isActive: false,
    rewardAmount: 50,
    rewardType: 'wallet'
  });
  const [userSearch, setUserSearch] = useState('');
  
  // Modals/Forms state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
  
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showAiToolForm, setShowAiToolForm] = useState(false);
  const [editingAiTool, setEditingAiTool] = useState<Partial<AITool> | null>(null);
  const [editingUserLimits, setEditingUserLimits] = useState<UserProfile | null>(null);

  const [settings, setSettings] = useState<AppSettings>({
    appName: "Sharfin's AI",
    logoUrl: "",
    defaultCredits: 5,
    paymentMethodInfo: "Binance Dollar (BUSD) - Wallet: 0x..."
  });

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Listen to Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
    });

    // Listen to Requests
    const qRequests = query(collection(db, 'creditRequests'), orderBy('createdAt', 'desc'));
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      setRequests(snap.docs.map(d => ({ ...d.data(), id: d.id } as CreditRequest)));
    });

    // Listen to History
    const qHistory = query(collection(db, 'usageHistory'), orderBy('timestamp', 'desc'));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setHistory(snap.docs.map(d => ({ ...d.data(), id: d.id } as UsageHistory)));
    });

    // Listen to Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'appSettings'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AppSettings);
      }
    });

    // Listen to Payment Methods
    const unsubPayments = onSnapshot(collection(db, 'paymentMethods'), (snap) => {
      setPaymentMethods(snap.docs.map(d => ({ ...d.data(), id: d.id } as PaymentMethod)));
    });

    // Listen to Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Product)));
    });

    // Listen to Orders
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)));
    });

    // Listen to AI Tools
    const unsubAiTools = onSnapshot(collection(db, 'aiTools'), (snap) => {
      setAiTools(snap.docs.map(d => ({ ...d.data(), id: d.id } as AITool)));
    });

    // Listen to Referrals
    const qReferrals = query(collection(db, 'referrals'), orderBy('createdAt', 'desc'));
    const unsubReferrals = onSnapshot(qReferrals, (snap) => {
      setReferrals(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    // Listen to Referral Settings
    const unsubRefSettings = onSnapshot(doc(db, 'settings', 'referral'), (docSnap) => {
      if (docSnap.exists()) {
        setReferralSettings(docSnap.data() as any);
      }
    });

    return () => {
      unsubUsers();
      unsubRequests();
      unsubHistory();
      unsubSettings();
      unsubPayments();
      unsubProducts();
      unsubOrders();
      unsubAiTools();
      unsubReferrals();
      unsubRefSettings();
    };
  }, []);

  const handleUpdateUser = async (uid: string, data: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), data);
      showToast("User updated successfully");
    } catch (err) {
      console.error("Error updating user:", err);
      showToast("Failed to update user", "error");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        showToast("User deleted successfully");
      } catch (err) {
        console.error("Error deleting user:", err);
        showToast("Failed to delete user", "error");
      }
    }
  };

  const handleRequestAction = async (request: CreditRequest, action: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'creditRequests', request.id!), { status: action });
      if (action === 'approved') {
        const userDoc = users.find(u => u.uid === request.userId);
        if (userDoc) {
          if (request.type === 'money') {
            await updateDoc(doc(db, 'users', request.userId), {
              walletBalance: (userDoc.walletBalance || 0) + request.amount
            });
          } else {
            await updateDoc(doc(db, 'users', request.userId), {
              credits: (userDoc.credits || 0) + request.amount
            });
          }
        }
      }
      showToast(`Request ${action} successfully`);
    } catch (err) {
      console.error("Error updating request:", err);
      showToast("Failed to update request", "error");
    }
  };

  const handleSaveSettings = async () => {
    try {
      const dataToSave = Object.fromEntries(Object.entries(settings).filter(([_, v]) => v !== undefined));
      await updateDoc(doc(db, 'settings', 'appSettings'), dataToSave);
      showToast("Settings saved successfully!");
    } catch (err) {
      console.error("Error saving settings:", err);
      // If it doesn't exist, create it
      try {
        const { setDoc } = await import('firebase/firestore');
        const dataToSave = Object.fromEntries(Object.entries(settings).filter(([_, v]) => v !== undefined));
        await setDoc(doc(db, 'settings', 'appSettings'), dataToSave);
        showToast("Settings saved successfully!");
      } catch (e) {
        showToast("Failed to save settings", "error");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-[#131722] border-r border-[#22283A] p-4 md:p-6 flex flex-col shrink-0">
        <h2 className="text-xl font-bold mb-4 md:mb-8 text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6]">Admin Panel</h2>
        <nav className="flex overflow-x-auto md:flex-col space-x-2 md:space-x-0 md:space-y-2 flex-grow pb-2 md:pb-0 custom-scrollbar">
          <button onClick={() => setActiveTab('overview')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'overview' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span className="hidden md:inline">Overview</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Users className="w-5 h-5" />
            <span className="hidden md:inline">Users</span>
          </button>
          <button onClick={() => setActiveTab('requests')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'requests' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <CreditCard className="w-5 h-5" />
            <span className="hidden md:inline">Deposit Requests</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'history' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Activity className="w-5 h-5" />
            <span className="hidden md:inline">Usage History</span>
          </button>
          
          <div className="hidden md:block pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-[#8A93A6] uppercase tracking-wider">Store & Billing</p>
          </div>
          
          <button onClick={() => setActiveTab('payments')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'payments' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Wallet className="w-5 h-5" />
            <span className="hidden md:inline">Payment Methods</span>
          </button>
          <button onClick={() => setActiveTab('store')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'store' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <ShoppingBag className="w-5 h-5" />
            <span className="hidden md:inline">Products & Offers</span>
          </button>
          <button onClick={() => setActiveTab('orders')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'orders' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <ShoppingCart className="w-5 h-5" />
            <span className="hidden md:inline">Store Orders</span>
          </button>

          <div className="hidden md:block pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-[#8A93A6] uppercase tracking-wider">System</p>
          </div>

          <button onClick={() => setActiveTab('ai_tools')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'ai_tools' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Cpu className="w-5 h-5" />
            <span className="hidden md:inline">AI Tools</span>
          </button>
          <button onClick={() => setActiveTab('referrals')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'referrals' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Users className="w-5 h-5" />
            <span className="hidden md:inline">Referrals</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`shrink-0 md:w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Settings className="w-5 h-5" />
            <span className="hidden md:inline">Settings</span>
          </button>
        </nav>
        
        <div className="hidden md:block mt-auto pt-6 border-t border-[#22283A]">
          <a href="/" className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors text-[#8A93A6] hover:bg-[#1A1F2E] hover:text-white">
            <Activity className="w-5 h-5" />
            <span>Back to App</span>
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow p-4 md:p-10 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Dashboard Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[#8A93A6] font-medium">Total Users</h4>
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-3xl font-bold text-white">{users.length}</p>
              </div>
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[#8A93A6] font-medium">Pending Requests</h4>
                  <CreditCard className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-3xl font-bold text-white">{requests.filter(r => r.status === 'pending').length}</p>
              </div>
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[#8A93A6] font-medium">Total Analyses</h4>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-white">{history.length}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-2xl font-bold">Registered Users</h3>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8A93A6]" />
                <input 
                  type="text" 
                  placeholder="Search by email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-[#131722] border border-[#22283A] rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors w-full sm:w-64"
                />
              </div>
            </div>
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#1A1F2E] text-[#8A93A6] text-sm uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Ai Credits</th>
                    <th className="px-6 py-4">Bronze</th>
                    <th className="px-6 py-4">Silver</th>
                    <th className="px-6 py-4">Gold</th>
                    <th className="px-6 py-4">Diamond</th>
                    <th className="px-6 py-4">Wallet Balance</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283A]">
                  {users.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                    <tr key={u.uid} className="hover:bg-[#1A1F2E]/50 transition-colors">
                      <td className="px-6 py-4">{u.email}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            value={u.credits || 0}
                            onChange={(e) => handleUpdateUser(u.uid, { credits: parseInt(e.target.value) || 0 })}
                            className="w-16 bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-white"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            value={u.creditBalances?.bronze || 0}
                            onChange={(e) => handleUpdateUser(u.uid, { creditBalances: { ...u.creditBalances, bronze: parseInt(e.target.value) || 0 } })}
                            className="w-16 bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-[#CD7F32]"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            value={u.creditBalances?.silver || 0}
                            onChange={(e) => handleUpdateUser(u.uid, { creditBalances: { ...u.creditBalances, silver: parseInt(e.target.value) || 0 } })}
                            className="w-16 bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-[#C0C0C0]"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            value={u.creditBalances?.gold || 0}
                            onChange={(e) => handleUpdateUser(u.uid, { creditBalances: { ...u.creditBalances, gold: parseInt(e.target.value) || 0 } })}
                            className="w-16 bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-[#FFD700]"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            value={u.creditBalances?.diamond || 0}
                            onChange={(e) => handleUpdateUser(u.uid, { creditBalances: { ...u.creditBalances, diamond: parseInt(e.target.value) || 0 } })}
                            className="w-16 bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-[#00FFFF]"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            value={u.walletBalance || 0}
                            onChange={(e) => handleUpdateUser(u.uid, { walletBalance: parseInt(e.target.value) || 0 })}
                            className="w-24 bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-white"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={u.role || 'user'}
                          onChange={(e) => handleUpdateUser(u.uid, { role: e.target.value as 'admin' | 'user' })}
                          className="bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-white"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${u.isBlocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                          {u.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex space-x-2">
                        <button 
                          onClick={() => setEditingUserLimits(u)}
                          className="p-2 rounded hover:bg-[#22283A] text-purple-400 hover:text-purple-300 transition-colors"
                          title="Manage AI Tool Limits"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleUpdateUser(u.uid, { isBlocked: !u.isBlocked })}
                          className="p-2 rounded hover:bg-[#22283A] text-[#8A93A6] hover:text-white transition-colors"
                          title={u.isBlocked ? "Unblock User" : "Block User"}
                        >
                          {u.isBlocked ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.uid)}
                          className="p-2 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Credit Requests</h3>
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#1A1F2E] text-[#8A93A6] text-sm uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Method & TX ID</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283A]">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-[#1A1F2E]/50 transition-colors">
                      <td className="px-6 py-4">{r.userEmail}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${r.type === 'money' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {r.type === 'money' ? 'MONEY' : 'CREDIT'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-[#A855F7]">+{r.amount}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm">{r.paymentMethod}</div>
                        <div className="text-xs text-[#8A93A6]">{r.transactionId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          r.status === 'approved' ? 'bg-green-500/20 text-green-400' : 
                          r.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex space-x-2">
                        {r.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleRequestAction(r, 'approved')}
                              className="p-2 rounded hover:bg-green-500/20 text-green-400 transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleRequestAction(r, 'rejected')}
                              className="p-2 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#8A93A6]">No deposit requests found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Usage History</h3>
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#1A1F2E] text-[#8A93A6] text-sm uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Credits Deducted</th>
                    <th className="px-6 py-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283A]">
                  {history.map(h => (
                    <tr key={h.id} className="hover:bg-[#1A1F2E]/50 transition-colors">
                      <td className="px-6 py-4">{h.userEmail}</td>
                      <td className="px-6 py-4">{h.action}</td>
                      <td className="px-6 py-4 text-red-400">-{h.creditsDeducted}</td>
                      <td className="px-6 py-4 text-[#8A93A6] text-sm">
                        {h.timestamp?.toDate ? h.timestamp.toDate().toLocaleString() : 'Just now'}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-[#8A93A6]">No usage history found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Payment Methods</h3>
              <button 
                onClick={() => {
                  setEditingPayment({ name: '', details: '', instructions: '', isActive: true });
                  setShowPaymentForm(true);
                }}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Add Method</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {paymentMethods.map(pm => (
                <div key={pm.id} className={`bg-[#131722] border ${pm.isActive ? 'border-purple-500/50' : 'border-[#22283A]'} rounded-2xl p-6 relative`}>
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button 
                      onClick={() => { setEditingPayment(pm); setShowPaymentForm(true); }}
                      className="p-2 bg-[#22283A] hover:bg-[#2A3143] rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 text-[#8A93A6]" />
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm('Delete this payment method?')) {
                          await deleteDoc(doc(db, 'paymentMethods', pm.id!));
                        }
                      }}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">{pm.name}</h4>
                  <div className="space-y-2 text-sm text-[#8A93A6]">
                    <p><strong className="text-white">Details:</strong> {pm.details}</p>
                    <p><strong className="text-white">Instructions:</strong> {pm.instructions}</p>
                    <p><strong className="text-white">Status:</strong> {pm.isActive ? <span className="text-green-400">Active</span> : <span className="text-red-400">Inactive</span>}</p>
                  </div>
                </div>
              ))}
              {paymentMethods.length === 0 && (
                <div className="col-span-full text-center py-10 text-[#8A93A6]">
                  No payment methods added yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'store' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold">Products & Offers</h3>
              <button 
                onClick={() => {
                  setEditingProduct({ title: '', description: '', priceDisplay: '', category: 'game_topup', requirements: [], conditions: '', isActive: true });
                  setShowProductForm(true);
                }}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => (
                <div key={p.id} className={`bg-[#131722] border ${p.isActive ? 'border-purple-500/50' : 'border-[#22283A]'} rounded-2xl p-6 relative flex flex-col`}>
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button 
                      onClick={() => { setEditingProduct(p); setShowProductForm(true); }}
                      className="p-2 bg-[#22283A] hover:bg-[#2A3143] rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4 text-[#8A93A6]" />
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm('Delete this product?')) {
                          await deleteDoc(doc(db, 'products', p.id!));
                        }
                      }}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">{p.category.replace('_', ' ')}</span>
                  <h4 className="text-xl font-bold text-white mb-1">{p.title}</h4>
                  <p className="text-2xl font-bold text-green-400 mb-4">{p.priceDisplay}</p>
                  <p className="text-sm text-[#8A93A6] mb-4 flex-grow">{p.description}</p>
                  <div className="text-xs text-[#8A93A6] space-y-1">
                    <p><strong className="text-white">Requires:</strong> {p.requirements.join(', ') || 'None'}</p>
                    <p><strong className="text-white">Status:</strong> {p.isActive ? <span className="text-green-400">Active</span> : <span className="text-red-400">Inactive</span>}</p>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <div className="col-span-full text-center py-10 text-[#8A93A6]">
                  No products added yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Store Orders</h3>
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#1A1F2E] text-[#8A93A6] text-sm uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283A]">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-[#1A1F2E]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm text-white">{o.userEmail}</div>
                        <div className="text-xs text-[#8A93A6]">{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : ''}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-white">{o.productTitle}</div>
                        <div className="text-xs text-green-400">{o.priceDisplay}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-[#8A93A6] space-y-1">
                          {Object.entries(o.userInputs || {}).map(([k, v]) => (
                            <div key={k}><strong className="text-white">{k}:</strong> {v}</div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-[#8A93A6]">
                          <strong className="text-white">{o.paymentMethodName}</strong><br/>
                          <span className="text-purple-400">{o.paymentType === 'wallet' ? 'WALLET' : 'DIRECT'}</span><br/>
                          TX: <span className="font-mono text-purple-400">{o.transactionId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          o.status === 'approved' || o.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          o.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {o.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {o.status === 'pending' && (
                          <div className="flex space-x-2">
                            <button 
                              onClick={async () => {
                                await updateDoc(doc(db, 'orders', o.id!), { status: 'completed' });
                              }}
                              className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors"
                              title="Complete Order"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={async () => {
                                await updateDoc(doc(db, 'orders', o.id!), { status: 'rejected' });
                              }}
                              className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                              title="Reject Order"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#8A93A6]">No orders found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'ai_tools' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-2xl font-bold">AI Tools Management</h3>
              <button 
                onClick={() => {
                  setEditingAiTool({
                    title: '',
                    description: '',
                    type: 'image_to_image',
                    model: 'gemini-2.5-flash-image',
                    systemPrompt: '',
                    userPromptAllowed: true,
                    cost: 1,
                    costType: 'credit',
                    defaultFreeUses: 0,
                    isActive: true
                  });
                  setShowAiToolForm(true);
                }}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add AI Tool</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {aiTools.map(tool => (
                <div key={tool.id} className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2">
                      <Cpu className="w-5 h-5 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-400">{tool.type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          setEditingAiTool(tool);
                          setShowAiToolForm(true);
                        }}
                        className="p-2 text-[#8A93A6] hover:text-white hover:bg-[#1A1F2E] rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm('Delete this AI tool?')) {
                            await deleteDoc(doc(db, 'aiTools', tool.id!));
                          }
                        }}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{tool.title}</h4>
                  <p className="text-sm text-[#8A93A6] mb-4 flex-grow">{tool.description}</p>
                  
                  <div className="space-y-2 text-sm text-[#8A93A6] mb-4">
                    <div className="flex justify-between">
                      <span>Model:</span>
                      <span className="text-white">{tool.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost:</span>
                      <span className="text-white">{tool.cost} {tool.costType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>User Prompt:</span>
                      <span className={tool.userPromptAllowed ? "text-green-400" : "text-red-400"}>
                        {tool.userPromptAllowed ? 'Allowed' : 'Locked'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={tool.isActive ? "text-green-400" : "text-red-400"}>
                        {tool.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {aiTools.length === 0 && (
                <div className="col-span-full text-center py-12 bg-[#131722] border border-[#22283A] rounded-2xl">
                  <Cpu className="w-12 h-12 text-[#22283A] mx-auto mb-4" />
                  <p className="text-[#8A93A6]">No AI tools configured.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Referral System</h3>
            
            {/* Settings */}
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 space-y-6 max-w-2xl">
              <h4 className="text-lg font-bold text-white">Referral Settings</h4>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={async () => {
                    const newSettings = { ...referralSettings, isActive: !referralSettings.isActive };
                    setReferralSettings(newSettings);
                    await setDoc(doc(db, 'settings', 'referral'), newSettings);
                    showToast('Referral status updated');
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${referralSettings.isActive ? 'bg-purple-600' : 'bg-[#22283A]'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${referralSettings.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-[#8A93A6]">Enable Referral System</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Reward Amount</label>
                <input 
                  type="number" 
                  value={referralSettings.rewardAmount}
                  onChange={(e) => setReferralSettings({ ...referralSettings, rewardAmount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Reward Type</label>
                <select 
                  value={referralSettings.rewardType}
                  onChange={(e) => setReferralSettings({ ...referralSettings, rewardType: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="wallet">Wallet Balance</option>
                  <option value="bronze">Bronze Credits</option>
                  <option value="silver">Silver Credits</option>
                  <option value="gold">Gold Credits</option>
                  <option value="diamond">Diamond Credits</option>
                  <option value="credits">Normal Credits</option>
                </select>
              </div>

              <button 
                onClick={async () => {
                  await setDoc(doc(db, 'settings', 'referral'), referralSettings);
                  showToast('Referral settings saved');
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center space-x-2"
              >
                <Save className="w-5 h-5" />
                <span>Save Settings</span>
              </button>
            </div>

            {/* Referrals List */}
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1A1F2E] text-[#8A93A6] text-sm uppercase tracking-wider">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Referrer ID</th>
                      <th className="px-6 py-4">Invitee Email</th>
                      <th className="px-6 py-4">Reward</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#22283A]">
                    {referrals.map((ref) => (
                      <tr key={ref.id} className="hover:bg-[#1A1F2E]/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-[#8A93A6]">{ref.createdAt?.toDate().toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-mono text-white">{ref.referrerId}</td>
                        <td className="px-6 py-4 text-sm text-white">{ref.inviteeEmail}</td>
                        <td className="px-6 py-4 text-sm font-bold text-green-400">{ref.rewardAmount} {ref.rewardType}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${ref.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {ref.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {ref.status === 'pending' && (
                            <button 
                              onClick={async () => {
                                try {
                                  const referrerRef = doc(db, 'users', ref.referrerId);
                                  const referrerSnap = await getDoc(referrerRef);
                                  if (!referrerSnap.exists()) {
                                    showToast('Referrer not found', 'error');
                                    return;
                                  }
                                  
                                  const referrerData = referrerSnap.data();
                                  const updates: any = {};
                                  
                                  if (ref.rewardType === 'wallet') {
                                    updates.walletBalance = (referrerData.walletBalance || 0) + ref.rewardAmount;
                                  } else if (['bronze', 'silver', 'gold', 'diamond'].includes(ref.rewardType)) {
                                    updates.creditBalances = {
                                      ...referrerData.creditBalances,
                                      [ref.rewardType]: (referrerData.creditBalances?.[ref.rewardType] || 0) + ref.rewardAmount
                                    };
                                  } else if (ref.rewardType === 'credits') {
                                    updates.credits = (referrerData.credits || 0) + ref.rewardAmount;
                                  }
                                  
                                  await updateDoc(referrerRef, updates);
                                  await updateDoc(doc(db, 'referrals', ref.id), { status: 'approved' });
                                  showToast('Referral approved and reward granted');
                                } catch (e) {
                                  console.error(e);
                                  showToast('Error approving referral', 'error');
                                }
                              }}
                              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {referrals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-[#8A93A6]">No referrals found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            <h3 className="text-2xl font-bold">App Settings</h3>
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 space-y-6">
              
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">App Name</label>
                <input 
                  type="text" 
                  value={settings.appName}
                  onChange={(e) => setSettings({...settings, appName: e.target.value})}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Logo URL (Optional)</label>
                <input 
                  type="text" 
                  value={settings.logoUrl}
                  onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Default Free Credits (New Users)</label>
                <input 
                  type="number" 
                  value={settings.defaultCredits}
                  onChange={(e) => setSettings({...settings, defaultCredits: parseInt(e.target.value) || 0})}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Payment Method Info (Shown to users)</label>
                <textarea 
                  value={settings.paymentMethodInfo}
                  onChange={(e) => setSettings({...settings, paymentMethodInfo: e.target.value})}
                  rows={4}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="e.g., Send BUSD to 0x... and submit TX ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Global Notice / Announcement (Optional)</label>
                <textarea 
                  value={settings.globalNotice || ''}
                  onChange={(e) => setSettings({...settings, globalNotice: e.target.value})}
                  rows={3}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="e.g., System maintenance at 12 PM. Leave empty to hide."
                />
              </div>

              <div className="pt-4 border-t border-[#22283A]">
                <h4 className="text-lg font-semibold mb-4 text-white">Support & Promo</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#8A93A6] mb-2">Promo Banner Image URL (300x250 recommended)</label>
                    <input 
                      type="text" 
                      value={settings.promoBannerUrl || ''}
                      onChange={(e) => setSettings({...settings, promoBannerUrl: e.target.value})}
                      className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="https://example.com/banner.png"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#8A93A6] mb-2">Telegram Link</label>
                    <input 
                      type="text" 
                      value={settings.supportTelegram || ''}
                      onChange={(e) => setSettings({...settings, supportTelegram: e.target.value})}
                      className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#8A93A6] mb-2">WhatsApp Link</label>
                    <input 
                      type="text" 
                      value={settings.supportWhatsapp || ''}
                      onChange={(e) => setSettings({...settings, supportWhatsapp: e.target.value})}
                      className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#8A93A6] mb-2">Support Phone Number</label>
                    <input 
                      type="text" 
                      value={settings.supportPhone || ''}
                      onChange={(e) => setSettings({...settings, supportPhone: e.target.value})}
                      className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#22283A]">
                <h4 className="text-lg font-semibold mb-4 text-white">Advanced Settings</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#8A93A6] mb-2">Free Credits for New Users</label>
                    <input 
                      type="number" 
                      min="0"
                      value={settings.freeCreditsOnSignup || 0}
                      onChange={(e) => setSettings({...settings, freeCreditsOnSignup: parseInt(e.target.value) || 0})}
                      className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <p className="text-xs text-[#8A93A6] mt-2">Number of free credits given to users when they first sign up.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#8A93A6] mb-2">Custom Gemini API Key (Optional)</label>
                    <input 
                      type="password" 
                      value={settings.geminiApiKey || ''}
                      onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})}
                      placeholder="Leave empty to use default system key"
                      className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
                    />
                    <p className="text-xs text-[#8A93A6] mt-2">If provided, this key will be used for all AI chart analysis instead of the default one.</p>
                  </div>

                  <div className="flex items-center justify-between bg-[#0B0E14] border border-[#22283A] rounded-xl p-4">
                    <div>
                      <h5 className="font-medium text-white">Maintenance Mode</h5>
                      <p className="text-sm text-[#8A93A6]">Disable access for regular users</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.maintenanceMode || false}
                        onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-[#22283A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSaveSettings}
                className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90"
              >
                <Save className="w-5 h-5" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Method Form Modal */}
      {showPaymentForm && editingPayment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#131722] border border-[#22283A] rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-white mb-6">{editingPayment.id ? 'Edit' : 'Add'} Payment Method</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Method Name (e.g. bKash, Binance)</label>
                <input 
                  type="text" 
                  value={editingPayment.name}
                  onChange={(e) => setEditingPayment({...editingPayment, name: e.target.value})}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Details (Number/Address)</label>
                <input 
                  type="text" 
                  value={editingPayment.details}
                  onChange={(e) => setEditingPayment({...editingPayment, details: e.target.value})}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Instructions for User</label>
                <textarea 
                  value={editingPayment.instructions}
                  onChange={(e) => setEditingPayment({...editingPayment, instructions: e.target.value})}
                  rows={2}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">QR Code Image URL (Optional)</label>
                <input 
                  type="text" 
                  value={editingPayment.qrCodeUrl || ''}
                  onChange={(e) => setEditingPayment({...editingPayment, qrCodeUrl: e.target.value})}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  placeholder="https://example.com/qr.png"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={editingPayment.isActive}
                  onChange={(e) => setEditingPayment({...editingPayment, isActive: e.target.checked})}
                  className="w-4 h-4 rounded border-[#22283A] bg-[#0B0E14] text-purple-500 focus:ring-purple-500"
                />
                <label className="text-sm font-medium text-white">Active (Visible to users)</label>
              </div>
            </div>
            <div className="flex space-x-3 mt-8">
              <button 
                onClick={() => setShowPaymentForm(false)}
                className="flex-1 py-2.5 rounded-xl font-medium border border-[#22283A] text-white hover:bg-[#1A1F2E] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    const { id, ...rest } = editingPayment;
                    const dataToSave = Object.fromEntries(Object.entries(rest).filter(([_, v]) => v !== undefined));
                    if (editingPayment.id) {
                      await updateDoc(doc(db, 'paymentMethods', editingPayment.id), dataToSave);
                      showToast("Payment method updated successfully");
                    } else {
                      await addDoc(collection(db, 'paymentMethods'), dataToSave);
                      showToast("Payment method added successfully");
                    }
                    setShowPaymentForm(false);
                  } catch (err) {
                    console.error(err);
                    showToast("Failed to save payment method", "error");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {showProductForm && editingProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#131722] border border-[#22283A] rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-6">{editingProduct.id ? 'Edit' : 'Add'} Product/Offer</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Title</label>
                  <input 
                    type="text" 
                    value={editingProduct.title}
                    onChange={(e) => setEditingProduct({...editingProduct, title: e.target.value})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Category</label>
                  <select 
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value as any})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="game_topup">Game Top-up</option>
                    <option value="subscription">Subscription</option>
                    <option value="product">Digital Product</option>
                    <option value="offer">Offer</option>
                    <option value="others">Others</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Price Display (e.g. "500 BDT")</label>
                  <input 
                    type="text" 
                    value={editingProduct.priceDisplay}
                    onChange={(e) => setEditingProduct({...editingProduct, priceDisplay: e.target.value})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Numeric Price (for Wallet)</label>
                  <input 
                    type="number" 
                    value={editingProduct.price || 0}
                    onChange={(e) => setEditingProduct({...editingProduct, price: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Image URL (Optional)</label>
                <input 
                  type="text" 
                  value={editingProduct.imageUrl || ''}
                  onChange={(e) => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  placeholder="https://example.com/product.png"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Description</label>
                <textarea 
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                  rows={2}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Requirements (Comma separated, e.g. "Player ID, Server")</label>
                <input 
                  type="text" 
                  value={(editingProduct.requirements || []).join(',')}
                  onChange={(e) => setEditingProduct({...editingProduct, requirements: e.target.value.split(',')})}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  placeholder="What user needs to provide"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Conditions / Notes</label>
                <textarea 
                  value={editingProduct.conditions}
                  onChange={(e) => setEditingProduct({...editingProduct, conditions: e.target.value})}
                  rows={2}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={editingProduct.isActive}
                  onChange={(e) => setEditingProduct({...editingProduct, isActive: e.target.checked})}
                  className="w-4 h-4 rounded border-[#22283A] bg-[#0B0E14] text-purple-500 focus:ring-purple-500"
                />
                <label className="text-sm font-medium text-white">Active (Visible to users)</label>
              </div>
            </div>
            <div className="flex space-x-3 mt-8">
              <button 
                onClick={() => setShowProductForm(false)}
                className="flex-1 py-2.5 rounded-xl font-medium border border-[#22283A] text-white hover:bg-[#1A1F2E] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    const cleanedRequirements = (editingProduct.requirements || []).map(s => s.trim()).filter(Boolean);
                    const { id, ...rest } = editingProduct;
                    const dataToSave = Object.fromEntries(Object.entries({...rest, requirements: cleanedRequirements}).filter(([_, v]) => v !== undefined));
                    if (editingProduct.id) {
                      await updateDoc(doc(db, 'products', editingProduct.id), dataToSave);
                      showToast("Product updated successfully");
                    } else {
                      await addDoc(collection(db, 'products'), { ...dataToSave, createdAt: serverTimestamp() });
                      showToast("Product added successfully");
                    }
                    setShowProductForm(false);
                  } catch (err) {
                    console.error(err);
                    showToast("Failed to save product", "error");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Tool Limits Modal */}
      {editingUserLimits && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#131722] border border-[#22283A] rounded-2xl w-full max-w-md p-6 my-8">
            <h3 className="text-xl font-bold text-white mb-2">Manage AI Tool Limits</h3>
            <p className="text-[#8A93A6] mb-6 text-sm">User: {editingUserLimits.email}</p>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {aiTools.map(tool => {
                const currentLimit = editingUserLimits.toolLimits?.[tool.id!] ?? tool.defaultFreeUses;
                return (
                  <div key={tool.id} className="flex items-center justify-between bg-[#0B0E14] p-3 rounded-xl border border-[#22283A]">
                    <div>
                      <div className="text-white font-medium">{tool.title}</div>
                      <div className="text-xs text-[#8A93A6]">{tool.type.replace(/_/g, ' ')}</div>
                    </div>
                    <input 
                      type="number" 
                      min="0"
                      value={currentLimit}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setEditingUserLimits({
                          ...editingUserLimits,
                          toolLimits: {
                            ...(editingUserLimits.toolLimits || {}),
                            [tool.id!]: val
                          }
                        });
                      }}
                      className="w-20 bg-[#131722] border border-[#22283A] rounded px-2 py-1 text-white text-center"
                    />
                  </div>
                );
              })}
              {aiTools.length === 0 && (
                <p className="text-[#8A93A6] text-center py-4">No AI tools available.</p>
              )}
            </div>

            <div className="flex space-x-3 mt-8">
              <button 
                onClick={() => setEditingUserLimits(null)}
                className="flex-1 py-2 rounded-xl font-semibold bg-[#22283A] text-white hover:bg-[#2A3143] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'users', editingUserLimits.uid), {
                      toolLimits: editingUserLimits.toolLimits || {}
                    });
                    showToast("User limits updated successfully");
                    setEditingUserLimits(null);
                  } catch (err) {
                    console.error("Error updating limits:", err);
                    showToast("Failed to update limits", "error");
                  }
                }}
                className="flex-1 py-2 rounded-xl font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Save Limits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tool Form Modal */}
      {showAiToolForm && editingAiTool && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#131722] border border-[#22283A] rounded-2xl w-full max-w-2xl p-6 my-8">
            <h3 className="text-xl font-bold text-white mb-6">{editingAiTool.id ? 'Edit' : 'Add'} AI Tool</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Title</label>
                  <input 
                    type="text" 
                    value={editingAiTool.title}
                    onChange={(e) => setEditingAiTool({...editingAiTool, title: e.target.value})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Type</label>
                  <select
                    value={editingAiTool.type}
                    onChange={(e) => setEditingAiTool({...editingAiTool, type: e.target.value as any})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="text_to_image">Text to Image</option>
                    <option value="image_to_image">Image to Image</option>
                    <option value="text_to_video">Text to Video</option>
                    <option value="image_to_video">Image to Video</option>
                    <option value="text_to_text">Text to Text</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Description</label>
                <textarea 
                  value={editingAiTool.description}
                  onChange={(e) => setEditingAiTool({...editingAiTool, description: e.target.value})}
                  rows={2}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Model Name</label>
                  <select 
                    value={editingAiTool.model}
                    onChange={(e) => setEditingAiTool({...editingAiTool, model: e.target.value})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500 font-mono text-sm"
                  >
                    <option value="">Select a model...</option>
                    <optgroup label="Text & Chat">
                      <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex)</option>
                      <option value="gemini-3-flash-preview">gemini-3-flash-preview (Basic)</option>
                    </optgroup>
                    <optgroup label="Image Generation & Editing">
                      <option value="gemini-2.5-flash-image">gemini-2.5-flash-image (General)</option>
                      <option value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview (High Quality)</option>
                    </optgroup>
                    <optgroup label="Video Generation">
                      <option value="veo-3.1-lite-generate-preview">veo-3.1-lite-generate-preview</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Custom API Key (Optional)</label>
                  <input 
                    type="password" 
                    value={editingAiTool.apiKey || ''}
                    onChange={(e) => setEditingAiTool({...editingAiTool, apiKey: e.target.value})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500 font-mono text-sm"
                    placeholder="Leave empty to use default"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">System Prompt (Admin defined)</label>
                <textarea 
                  value={editingAiTool.systemPrompt}
                  onChange={(e) => setEditingAiTool({...editingAiTool, systemPrompt: e.target.value})}
                  rows={3}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  placeholder="Instructions for the AI model..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Cost Amount</label>
                  <input 
                    type="number" 
                    min="0"
                    value={editingAiTool.cost}
                    onChange={(e) => setEditingAiTool({...editingAiTool, cost: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Cost Type</label>
                  <select
                    value={editingAiTool.costType}
                    onChange={(e) => setEditingAiTool({...editingAiTool, costType: e.target.value as any})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="credit">Ai Credits (Default)</option>
                    <option value="bronze">Bronze Credits</option>
                    <option value="silver">Silver Credits</option>
                    <option value="gold">Gold Credits</option>
                    <option value="diamond">Diamond Credits</option>
                    <option value="wallet">Wallet Balance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Free Uses (New Users)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={editingAiTool.defaultFreeUses}
                    onChange={(e) => setEditingAiTool({...editingAiTool, defaultFreeUses: parseInt(e.target.value) || 0})}
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-2 px-4 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={editingAiTool.userPromptAllowed}
                    onChange={(e) => setEditingAiTool({...editingAiTool, userPromptAllowed: e.target.checked})}
                    className="w-4 h-4 rounded border-[#22283A] bg-[#0B0E14] text-purple-500 focus:ring-purple-500"
                  />
                  <label className="text-sm font-medium text-white">Allow User to Enter Prompt (If unchecked, user prompt is hidden)</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={editingAiTool.isActive}
                    onChange={(e) => setEditingAiTool({...editingAiTool, isActive: e.target.checked})}
                    className="w-4 h-4 rounded border-[#22283A] bg-[#0B0E14] text-purple-500 focus:ring-purple-500"
                  />
                  <label className="text-sm font-medium text-white">Active (Visible to users)</label>
                </div>
              </div>
            </div>
            <div className="flex space-x-3 mt-8">
              <button 
                onClick={() => {
                  setShowAiToolForm(false);
                  setEditingAiTool(null);
                }}
                className="flex-1 py-2 rounded-xl font-semibold bg-[#22283A] text-white hover:bg-[#2A3143] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (!editingAiTool.title || !editingAiTool.model) {
                    showToast("Title and Model are required.", "error");
                    return;
                  }
                  try {
                    const { id, ...rest } = editingAiTool;
                    const dataToSave = Object.fromEntries(Object.entries(rest).filter(([_, v]) => v !== undefined));
                    if (editingAiTool.id) {
                      await updateDoc(doc(db, 'aiTools', editingAiTool.id), dataToSave);
                      showToast("AI tool updated successfully");
                    } else {
                      await addDoc(collection(db, 'aiTools'), { ...dataToSave, createdAt: serverTimestamp() });
                      showToast("AI tool added successfully");
                    }
                    setShowAiToolForm(false);
                    setEditingAiTool(null);
                  } catch (err) {
                    console.error("Error saving AI tool:", err);
                    showToast("Failed to save AI tool", "error");
                  }
                }}
                className="flex-1 py-2 rounded-xl font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Save AI Tool
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-[100] flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg transition-all transform translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-green-500/20 border border-green-500/50 text-green-400' : 'bg-red-500/20 border border-red-500/50 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
