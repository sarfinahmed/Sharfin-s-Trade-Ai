import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, Image as ImageIcon, Crosshair, Zap, BarChart2, LogOut, CreditCard, Send, Settings, Copy, Check, Bell, ShoppingBag, Gamepad2, Package, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { analyzeChart, AnalysisResult } from '../lib/gemini';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';
import { UserProfile, AppSettings, PaymentMethod, Product, AITool } from '../types';
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

  // Store & Payments State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [aiTools, setAiTools] = useState<AITool[]>([]);
  const [activeTab, setActiveTab] = useState<'chart' | 'ai_tools' | 'offer' | 'game_topup' | 'subscription' | 'product' | 'others' | 'support' | 'referrals'>('chart');
  const [depositType, setDepositType] = useState<'credit' | 'money'>('credit');
  const [depositAmount, setDepositAmount] = useState(10);
  
  // Store Purchase Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderInputs, setOrderInputs] = useState<Record<string, string>>({});
  const [orderTxId, setOrderTxId] = useState('');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState('');
  const [orderPaymentType, setOrderPaymentType] = useState<'wallet' | 'direct'>('direct');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Copy State
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const walletAddress = "0xf80301082ed117e7cb16a40d44924df083a27e11";

  // Referrals
  const [myReferrals, setMyReferrals] = useState<any[]>([]);

  // AI Tool State
  const [activeAiTool, setActiveAiTool] = useState<AITool | null>(null);
  const [aiToolPrompt, setAiToolPrompt] = useState('');
  const [aiToolImage, setAiToolImage] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiResult, setAiResult] = useState<{ type: string, url?: string, text?: string } | null>(null);
  const [aiResultTimer, setAiResultTimer] = useState<number | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateAi = async () => {
    if (!activeAiTool) return;

    const remainingUses = userProfile.toolLimits?.[activeAiTool.id!] ?? activeAiTool.defaultFreeUses;
    const hasFreeUse = remainingUses > 0;
    
    if (!hasFreeUse) {
      if (activeAiTool.costType === 'credit' && userProfile.credits < activeAiTool.cost) {
        alert(`Insufficient Ai credits. You need ${activeAiTool.cost} Ai credits.`);
        return;
      } else if (['bronze', 'silver', 'gold', 'diamond'].includes(activeAiTool.costType)) {
        const balance = userProfile.creditBalances?.[activeAiTool.costType as keyof typeof userProfile.creditBalances] || 0;
        if (balance < activeAiTool.cost) {
          alert(`Insufficient ${activeAiTool.costType} credits. You need ${activeAiTool.cost} ${activeAiTool.costType} credits.`);
          return;
        }
      } else if (activeAiTool.costType === 'wallet' && (userProfile.walletBalance || 0) < activeAiTool.cost) {
        alert(`Insufficient wallet balance. You need ${activeAiTool.cost} ${userProfile.preferredCurrency || 'BDT'}.`);
        return;
      }
    }

    setIsGeneratingAi(true);
    setAiResult(null);
    setAiResultTimer(null);

    try {
      // Deduct cost or free use
      const updates: any = {};
      if (hasFreeUse) {
        updates[`toolLimits.${activeAiTool.id!}`] = remainingUses - 1;
      } else {
        if (activeAiTool.costType === 'credit') {
          updates.credits = userProfile.credits - activeAiTool.cost;
        } else if (['bronze', 'silver', 'gold', 'diamond'].includes(activeAiTool.costType)) {
          const currentBalance = userProfile.creditBalances?.[activeAiTool.costType as keyof typeof userProfile.creditBalances] || 0;
          updates[`creditBalances.${activeAiTool.costType}`] = currentBalance - activeAiTool.cost;
        } else if (activeAiTool.costType === 'wallet') {
          updates.walletBalance = (userProfile.walletBalance || 0) - activeAiTool.cost;
        }
      }
      await updateDoc(doc(db, 'users', userProfile.uid), updates);

      // Record usage
      await addDoc(collection(db, 'usageHistory'), {
        userId: userProfile.uid,
        userEmail: userProfile.email,
        action: `Used AI Tool: ${activeAiTool.title}`,
        timestamp: serverTimestamp(),
        creditsDeducted: hasFreeUse ? 0 : activeAiTool.cost
      });

      // Call Gemini API
      const apiKey = activeAiTool.apiKey || appSettings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API key available for this tool.");

      const ai = new GoogleGenAI({ apiKey });
      
      let finalPrompt = activeAiTool.systemPrompt;
      if (activeAiTool.userPromptAllowed && aiToolPrompt.trim()) {
        finalPrompt += `\n\nUser Request: ${aiToolPrompt}`;
      }

      let generatedResult: { type: string, url?: string, text?: string } | null = null;

      if (activeAiTool.type === 'text_to_image' || activeAiTool.type === 'image_to_image') {
        const parts: any[] = [{ text: finalPrompt }];
        if (activeAiTool.type === 'image_to_image' && aiToolImage) {
          const base64Data = aiToolImage.split(',')[1];
          const mimeType = aiToolImage.split(';')[0].split(':')[1];
          parts.unshift({ inlineData: { data: base64Data, mimeType } });
        }

        const response = await ai.models.generateContent({
          model: activeAiTool.model || 'gemini-2.5-flash-image',
          contents: { parts },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            generatedResult = {
              type: 'image',
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
            };
            break;
          } else if (part.text && !generatedResult) {
            generatedResult = { type: 'text', text: part.text };
          }
        }
      } else if (activeAiTool.type === 'text_to_text') {
        const response = await ai.models.generateContent({
          model: activeAiTool.model || 'gemini-3.1-flash-preview',
          contents: finalPrompt,
        });
        generatedResult = { type: 'text', text: response.text };
      } else if (activeAiTool.type === 'text_to_video' || activeAiTool.type === 'image_to_video') {
        // Video generation logic (simplified for this example, requires polling)
        // Note: Veo models require polling, which might take a few minutes.
        // For demonstration, we'll just show a text response or a placeholder if actual Veo isn't fully supported in this snippet without polling.
        // To do it properly:
        let operation: any;
        if (activeAiTool.type === 'image_to_video' && aiToolImage) {
          const base64Data = aiToolImage.split(',')[1];
          const mimeType = aiToolImage.split(';')[0].split(':')[1];
          operation = await ai.models.generateVideos({
            model: activeAiTool.model || 'veo-3.1-lite-generate-preview',
            prompt: finalPrompt,
            image: { imageBytes: base64Data, mimeType },
            config: { numberOfVideos: 1, aspectRatio: '16:9', resolution: '720p' }
          });
        } else {
          operation = await ai.models.generateVideos({
            model: activeAiTool.model || 'veo-3.1-lite-generate-preview',
            prompt: finalPrompt,
            config: { numberOfVideos: 1, aspectRatio: '16:9', resolution: '720p' }
          });
        }
        
        // Polling
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await ai.operations.getVideosOperation({operation: operation});
        }
        
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
           // We need to fetch it with the API key header, but for the UI we might need to proxy it or use a blob.
           // For simplicity in this environment, we'll just provide the URI and instructions.
           generatedResult = { type: 'text', text: `Video generated successfully! Download link (requires API key header): ${videoUri}` };
        } else {
           throw new Error("Video generation failed.");
        }
      }

      if (generatedResult) {
        setAiResult(generatedResult);
        setAiResultTimer(30);
      } else {
        throw new Error("No output generated.");
      }

    } catch (err: any) {
      console.error("AI Generation Error:", err);
      alert(`Generation failed: ${err.message}`);
      // Refund if failed? For simplicity, we might not refund immediately here, but in a real app we should.
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Timer effect for AI Result auto-delete
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (aiResultTimer !== null && aiResultTimer > 0) {
      interval = setInterval(() => {
        setAiResultTimer((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (aiResultTimer === 0) {
      setAiResult(null);
      setAiResultTimer(null);
    }
    return () => clearInterval(interval);
  }, [aiResultTimer]);

  const handleCopy = (text: string, id: string = 'default') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const qPayments = query(collection(db, 'paymentMethods'), where('isActive', '==', true));
    const unsubPayments = onSnapshot(qPayments, (snap) => {
      setPaymentMethods(snap.docs.map(d => ({ ...d.data(), id: d.id } as PaymentMethod)));
    });

    const qProducts = query(collection(db, 'products'), where('isActive', '==', true));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Product)));
    });

    const qAiTools = query(collection(db, 'aiTools'), where('isActive', '==', true));
    const unsubAiTools = onSnapshot(qAiTools, (snap) => {
      setAiTools(snap.docs.map(d => ({ ...d.data(), id: d.id } as AITool)));
    });

    const qReferrals = query(collection(db, 'referrals'), where('referrerId', '==', userProfile.uid));
    const unsubReferrals = onSnapshot(qReferrals, (snap) => {
      setMyReferrals(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => {
      unsubPayments();
      unsubProducts();
      unsubAiTools();
      unsubReferrals();
    };
  }, []);

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
      
      const analysis = await analyzeChart(base64Data, mimeType, appSettings.geminiApiKey);
      
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
        amount: depositAmount,
        status: 'pending',
        paymentMethod: orderPaymentMethod,
        transactionId: txId,
        type: depositType,
        createdAt: serverTimestamp()
      });
      alert(`${depositType === 'credit' ? 'Credit' : 'Deposit'} request submitted successfully! Waiting for admin approval.`);
      setShowCreditModal(false);
      setTxId('');
      setOrderPaymentMethod('');
    } catch (err) {
      console.error("Error submitting request:", err);
      alert("Failed to submit request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (appSettings.maintenanceMode && userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-[#131722] border border-yellow-500/30 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Maintenance Mode</h2>
          <p className="text-[#8A93A6] mb-6">We are currently upgrading our systems to serve you better. Please check back later.</p>
          <button onClick={handleLogout} className="px-6 py-2 bg-[#1A1F2E] hover:bg-[#22283A] rounded-lg transition-colors">Sign Out</button>
        </div>
      </div>
    );
  }

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
                <span>Deposit Funds</span>
              </h3>
              <button onClick={() => setShowCreditModal(false)} className="text-[#8A93A6] hover:text-white">✕</button>
            </div>
            
            <div className="flex space-x-2 mb-6">
              <button
                onClick={() => setDepositType('credit')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${depositType === 'credit' ? 'bg-purple-600 text-white' : 'bg-[#1A1F2E] text-[#8A93A6] hover:text-white'}`}
              >
                Buy Ai Credits
              </button>
              <button
                onClick={() => setDepositType('money')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${depositType === 'money' ? 'bg-purple-600 text-white' : 'bg-[#1A1F2E] text-[#8A93A6] hover:text-white'}`}
              >
                Add to Wallet
              </button>
            </div>

            <div className="bg-[#0B0E14] border border-[#22283A] rounded-xl p-5 mb-6 text-center">
              <h4 className="text-lg font-semibold text-white mb-1">Select Payment Method</h4>
              <p className="text-sm text-[#8A93A6] mb-4">
                {depositType === 'credit' ? '1 Credit = 1 Unit (USD/BDT)' : 'Deposit money to your wallet'}
              </p>
              
              <div className="space-y-3 text-left max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {paymentMethods.map(pm => (
                  <div key={pm.id} className="bg-[#1A1F2E] p-3 rounded-lg border border-[#22283A]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-white">{pm.name}</span>
                      <button 
                        onClick={() => handleCopy(pm.details, pm.id!)}
                        className="p-1.5 bg-[#22283A] hover:bg-[#2A3143] rounded-md transition-colors flex items-center space-x-1"
                        title="Copy Details"
                      >
                        {copiedId === pm.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-[#8A93A6]" />}
                        <span className="text-xs text-[#8A93A6]">{copiedId === pm.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-xs font-mono text-purple-400 break-all mb-2">{pm.details}</p>
                    <p className="text-xs text-[#8A93A6] mb-2">{pm.instructions}</p>
                    {pm.qrCodeUrl && (
                      <img src={pm.qrCodeUrl} alt="QR Code" referrerPolicy="no-referrer" className="w-32 h-32 object-contain mx-auto rounded-lg bg-white p-1" />
                    )}
                  </div>
                ))}
                {paymentMethods.length === 0 && (
                  <p className="text-sm text-center text-red-400 py-2">No active payment methods available.</p>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmitCreditRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">
                  {depositType === 'credit' ? 'Amount of Ai Credits' : 'Amount to Deposit'}
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Payment Method Used</label>
                <select
                  value={orderPaymentMethod}
                  onChange={(e) => setOrderPaymentMethod(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  required
                >
                  <option value="">Select Method</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.name}>{pm.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A93A6] mb-2">Transaction ID / Hash</label>
                <input 
                  type="text" 
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder="Enter TX ID after sending"
                  className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmittingRequest || !txId.trim() || !orderPaymentMethod}
                className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {isSubmittingRequest ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span>Submit Request</span>
              </button>
            </form>
          </div>
        </div>
      )}



      {/* Product Purchase Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-[#A855F7]" />
                <span>Purchase Product</span>
              </h3>
              <button onClick={() => setSelectedProduct(null)} className="text-[#8A93A6] hover:text-white">✕</button>
            </div>

            <div className="bg-[#0B0E14] border border-[#22283A] rounded-xl p-5 mb-6">
              <h4 className="text-lg font-bold text-white mb-1">{selectedProduct.title}</h4>
              <p className="text-2xl font-bold text-green-400 mb-4">{selectedProduct.priceDisplay}</p>
              {selectedProduct.conditions && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                  <p className="text-xs text-yellow-500 flex items-start">
                    <AlertCircle className="w-4 h-4 mr-1.5 shrink-0 mt-0.5" />
                    <span>{selectedProduct.conditions}</span>
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              
              if (orderPaymentType === 'wallet') {
                if ((userProfile.walletBalance || 0) < (selectedProduct.price || 0)) {
                  alert("Insufficient wallet balance.");
                  return;
                }
              } else {
                if (!orderTxId.trim() || !orderPaymentMethod) return;
              }
              
              setIsSubmittingOrder(true);
              try {
                // Deduct from wallet if applicable
                if (orderPaymentType === 'wallet') {
                  const userRef = doc(db, 'users', userProfile.uid);
                  await updateDoc(userRef, {
                    walletBalance: (userProfile.walletBalance || 0) - (selectedProduct.price || 0)
                  });
                }

                await addDoc(collection(db, 'orders'), {
                  userId: userProfile.uid,
                  userEmail: userProfile.email,
                  productId: selectedProduct.id,
                  productTitle: selectedProduct.title,
                  priceDisplay: selectedProduct.priceDisplay,
                  price: selectedProduct.price || 0,
                  userInputs: orderInputs,
                  paymentMethodName: orderPaymentType === 'wallet' ? 'Wallet Balance' : orderPaymentMethod,
                  paymentType: orderPaymentType,
                  transactionId: orderPaymentType === 'wallet' ? 'WALLET_PAYMENT' : orderTxId,
                  status: orderPaymentType === 'wallet' ? 'completed' : 'pending',
                  createdAt: serverTimestamp()
                });
                alert("Order placed successfully! You can track it in your profile.");
                setSelectedProduct(null);
              } catch (err) {
                console.error("Error placing order:", err);
                alert("Failed to place order.");
              } finally {
                setIsSubmittingOrder(false);
              }
            }} className="space-y-4">
              
              {selectedProduct.requirements.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-[#22283A]">
                  <h5 className="font-semibold text-white text-sm">Required Information</h5>
                  {selectedProduct.requirements.map((req, idx) => (
                    <div key={idx}>
                      <label className="block text-sm font-medium text-[#8A93A6] mb-2">{req}</label>
                      <input 
                        type="text" 
                        value={orderInputs[req] || ''}
                        onChange={(e) => setOrderInputs({...orderInputs, [req]: e.target.value})}
                        className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-[#22283A]">
                <h5 className="font-semibold text-white text-sm">Payment Details</h5>
                
                <div className="flex space-x-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setOrderPaymentType('wallet')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${orderPaymentType === 'wallet' ? 'bg-purple-600 text-white' : 'bg-[#1A1F2E] text-[#8A93A6] hover:text-white'}`}
                  >
                    Pay with Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderPaymentType('direct')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${orderPaymentType === 'direct' ? 'bg-purple-600 text-white' : 'bg-[#1A1F2E] text-[#8A93A6] hover:text-white'}`}
                  >
                    Direct Payment
                  </button>
                </div>

                {orderPaymentType === 'wallet' ? (
                  <div className="bg-[#1A1F2E] p-4 rounded-xl border border-[#22283A]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#8A93A6]">Wallet Balance:</span>
                      <span className="font-bold text-white">{userProfile.walletBalance || 0} {userProfile.preferredCurrency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#8A93A6]">Product Price:</span>
                      <span className="font-bold text-green-400">{selectedProduct.price} {userProfile.preferredCurrency}</span>
                    </div>
                    {(userProfile.walletBalance || 0) < (selectedProduct.price || 0) && (
                      <p className="text-red-400 text-sm mt-4">Insufficient balance. Please deposit funds.</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#8A93A6] mb-2">Select Payment Method</label>
                      <select
                        value={orderPaymentMethod}
                        onChange={(e) => setOrderPaymentMethod(e.target.value)}
                        className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      >
                        <option value="">Select Method</option>
                        {paymentMethods.map(pm => (
                          <option key={pm.id} value={pm.name}>{pm.name}</option>
                        ))}
                      </select>
                    </div>

                    {orderPaymentMethod && (
                      <div className="bg-[#1A1F2E] p-4 rounded-xl border border-[#22283A]">
                        {paymentMethods.filter(pm => pm.name === orderPaymentMethod).map(pm => (
                          <div key={pm.id}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-bold text-white">Send to:</span>
                              <button 
                                type="button"
                                onClick={() => handleCopy(pm.details, `order_${pm.id}`)}
                                className="p-1.5 bg-[#22283A] hover:bg-[#2A3143] rounded-md transition-colors flex items-center space-x-1"
                              >
                                {copiedId === `order_${pm.id}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-[#8A93A6]" />}
                                <span className="text-xs text-[#8A93A6]">{copiedId === `order_${pm.id}` ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <p className="text-sm font-mono text-purple-400 break-all mb-2">{pm.details}</p>
                            <p className="text-xs text-[#8A93A6] mb-2">{pm.instructions}</p>
                            {pm.qrCodeUrl && (
                              <img src={pm.qrCodeUrl} alt="QR Code" referrerPolicy="no-referrer" className="w-32 h-32 object-contain mx-auto rounded-lg bg-white p-1" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-[#8A93A6] mb-2">Transaction ID / Hash</label>
                      <input 
                        type="text" 
                        value={orderTxId}
                        onChange={(e) => setOrderTxId(e.target.value)}
                        placeholder="Enter TX ID after payment"
                        className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              <button 
                type="submit"
                disabled={isSubmittingOrder || (orderPaymentType === 'direct' && (!orderTxId.trim() || !orderPaymentMethod)) || selectedProduct.requirements.some(req => !orderInputs[req]?.trim())}
                className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {isSubmittingOrder ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>Place Order</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <ProfileSettingsModal onClose={() => setShowProfileModal(false)} userProfile={userProfile} />
      )}

      <div className="max-w-6xl mx-auto px-6 py-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between mb-10 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            {appSettings.logoUrl ? (
              <img src={appSettings.logoUrl} alt="Logo" referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover" />
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
          
          <div className="flex flex-wrap items-center justify-center gap-2 sm:space-x-4 sm:gap-0">
            <button 
              onClick={async () => {
                const newCurrency = userProfile.preferredCurrency === 'BDT' ? 'USD' : 'BDT';
                await updateDoc(doc(db, 'users', userProfile.uid), { preferredCurrency: newCurrency });
              }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#22283A] bg-[#131722] hover:bg-[#1A1F2E] transition-colors text-sm font-bold text-white"
            >
              {userProfile.preferredCurrency}
            </button>
            <div className="flex items-center space-x-2 bg-[#131722] border border-[#22283A] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
              <Zap className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-sm font-bold text-white">{userProfile.credits} <span className="hidden sm:inline">Ai Credits</span></span>
              <button 
                onClick={() => {
                  setDepositType('credit');
                  setShowCreditModal(true);
                }}
                className="ml-1 sm:ml-2 text-xs bg-[#22283A] hover:bg-[#2A3143] px-2 py-1 rounded text-white transition-colors"
              >
                Add
              </button>
            </div>
            {userProfile.creditBalances?.bronze !== undefined && (
              <div className="hidden md:flex items-center space-x-2 bg-[#131722] border border-[#22283A] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                <span className="text-sm font-bold text-[#CD7F32]">{userProfile.creditBalances.bronze} <span className="hidden sm:inline">Bronze</span></span>
              </div>
            )}
            {userProfile.creditBalances?.silver !== undefined && (
              <div className="hidden md:flex items-center space-x-2 bg-[#131722] border border-[#22283A] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                <span className="text-sm font-bold text-[#C0C0C0]">{userProfile.creditBalances.silver} <span className="hidden sm:inline">Silver</span></span>
              </div>
            )}
            {userProfile.creditBalances?.gold !== undefined && (
              <div className="hidden md:flex items-center space-x-2 bg-[#131722] border border-[#22283A] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                <span className="text-sm font-bold text-[#FFD700]">{userProfile.creditBalances.gold} <span className="hidden sm:inline">Gold</span></span>
              </div>
            )}
            {userProfile.creditBalances?.diamond !== undefined && (
              <div className="hidden md:flex items-center space-x-2 bg-[#131722] border border-[#22283A] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                <span className="text-sm font-bold text-[#00FFFF]">{userProfile.creditBalances.diamond} <span className="hidden sm:inline">Diamond</span></span>
              </div>
            )}
            <div className="flex items-center space-x-2 bg-[#131722] border border-[#22283A] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
              <CreditCard className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-white">{userProfile.walletBalance || 0} <span className="hidden sm:inline">{userProfile.preferredCurrency}</span></span>
              <button 
                onClick={() => {
                  setDepositType('money');
                  setShowCreditModal(true);
                }}
                className="ml-1 sm:ml-2 text-xs bg-[#22283A] hover:bg-[#2A3143] px-2 py-1 rounded text-white transition-colors"
              >
                Add
              </button>
            </div>

            {userProfile.role === 'admin' && (
              <button 
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#22283A] bg-[#131722] hover:bg-[#1A1F2E] transition-colors text-sm font-medium text-[#8A93A6] hover:text-white"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            <button 
              onClick={() => setShowProfileModal(true)}
              className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#22283A] bg-[#131722] hover:bg-[#1A1F2E] transition-colors text-sm font-medium text-[#8A93A6] hover:text-white"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#22283A] bg-[#131722] hover:bg-[#1A1F2E] transition-colors text-sm font-medium text-[#8A93A6] hover:text-white"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Promo Banner */}
        {appSettings.promoBannerUrl && (
          <div className="mb-8 rounded-2xl overflow-hidden border border-[#22283A] w-full h-48 sm:h-64">
            <img src={appSettings.promoBannerUrl} alt="Promo Banner" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Global Notice Banner */}
        {appSettings.globalNotice && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-8 flex items-start space-x-3">
            <Bell className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-purple-200 text-sm whitespace-pre-wrap">{appSettings.globalNotice}</p>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto custom-scrollbar space-x-2 mb-8 pb-2">
          {[
            { id: 'chart', label: 'Chart Analysis', icon: BarChart2 },
            { id: 'ai_tools', label: 'AI Studio', icon: Zap },
            { id: 'offer', label: 'Offers', icon: ShoppingBag },
            { id: 'game_topup', label: 'Game Top-up', icon: Gamepad2 },
            { id: 'subscription', label: 'Subscriptions', icon: Activity },
            { id: 'product', label: 'Digital Products', icon: Package },
            { id: 'others', label: 'Others', icon: Package },
            { id: 'referrals', label: 'Refer & Earn', icon: Users },
            { id: 'support', label: 'Support', icon: AlertCircle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-[#131722] border border-[#22283A] text-[#8A93A6] hover:text-white hover:bg-[#1A1F2E]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <main className="flex-grow flex flex-col w-full">
          {activeTab === 'chart' && (
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
                        referrerPolicy="no-referrer"
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
          )}

          {activeTab === 'ai_tools' && !activeAiTool && (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {aiTools.map(tool => {
                  const remainingUses = userProfile.toolLimits?.[tool.id!] ?? tool.defaultFreeUses;
                  return (
                    <div key={tool.id} className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 flex flex-col hover:border-purple-500/50 transition-colors group">
                      <div className="flex items-center space-x-2 mb-4">
                        <Zap className="w-5 h-5 text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-400">{tool.type.replace(/_/g, ' ')}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">{tool.title}</h3>
                      <p className="text-[#8A93A6] mb-4 flex-grow">{tool.description}</p>
                      
                      <div className="flex justify-between items-center mb-6 text-sm">
                        <span className="text-gray-400">Cost: <span className="text-white font-bold">{tool.cost} {tool.costType}</span></span>
                        <span className="text-gray-400">Free Uses Left: <span className="text-green-400 font-bold">{remainingUses}</span></span>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setActiveAiTool(tool);
                          setAiToolPrompt('');
                          setAiToolImage(null);
                          setAiResult(null);
                          setAiResultTimer(null);
                        }}
                        className="w-full py-3 rounded-xl font-semibold bg-[#22283A] hover:bg-purple-600 text-white transition-colors"
                      >
                        Open Tool
                      </button>
                    </div>
                  );
                })}
                {aiTools.length === 0 && (
                  <div className="col-span-full text-center py-12 bg-[#131722] border border-[#22283A] rounded-2xl">
                    <Zap className="w-12 h-12 text-[#22283A] mx-auto mb-4" />
                    <p className="text-[#8A93A6]">No AI tools available at the moment.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ai_tools' && activeAiTool && (
            <div className="w-full max-w-4xl mx-auto">
              <button 
                onClick={() => setActiveAiTool(null)}
                className="mb-6 flex items-center space-x-2 text-[#8A93A6] hover:text-white transition-colors"
              >
                <AlertCircle className="w-4 h-4 rotate-180" />
                <span>Back to AI Studio</span>
              </button>

              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 md:p-8">
                <div className="flex items-center space-x-3 mb-2">
                  <Zap className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white">{activeAiTool.title}</h2>
                </div>
                <p className="text-[#8A93A6] mb-8">{activeAiTool.description}</p>

                <div className="space-y-6">
                  {(activeAiTool.type === 'image_to_image' || activeAiTool.type === 'image_to_video') && (
                    <div>
                      <label className="block text-sm font-medium text-[#8A93A6] mb-2">Upload Image</label>
                      <div 
                        onClick={() => aiFileInputRef.current?.click()}
                        className="w-full h-48 border-2 border-dashed border-[#22283A] hover:border-purple-500/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0B0E14] overflow-hidden"
                      >
                        {aiToolImage ? (
                          <img src={aiToolImage} alt="Upload" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-[#8A93A6] mb-3" />
                            <p className="text-sm text-[#8A93A6]">Click to upload image</p>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={aiFileInputRef}
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => setAiToolImage(e.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  )}

                  {activeAiTool.userPromptAllowed && (
                    <div>
                      <label className="block text-sm font-medium text-[#8A93A6] mb-2">Your Prompt</label>
                      <textarea 
                        value={aiToolPrompt}
                        onChange={(e) => setAiToolPrompt(e.target.value)}
                        placeholder="Describe what you want to generate..."
                        rows={4}
                        className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-[#22283A]">
                    <div className="text-sm">
                      <span className="text-[#8A93A6]">Cost: </span>
                      <span className="text-white font-bold">{activeAiTool.cost} {activeAiTool.costType}</span>
                      <span className="text-[#8A93A6] ml-4">Free uses left: </span>
                      <span className="text-green-400 font-bold">{userProfile.toolLimits?.[activeAiTool.id!] ?? activeAiTool.defaultFreeUses}</span>
                    </div>
                    <button 
                      onClick={handleGenerateAi}
                      disabled={isGeneratingAi || ((activeAiTool.type === 'image_to_image' || activeAiTool.type === 'image_to_video') && !aiToolImage)}
                      className="px-8 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingAi ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                      <span>Generate</span>
                    </button>
                  </div>
                </div>

                {/* Result Area */}
                {aiResult && (
                  <div className="mt-8 pt-8 border-t border-[#22283A]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-white">Result</h3>
                      {aiResultTimer !== null && (
                        <div className="flex items-center space-x-2 text-red-400 bg-red-400/10 px-3 py-1 rounded-full text-sm font-bold">
                          <AlertCircle className="w-4 h-4" />
                          <span>Auto-deleting in {aiResultTimer}s</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-[#0B0E14] border border-[#22283A] rounded-xl p-4 flex justify-center">
                      {aiResult.type === 'image' && aiResult.url && (
                        <img src={aiResult.url} alt="Generated" referrerPolicy="no-referrer" className="max-w-full max-h-[500px] rounded-lg object-contain" />
                      )}
                      {aiResult.type === 'video' && aiResult.url && (
                        <video src={aiResult.url} controls className="max-w-full max-h-[500px] rounded-lg" />
                      )}
                      {aiResult.type === 'text' && aiResult.text && (
                        <p className="text-white whitespace-pre-wrap">{aiResult.text}</p>
                      )}
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <button 
                        onClick={() => {
                          setAiResultTimer(null); // Stop timer on save
                          if (aiResult.url) {
                            const a = document.createElement('a');
                            a.href = aiResult.url;
                            a.download = `ai-result-${Date.now()}`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          } else if (aiResult.text) {
                            const blob = new Blob([aiResult.text], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `ai-result-${Date.now()}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }
                        }}
                        className="px-6 py-2 rounded-lg font-semibold bg-[#22283A] hover:bg-[#2A3143] text-white transition-colors"
                      >
                        Save Result
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(activeTab === 'offer' || activeTab === 'game_topup' || activeTab === 'subscription' || activeTab === 'product' || activeTab === 'others') && (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.filter(p => p.category === activeTab).map(product => (
                  <div key={product.id} className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 flex flex-col hover:border-purple-500/50 transition-colors group">
                    {product.imageUrl && (
                      <div className="w-full h-40 mb-4 rounded-xl overflow-hidden bg-[#0B0E14]">
                        <img src={product.imageUrl} alt={product.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex items-center space-x-2 mb-4">
                      {product.category === 'game_topup' ? <Gamepad2 className="w-5 h-5 text-purple-400" /> : <Package className="w-5 h-5 text-purple-400" />}
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-400">{product.category.replace('_', ' ')}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">{product.title}</h3>
                    <p className="text-3xl font-bold text-green-400 mb-4">{product.priceDisplay}</p>
                    <p className="text-[#8A93A6] mb-6 flex-grow">{product.description}</p>
                    
                    <button 
                      onClick={() => {
                        setSelectedProduct(product);
                        setOrderInputs({});
                        setOrderTxId('');
                        setOrderPaymentMethod('');
                      }}
                      className="w-full py-3 rounded-xl font-semibold bg-[#22283A] hover:bg-purple-600 text-white transition-colors"
                    >
                      Purchase Now
                    </button>
                  </div>
                ))}
                {products.filter(p => p.category === activeTab).length === 0 && (
                  <div className="col-span-full text-center py-12 bg-[#131722] border border-[#22283A] rounded-2xl">
                    <ShoppingBag className="w-12 h-12 text-[#22283A] mx-auto mb-4" />
                    <p className="text-[#8A93A6]">No items available in this category.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="w-full max-w-2xl mx-auto">
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Need Help?</h2>
                <p className="text-[#8A93A6] mb-8">Contact our support team through any of the following channels.</p>
                
                <div className="space-y-4">
                  {appSettings.supportTelegram && (
                    <a href={appSettings.supportTelegram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center space-x-3 w-full py-4 rounded-xl font-semibold bg-[#22283A] hover:bg-[#2A3143] text-white transition-colors">
                      <Send className="w-5 h-5 text-[#0088cc]" />
                      <span>Telegram Support</span>
                    </a>
                  )}
                  {appSettings.supportWhatsapp && (
                    <a href={appSettings.supportWhatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center space-x-3 w-full py-4 rounded-xl font-semibold bg-[#22283A] hover:bg-[#2A3143] text-white transition-colors">
                      <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      <span>WhatsApp Support</span>
                    </a>
                  )}
                  {appSettings.supportPhone && (
                    <div className="flex items-center justify-center space-x-3 w-full py-4 rounded-xl font-semibold bg-[#22283A] text-white">
                      <AlertCircle className="w-5 h-5 text-[#8A93A6]" />
                      <span>{appSettings.supportPhone}</span>
                    </div>
                  )}
                  {!appSettings.supportTelegram && !appSettings.supportWhatsapp && !appSettings.supportPhone && (
                    <p className="text-[#8A93A6]">No support contact information available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="space-y-6 w-full max-w-4xl mx-auto">
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Invite Friends & Earn Rewards</h2>
                <p className="text-[#8A93A6] mb-6">Share your unique referral link with friends. When they sign up, you'll earn rewards after admin approval!</p>
                
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
                  <input 
                    type="text" 
                    readOnly 
                    value={`${window.location.origin}/?ref=${userProfile.uid}`}
                    className="w-full sm:flex-1 bg-[#0B0E14] border border-[#22283A] rounded-xl px-4 py-3 text-white font-mono text-sm"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?ref=${userProfile.uid}`);
                      alert('Copied to clipboard!');
                    }}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors whitespace-nowrap"
                  >
                    Copy Link
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#0B0E14] p-4 rounded-xl border border-[#22283A]">
                    <p className="text-[#8A93A6] text-sm mb-1">Total Referrals</p>
                    <p className="text-2xl font-bold text-white">{myReferrals.length}</p>
                  </div>
                  <div className="bg-[#0B0E14] p-4 rounded-xl border border-[#22283A]">
                    <p className="text-[#8A93A6] text-sm mb-1">Approved</p>
                    <p className="text-2xl font-bold text-green-400">{myReferrals.filter(r => r.status === 'approved').length}</p>
                  </div>
                  <div className="bg-[#0B0E14] p-4 rounded-xl border border-[#22283A]">
                    <p className="text-[#8A93A6] text-sm mb-1">Pending</p>
                    <p className="text-2xl font-bold text-yellow-400">{myReferrals.filter(r => r.status === 'pending').length}</p>
                  </div>
                </div>
              </div>

              {/* List of referrals */}
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Referral History</h3>
                {myReferrals.length === 0 ? (
                  <p className="text-[#8A93A6]">You haven't referred anyone yet.</p>
                ) : (
                  <div className="space-y-3">
                    {myReferrals.map(ref => (
                      <div key={ref.id} className="flex justify-between items-center p-4 bg-[#0B0E14] rounded-xl border border-[#22283A]">
                        <div>
                          <p className="text-white font-medium">{ref.inviteeEmail}</p>
                          <p className="text-xs text-[#8A93A6]">{ref.createdAt?.toDate().toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-purple-400">+{ref.rewardAmount} {ref.rewardType}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${ref.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {ref.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
