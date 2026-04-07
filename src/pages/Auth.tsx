import React, { useState } from 'react';
import { Activity, AlertCircle, Loader2, Mail, Lock } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { AppSettings } from '../types';

interface AuthProps {
  appSettings: AppSettings;
}

export default function Auth({ appSettings }: AuthProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setIsResetting(true);
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      console.error("Reset error:", err);
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let errorMessage = 'Authentication failed. Please try again.';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errorMessage = 'Invalid email or password.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-sans flex items-center justify-center selection:bg-purple-500/30">
      <div className="max-w-md w-full bg-[#131722] border border-[#22283A] rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        {appSettings.logoUrl ? (
          <img src={appSettings.logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mb-6 shadow-lg" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center shadow-lg mb-6">
            <Activity className="w-8 h-8 text-white" />
          </div>
        )}
        <h1 className="text-3xl font-bold text-white tracking-wide mb-2">{appSettings.appName}</h1>
        <p className="text-[#8A93A6] mb-8">Sign in to access professional chart analysis tools.</p>
        
        {error && (
          <div className="w-full mb-6 border border-red-500/20 bg-red-500/10 rounded-xl p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200 text-left">{error}</p>
          </div>
        )}

        {success && (
          <div className="w-full mb-6 border border-green-500/20 bg-green-500/10 rounded-xl p-4 flex items-start space-x-3">
            <Activity className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-200 text-left">{success}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A93A6]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#8A93A6] focus:outline-none focus:border-purple-500 transition-colors"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A93A6]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#8A93A6] focus:outline-none focus:border-purple-500 transition-colors"
              required
              minLength={6}
            />
          </div>
          
          {!isSignUp && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={isResetting}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                {isResetting ? 'Sending...' : 'Forgot Password?'}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-sm text-[#8A93A6]">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-[#A855F7] hover:text-[#C084FC] font-medium transition-colors"
          >
            {isSignUp ? 'Sign In' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
