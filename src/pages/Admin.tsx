import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { UserProfile, CreditRequest, AppSettings, UsageHistory } from '../types';
import { Users, CreditCard, Settings, Activity, Trash2, CheckCircle, XCircle, Shield, ShieldOff, Save, LayoutDashboard, Bell, Plus, Minus } from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'requests' | 'history' | 'settings'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    appName: "Sharfin's AI",
    logoUrl: "",
    defaultCredits: 5,
    paymentMethodInfo: "Binance Dollar (BUSD) - Wallet: 0x..."
  });

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

    return () => {
      unsubUsers();
      unsubRequests();
      unsubHistory();
      unsubSettings();
    };
  }, []);

  const handleUpdateUser = async (uid: string, data: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', uid), data);
    } catch (err) {
      console.error("Error updating user:", err);
      alert("Failed to update user.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        console.error("Error deleting user:", err);
        alert("Failed to delete user.");
      }
    }
  };

  const handleRequestAction = async (request: CreditRequest, action: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'creditRequests', request.id!), { status: action });
      if (action === 'approved') {
        const userDoc = users.find(u => u.uid === request.userId);
        if (userDoc) {
          await updateDoc(doc(db, 'users', request.userId), {
            credits: (userDoc.credits || 0) + request.amount
          });
        }
      }
    } catch (err) {
      console.error("Error updating request:", err);
      alert("Failed to update request.");
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateDoc(doc(db, 'settings', 'appSettings'), { ...settings });
      alert("Settings saved successfully!");
    } catch (err) {
      console.error("Error saving settings:", err);
      // If it doesn't exist, create it
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'settings', 'appSettings'), { ...settings });
        alert("Settings saved successfully!");
      } catch (e) {
        alert("Failed to save settings.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#131722] border-r border-[#22283A] p-6 flex flex-col">
        <h2 className="text-xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6]">Admin Panel</h2>
        <nav className="space-y-2 flex-grow">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'overview' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span>Overview</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Users className="w-5 h-5" />
            <span>Users</span>
          </button>
          <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'requests' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <CreditCard className="w-5 h-5" />
            <span>Credit Requests</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'history' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Activity className="w-5 h-5" />
            <span>Usage History</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-[#22283A] text-white' : 'text-[#8A93A6] hover:bg-[#1A1F2E]'}`}>
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </nav>
        
        <div className="mt-auto pt-6 border-t border-[#22283A]">
          <a href="/" className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors text-[#8A93A6] hover:bg-[#1A1F2E] hover:text-white">
            <Activity className="w-5 h-5" />
            <span>Back to App</span>
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow p-10 overflow-y-auto">
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
            <h3 className="text-2xl font-bold">Registered Users</h3>
            <div className="bg-[#131722] border border-[#22283A] rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#1A1F2E] text-[#8A93A6] text-sm uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Credits</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22283A]">
                  {users.map(u => (
                    <tr key={u.uid} className="hover:bg-[#1A1F2E]/50 transition-colors">
                      <td className="px-6 py-4">{u.email}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            value={u.credits || 0}
                            onChange={(e) => handleUpdateUser(u.uid, { credits: parseInt(e.target.value) || 0 })}
                            className="w-20 bg-[#0B0E14] border border-[#22283A] rounded px-2 py-1 text-white"
                          />
                          <button 
                            onClick={() => handleUpdateUser(u.uid, { credits: (u.credits || 0) + 10 })}
                            className="p-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                            title="Add 10 Credits"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleUpdateUser(u.uid, { credits: Math.max(0, (u.credits || 0) - 10) })}
                            className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                            title="Remove 10 Credits"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
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
                      <td colSpan={5} className="px-6 py-8 text-center text-[#8A93A6]">No credit requests found.</td>
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
    </div>
  );
}
