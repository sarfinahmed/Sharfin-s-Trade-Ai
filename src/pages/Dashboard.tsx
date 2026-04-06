import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, Image as ImageIcon, Crosshair, Zap, BarChart2, LogOut, CreditCard, Send, Settings, Copy, Check, Bell } from 'lucide-react';
import { analyzeChart, AnalysisResult } from '../lib/gemini';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { UserProfile, AppSettings } from '../types';
import ProfileSettingsModal from '../components/ProfileSettingsModal';

interface DashboardProps {
  userProfile: UserProfile;
  appSettings: AppSettings;
}

export default function Dashboard({ userProfile, appSettings }: DashboardProps) {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Credit Request State
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState(10);
  const [txId, setTxId] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Profile Settings State
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Copy State
  const [copied, setCopied] = useState(false);
  const walletAddress = "0xf80301082ed117e7cb16a40d44924df083a27e11";

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setError(null);
    setResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    
    if (userProfile.credits <= 0) {
      setError("No credits available. Please purchase credits.");
      setShowCreditModal(true);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    
    try {
      const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid image data format.');
      }
      
      const mimeType = match[1];
      const base64Data = match[2];
      
      const analysis = await analyzeChart(base64Data, mimeType);
      
      // Deduct Credit
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        credits: userProfile.credits - 1
      });

      // Log Usage
      await addDoc(collection(db, 'usageHistory'), {
        userId: userProfile.uid,
        userEmail: userProfile.email,
        action: 'Chart Analysis',
        creditsDeducted: 1,
        timestamp: serverTimestamp()
      });

      setResult(analysis);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitCreditRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txId.trim()) return;
    
    setIsSubmittingRequest(true);
    try {
      await addDoc(collection(db, 'creditRequests'), {
        userId: userProfile.uid,
        userEmail: userProfile.email,
        amount: creditAmount,
        status: 'pending',
        paymentMethod: appSettings.paymentMethodInfo,
        transactionId: txId,
        createdAt: serverTimestamp()
      });
      alert("Credit request submitted successfully! Waiting for admin approval.");
      setShowCreditModal(false);
      setTxId('');
    } catch (err) {
      console.error("Error submitting request:", err);
      alert("Failed to submit request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (userProfile.isBlocked) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center text-white p-6">
        <div className="bg-[#131722] border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Account Blocked</h2>
          <p className="text-[#8A93A6] mb-6">Your account has been suspended by the administrator. You cannot access the analysis tools.</p>
          <button onClick={handleLogout} className="px-6 py-2 bg-[#1A1F2E] hover:bg-[#22283A] rounded-lg transition-colors">Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-sans overflow-x-hidden selection:bg-purple-500/30 relative">
      
      {/* Credit Purchase Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-[#A855F7]" />
                <span>Purchase Credits</span>
              </h3>
              <button onClick={() => setShowCreditModal(false)} className="text-[#8A93A6] hover:text-white">✕</button>
            </div>
            
            <div className="bg-[#0B0E14] border border-[#22283A] rounded-xl p-5 mb-6 text-center">
              <h4 className="text-lg font-semibold text-white mb-1">Deposit USDT to Binance</h4>
              <p className="text-sm text-[#8A93A6] mb-4">1 Credit = 1 USDT</p>
              
              <div className="bg-white p-4 rounded-xl inline-block mb-4">
                {/* Generic QR Code Placeholder */}
                <div className="w-40 h-40 bg-gray-200 flex items-center justify-center rounded-lg border-4 border-white">
                  <div className="text-center">
                    <div className="w-10 h-10 bg-[#26A17B] rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-bold text-xl">₮</span>
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">USDT (ERC20)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex justify-between items-center border-b border-[#22283A] pb-2">
                  <span className="text-sm text-[#8A93A6]">Network</span>
                  <span className="text-sm font-bold text-white">ETH (ERC20)</span>
                </div>
                
                <div className="pt-1">
                  <span className="text-sm text-[#8A93A6] block mb-1">Address</span>
                  <div className="flex items-center justify-between bg-[#1A1F2E] p-3 rounded-lg border border-[#22283A]">
                    <span className="text-xs font-mono text-[#A855F7] break-all mr-2">
                      {walletAddress}
                    </span>
                    <button 
                      onClick={handleCopy}
                      className="p-2 bg-[#22283A] hover:bg-[#2A3143] rounded-md transition-colors shrink-0"
                      title="Copy Address"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-red-400 mt-2 text-center">Don't send NFTs to this address.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitCreditRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Amount of Credits (USDT Sent)</label>
                <input 
                  type="number" 
                  min="1"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Transaction ID / Hash</label>
                <input 
                  type="text" 
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder="Enter TX ID after payment"
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingRequest || !txId.trim()}
                className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmittingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span>Submit Request</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <ProfileSettingsModal onClose={() => setShowProfileModal(false)} />
      )}

      <div className="max-w-6xl mx-auto px-6 py-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center space-x-4">
            {appSettings.logoUrl ? (
              <img src={appSettings.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg">
                <Activity className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">{appSettings.appName}</h1>
              <p className="text-[11px] text-[#8A93A6] font-bold tracking-widest uppercase mt-0.5">Professional Chart Analysis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 bg-[#131722] border border-[#22283A] px-4 py-2 rounded-lg">
              <Zap className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-sm font-bold text-white">{userProfile.credits} Credits</span>
              <button 
                onClick={() => setShowCreditModal(true)}
                className="ml-2 text-xs bg-[#22283A] hover:bg-[#2A3143] px-2 py-1 rounded text-white transition-colors"
              >
                Add
              </button>
            </div>

            {userProfile.role === 'admin' && (
              <button 
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-[#22283A] bg-[#131722] hover:bg-[#1A1F2E] transition-colors text-sm font-medium text-[#8A93A6] hover:text-white"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin Panel</span>
              </button>
            )}

            <button 
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-[#22283A] bg-[#131722] hover:bg-[#1A1F2E] transition-colors text-sm font-medium text-[#8A93A6] hover:text-white"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Global Notice Banner */}
        {appSettings.globalNotice && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-8 flex items-start space-x-3">
            <Bell className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-purple-200 text-sm whitespace-pre-wrap">{appSettings.globalNotice}</p>
          </div>
        )}

        <main className="flex-grow flex flex-col w-full">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Image Input */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-5 h-5 text-[#8A93A6]" />
                    <h2 className="text-lg font-bold text-white">Chart Input</h2>
                  </div>
                  <span className="text-xs text-[#8A93A6] bg-[#0B0E14] px-2 py-1 rounded border border-[#22283A]">Cost: 1 Credit</span>
                </div>
                
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`relative bg-[#0B0E14] border rounded-xl flex-grow min-h-[280px] flex items-center justify-center overflow-hidden transition-colors mb-6 ${
                    isDragging ? 'border-purple-500/50' : 'border-[#22283A]'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {image ? (
                    <div className="relative w-full h-full group">
                      <img 
                        src={image} 
                        alt="Chart Preview" 
                        className="object-contain w-full h-full absolute inset-0 z-0 rounded-xl"
                      />
                      <div className="z-10 absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#0B0E14]/60 backdrop-blur-sm">
                        <button 
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          className="px-5 py-2.5 rounded-lg border border-white/20 bg-black/60 text-white text-sm font-medium hover:bg-black/80 transition-colors"
                        >
                          Change Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 rounded-lg border border-white/20 bg-[#1A1F2E] text-white text-sm font-medium hover:bg-[#22283A] transition-colors z-10"
                    >
                      Upload Image
                    </button>
                  )}
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!image || isAnalyzing}
                  className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${
                    !image 
                      ? 'bg-[#1A1F2E] text-[#8A93A6] cursor-not-allowed border border-[#22283A]' 
                      : isAnalyzing
                      ? 'bg-[#4C1D95] text-[#C084FC] cursor-wait'
                      : 'bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 shadow-[0_0_20px_rgba(124,58,237,0.3)]'
                  }`}
                >
                  {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  <span>{isAnalyzing ? 'Analyzing Patterns...' : 'Run Technical Analysis'}</span>
                </button>
                
                {error && (
                  <div className="mt-4 border border-red-500/20 bg-red-500/10 rounded-xl p-4 flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Results */}
            <div className="lg:col-span-7 flex flex-col h-full">
              {isAnalyzing ? (
                <div className="bg-[#131722] border border-[#22283A] rounded-2xl flex flex-col items-center justify-center h-full min-h-[500px]">
                  <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 border-[#22283A]"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#A855F7] border-r-[#06B6D4] animate-spin" style={{ animationDuration: '1.5s' }}></div>
                    <Activity className="w-8 h-8 text-[#A855F7]" />
                  </div>
                  <p className="text-[#A855F7] font-medium tracking-wide">Processing Market Data...</p>
                </div>
              ) : (
                <div className="flex flex-col space-y-4 h-full">
                  {/* Top Row: Market & Direction */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <Crosshair className="w-4 h-4 text-[#8A93A6]" />
                        <span className="text-[11px] font-bold text-[#8A93A6] tracking-widest uppercase">Identified Market</span>
                      </div>
                      <h3 className="text-2xl font-bold text-white">
                        {result ? result.market : '-'}
                      </h3>
                    </div>

                    <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <Activity className="w-4 h-4 text-[#8A93A6]" />
                        <span className="text-[11px] font-bold text-[#8A93A6] tracking-widest uppercase">Signal Direction</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {result?.direction === 'UP' && <TrendingUp className="w-6 h-6 text-[#10B981]" />}
                        {result?.direction === 'DOWN' && <TrendingDown className="w-6 h-6 text-[#F43F5E]" />}
                        {result?.direction === 'SIDEWAYS' && <Minus className="w-6 h-6 text-[#F59E0B]" />}
                        <span className={`text-2xl font-bold tracking-wide ${
                          result?.direction === 'UP' ? 'text-[#10B981]' : 
                          result?.direction === 'DOWN' ? 'text-[#F43F5E]' : 
                          result?.direction === 'SIDEWAYS' ? 'text-[#F59E0B]' : 'text-white'
                        }`}>
                          {result ? result.direction : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Confidence Level */}
                  <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4 text-[#F59E0B]" />
                        <span className="text-[11px] font-bold text-[#8A93A6] tracking-widest uppercase">Confidence Level</span>
                      </div>
                      <span className="text-xl font-bold text-white">{result ? result.confidence : '-'}</span>
                    </div>
                    <div className="h-2 w-full bg-[#0B0E14] rounded-full overflow-hidden border border-[#22283A]">
                      <div 
                        className="h-full bg-gradient-to-r from-[#A855F7] to-[#06B6D4] transition-all duration-1000 ease-out"
                        style={{ width: result ? result.confidence.replace(/[^0-9.]/g, '') + '%' : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Technical Logic */}
                  <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <BarChart2 className="w-4 h-4 text-[#06B6D4]" />
                      <span className="text-[11px] font-bold text-[#8A93A6] tracking-widest uppercase">Technical Logic</span>
                    </div>
                    <p className="text-[#D1D5DB] leading-relaxed text-sm">
                      {result ? result.logic : '-'}
                    </p>
                  </div>

                  {/* Additional Insights */}
                  <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 flex-grow">
                    <div className="flex items-center space-x-2 mb-4">
                      <AlertCircle className="w-4 h-4 text-[#A855F7]" />
                      <span className="text-[11px] font-bold text-[#8A93A6] tracking-widest uppercase">Additional Insights</span>
                    </div>
                    <p className="text-[#9CA3AF] leading-relaxed text-sm">
                      {result ? result.insights : '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
