import React, { useState, useEffect } from 'react';
import { Settings, Loader2, AlertCircle, CheckCircle2, ShoppingBag, Package } from 'lucide-react';
import { auth, db } from '../firebase';
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Order } from '../types';

interface ProfileSettingsModalProps {
  onClose: () => void;
}

export default function ProfileSettingsModal({ onClose }: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'orders'>('settings');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ ...d.data(), id: d.id } as Order)));
    });

    return () => unsub();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update Email if provided
      if (newEmail && newEmail !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail);
      }

      // Update Password if provided
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await updatePassword(auth.currentUser, newPassword);
      }

      setSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
    } catch (err: any) {
      console.error("Update error:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect current password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use by another account.');
      } else {
        setError(err.message || 'Failed to update profile.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#131722] border border-[#22283A] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-[#22283A]">
          <div className="flex space-x-6">
            <button 
              onClick={() => setActiveTab('settings')}
              className={`text-lg font-bold flex items-center space-x-2 transition-colors ${activeTab === 'settings' ? 'text-white' : 'text-[#8A93A6] hover:text-white'}`}
            >
              <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'text-[#A855F7]' : ''}`} />
              <span>Account Settings</span>
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`text-lg font-bold flex items-center space-x-2 transition-colors ${activeTab === 'orders' ? 'text-white' : 'text-[#8A93A6] hover:text-white'}`}
            >
              <ShoppingBag className={`w-5 h-5 ${activeTab === 'orders' ? 'text-[#A855F7]' : ''}`} />
              <span>My Orders</span>
            </button>
          </div>
          <button onClick={onClose} className="text-[#8A93A6] hover:text-white">✕</button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {activeTab === 'settings' && (
            <div className="max-w-md mx-auto">
              {error && (
                <div className="mb-4 border border-red-500/20 bg-red-500/10 rounded-xl p-3 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-4 border border-green-500/20 bg-green-500/10 rounded-xl p-3 flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-green-200">{success}</p>
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#8A93A6] mb-2">Current Password (Required)</label>
                  <input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to verify"
                    className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>
                
                <div className="pt-4 border-t border-[#22283A]">
                  <h4 className="text-sm font-semibold text-white mb-4">Update Information (Optional)</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#8A93A6] mb-2">New Email Address</label>
                      <input 
                        type="email" 
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder={auth.currentUser?.email || ''}
                        className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#8A93A6] mb-2">New Password</label>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading || !currentPassword}
                  className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 disabled:opacity-50 mt-6"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Update Profile</span>}
                </button>
              </form>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
