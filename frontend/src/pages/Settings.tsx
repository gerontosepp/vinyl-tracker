import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
 
const Settings: React.FC = () => {
  const { user, updateDiscogs, isLoading, isSyncing, performSync, resetAllListens, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [discogsUsername, setDiscogsUsername] = useState(user?.discogsUsername || '');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
 
  const navigate = useNavigate();
 
  const handleScan = () => {
    navigate('/', { state: { scan: true } });
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
 
    if (!password) {
      showToast('Current password is required to encrypt your token.', 'error');
      return;
    }
 
    try {
      await updateDiscogs(discogsUsername, token, password);
      showToast('Settings updated successfully!', 'success');
      setToken('');
      setPassword('');
    } catch (err) {
      showToast('Failed to update settings. Check your password.', 'error');
    }
  };
 
  const handleResetListens = async () => {
    setShowResetConfirm(false);
    try {
      if (user) {
        await resetAllListens(user.username);
        // Toast is handled in AuthContext
      }
    } catch (err) {
      // Toast is handled in AuthContext
    }
  };
 
  return (
    <Layout onScanClick={handleScan}>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2 px-2">
          Profile & Settings
        </h1>
 
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN - USER PROFILE */}
          <div className="col-span-1 lg:col-span-5 space-y-6">
            {/* User Profile Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-8 text-center transition-colors">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center border-4 border-slate-50 dark:border-slate-900 shadow-inner overflow-hidden relative z-10">
                  <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-md opacity-20 -z-10 animate-pulse"></div>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {user?.username}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                {user?.username}@vinyltracker.app
              </p>
 
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-600">
                <button
                  onClick={logout}
                  className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
 
          {/* RIGHT COLUMN - SYSTEM SETTINGS */}
          <div className="col-span-1 lg:col-span-7 space-y-6">
            {/* Appearance Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                Appearance
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                    Theme Preference
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Active mode
                  </p>
                </div>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                  className="border border-slate-200 dark:border-slate-600 rounded-xl py-2 px-4 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 shadow-sm font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>
 
            {/* Discogs Integration Details */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Discogs Integration
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                Manage your Discogs API connectivity for scanning and syncing your collection.
              </p>
 
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={discogsUsername}
                      onChange={(e) => setDiscogsUsername(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      New Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Enter only if changing"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                </div>
 
                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Required to encrypt token"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all focus:border-amber-400"
                  />
                </div>
 
                <div className="flex justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-600">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm hover:-translate-y-0.5"
                  >
                    {isLoading ? 'Saving...' : 'Save Connectivity'}
                  </button>
                </div>
              </form>
            </div>
 
            {/* Data Management */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Data Management
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                Sync your collection manually or export your data.
              </p>
 
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    if (user) performSync(user.username);
                  }}
                  disabled={isSyncing}
                  className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-bold px-4 py-3 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Force Sync Collection
                </button>
                <button 
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isSyncing}
                  className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 font-bold px-4 py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Reset All Listens
                </button>
                <button className="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                  Export Data (CSV)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
 
      {/* Confirm Dialog for Reset Listens */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 max-w-md">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              Reset All Listening Events?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              This will permanently delete all your listening history. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetListens}
                disabled={isSyncing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {isSyncing ? 'Resetting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
 
export default Settings;
