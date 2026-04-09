import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle2, ShoppingBag, Package, Activity } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Order, UsageHistory, UserProfile } from '../types';

interface ProfileSettingsModalProps {
  onClose: () => void;
  userProfile: UserProfile;
}

export default function ProfileSettingsModal({ onClose, userProfile }: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'history'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<UsageHistory[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const qOrders = query(
      collection(db, 'orders'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)));
    });

    const qHistory = query(
      collection(db, 'usageHistory'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setHistory(snap.docs.map(d => ({ ...d.data(), id: d.id } as UsageHistory)));
    });

    return () => {
      unsubOrders();
      unsubHistory();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#131722] border border-[#22283A] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#22283A]">
          <div className="flex space-x-6">
            <button 
              onClick={() => setActiveTab('orders')}
              className={`text-lg font-bold flex items-center space-x-2 transition-colors ${activeTab === 'orders' ? 'text-white' : 'text-[#8A93A6] hover:text-white'}`}
            >
              <ShoppingBag className={`w-5 h-5 ${activeTab === 'orders' ? 'text-[#A855F7]' : ''}`} />
              <span>My Orders</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`text-lg font-bold flex items-center space-x-2 transition-colors ${activeTab === 'history' ? 'text-white' : 'text-[#8A93A6] hover:text-white'}`}
            >
              <Activity className={`w-5 h-5 ${activeTab === 'history' ? 'text-[#A855F7]' : ''}`} />
              <span>History</span>
            </button>
          </div>
          <button onClick={onClose} className="text-[#8A93A6] hover:text-white">✕</button>
        </div>

        <div className="bg-[#0B0E14] p-4 border-b border-[#22283A] flex justify-around">
          <div className="text-center">
            <p className="text-[#8A93A6] text-sm mb-1">Wallet Balance</p>
            <p className="text-xl font-bold text-green-400">{userProfile.walletBalance || 0} {userProfile.preferredCurrency || 'BDT'}</p>
          </div>
          <div className="w-px bg-[#22283A]"></div>
          <div className="text-center">
            <p className="text-[#8A93A6] text-sm mb-1">Ai Credits</p>
            <p className="text-xl font-bold text-[#F59E0B]">{userProfile.credits || 0}</p>
          </div>
          <div className="w-px bg-[#22283A]"></div>
          <div className="text-center">
            <p className="text-[#8A93A6] text-sm mb-1">Bronze</p>
            <p className="text-xl font-bold text-[#CD7F32]">{userProfile.creditBalances?.bronze || 0}</p>
          </div>
          <div className="w-px bg-[#22283A]"></div>
          <div className="text-center">
            <p className="text-[#8A93A6] text-sm mb-1">Silver</p>
            <p className="text-xl font-bold text-[#C0C0C0]">{userProfile.creditBalances?.silver || 0}</p>
          </div>
          <div className="w-px bg-[#22283A]"></div>
          <div className="text-center">
            <p className="text-[#8A93A6] text-sm mb-1">Gold</p>
            <p className="text-xl font-bold text-[#FFD700]">{userProfile.creditBalances?.gold || 0}</p>
          </div>
          <div className="w-px bg-[#22283A]"></div>
          <div className="text-center">
            <p className="text-[#8A93A6] text-sm mb-1">Diamond</p>
            <p className="text-xl font-bold text-[#00FFFF]">{userProfile.creditBalances?.diamond || 0}</p>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {activeTab === 'orders' && (
            <div className="space-y-4">
            {orders.map(order => (
                <div key={order.id} className="bg-[#0B0E14] border border-[#22283A] rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-white">{order.productTitle}</h4>
                      <p className="text-sm text-[#8A93A6]">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : ''}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      order.status === 'approved' || order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      order.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[#8A93A6] mb-1">Price</p>
                      <p className="font-semibold text-green-400">{order.priceDisplay}</p>
                    </div>
                    <div>
                      <p className="text-[#8A93A6] mb-1">Payment Method</p>
                      <p className="font-semibold text-white">{order.paymentMethodName}</p>
                    </div>
                    {Object.entries(order.userInputs || {}).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-[#8A93A6] mb-1">{key}</p>
                        <p className="font-semibold text-white">{value as string}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {orders.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-[#22283A] mx-auto mb-4" />
                  <p className="text-[#8A93A6]">You haven't placed any orders yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {history.map(item => (
                <div key={item.id} className="bg-[#0B0E14] border border-[#22283A] rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-medium">{item.action}</h4>
                    <p className="text-xs text-[#8A93A6]">{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : ''}</p>
                  </div>
                  {item.creditsDeducted > 0 && (
                    <div className="text-right">
                      <span className="text-red-400 font-bold text-sm">-{item.creditsDeducted} Ai Credits</span>
                    </div>
                  )}
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-[#22283A] mx-auto mb-4" />
                  <p className="text-[#8A93A6]">No activity history found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
