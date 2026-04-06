/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { UserProfile, AppSettings } from './types';

import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    appName: "Sharfin's AI",
    logoUrl: "",
    defaultCredits: 5,
    paymentMethodInfo: "Binance Dollar (BUSD) - Wallet: 0x..."
  });

  // Load App Settings
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'appSettings'), (docSnap) => {
      if (docSnap.exists()) {
        setAppSettings(docSnap.data() as AppSettings);
      }
    });
    return () => unsubSettings();
  }, []);

  // Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Create or update user profile in Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || currentUser.email?.split('@')[0],
              photoURL: currentUser.photoURL || null,
              createdAt: serverTimestamp(),
              credits: 0,
              role: currentUser.email === 'piccisarfin@gmail.com' ? 'admin' : 'user',
              isBlocked: false
            });
          }
          
          // Listen to user profile changes
          onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              setUserProfile(doc.data() as UserProfile);
            }
            setIsAuthReady(true);
          });
        } catch (err) {
          console.error("Error saving user profile:", err);
          setIsAuthReady(true);
        }
      } else {
        setUserProfile(null);
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [appSettings.defaultCredits]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            !user || !userProfile ? (
              <Auth appSettings={appSettings} />
            ) : (
              <Dashboard userProfile={userProfile} appSettings={appSettings} />
            )
          } 
        />
        <Route 
          path="/admin" 
          element={
            userProfile?.role === 'admin' ? (
              <Admin />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
