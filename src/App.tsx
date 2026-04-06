/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, Image as ImageIcon, Crosshair, Zap, BarChart2, LogOut, LogIn } from 'lucide-react';
import { analyzeChart, AnalysisResult } from './lib/gemini';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Create or update user profile in Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Error saving user profile:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : 'Failed to log in.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setImage(null);
      setResult(null);
      setError(null);
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
      setResult(analysis);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-white font-sans flex items-center justify-center selection:bg-purple-500/30">
        <div className="max-w-md w-full bg-[#131722] border border-[#22283A] rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg mb-6">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide mb-2">Sharfin's AI</h1>
          <p className="text-[#8A93A6] mb-8">Sign in to access professional chart analysis tools.</p>
          
          {error && (
            <div className="w-full mb-6 border border-red-500/20 bg-red-500/10 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200 text-left">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-3 bg-white text-black hover:bg-gray-100 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 animate-spin text-black" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-sans overflow-x-hidden selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto px-6 py-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Sharfin's AI</h1>
              <p className="text-[11px] text-[#8A93A6] font-bold tracking-widest uppercase mt-0.5">Professional Chart Analysis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {user.photoURL && (
              <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-[#22283A]" />
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

        <main className="flex-grow flex flex-col w-full">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Image Input */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-6 flex flex-col h-full">
                <div className="flex items-center space-x-2 mb-5">
                  <ImageIcon className="w-5 h-5 text-[#8A93A6]" />
                  <h2 className="text-lg font-bold text-white">Chart Input</h2>
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
