import React, { useState } from 'react';
import { Settings, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth } from '../firebase';
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

interface ProfileSettingsModalProps {
  onClose: () => void;
}

export default function ProfileSettingsModal({ onClose }: ProfileSettingsModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      <div className="bg-[#131722] border border-[#22283A] rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center space-x-2 text-white">
            <Settings className="w-5 h-5 text-[#A855F7]" />
            <span>Account Settings</span>
          </h3>
          <button onClick={onClose} className="text-[#8A93A6] hover:text-white">✕</button>
        </div>

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
            <label className="block text-sm font-medium text-[#8A93A6] mb-2">New Email (Optional)</label>
            <input 
              type="email" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={auth.currentUser?.email || "Enter new email"}
              className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8A93A6] mb-2">New Password (Optional)</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full bg-[#0B0E14] border border-[#22283A] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-500 transition-colors"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !currentPassword}
            className="w-full py-3.5 mt-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Update Profile</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
