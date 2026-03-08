import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { useNavigate } from 'react-router-dom';

import Layout from '../components/Layout/Layout';

const Settings: React.FC = () => {
  const { user, updateDiscogs, isLoading, isSyncing, performSync } = useAuth();
  const { theme, setTheme } = useTheme();
  const [discogsUsername, setDiscogsUsername] = useState(user?.discogsUsername || '');
  const [token, setToken] = useState(''); // Don't verify existing token for security, just let set new
  const [password, setPassword] = useState(''); // Required to encrypt
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleScan = () => {
    navigate('/', { state: { scan: true } });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');

    if (!password) {
      setError('Current password is required to encrypt your token.');
      return;
    }

    try {
      await updateDiscogs(discogsUsername, token, password);
      setMsg('Settings updated successfully!');
      // Clear sensitive fields
      setToken('');
      setPassword('');
      // Background sync will be triggered by AuthContext
    } catch (err) {
      console.error(err);
      setError('Failed to update settings. Check your password.');
    }
  };

  return (
    <Layout onScanClick={handleScan}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-6 md:p-8 max-w-2xl mx-auto space-y-8 transition-colors">
        <div>
          <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100 tracking-tight">Settings</h1>

          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
            Appearance
          </h2>
          <div className="mb-8">
            <label
              htmlFor="themeSelect"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Theme Preference
            </label>
            <select
              id="themeSelect"
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="mt-1 block w-full md:w-auto border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System Default</option>
            </select>
          </div>

          <hr className="my-8 border-slate-200 dark:border-slate-700/50" />

          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
            Discogs Integration
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            To enable scanning, please provide your Discogs credentials. Your token is encrypted
            securely using your password.
          </p>

          {msg && <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 p-3 mb-6 rounded-xl text-sm font-medium">{msg}</div>}
          {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 p-3 mb-6 rounded-xl text-sm font-medium">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="discogsUsername"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Discogs Username
              </label>
              <input
                id="discogsUsername"
                type="text"
                value={discogsUsername}
                onChange={(e) => setDiscogsUsername(e.target.value)}
                className="block w-full border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                New Discogs Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="block w-full border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                placeholder="Enter only if changing"
              />
            </div>

            <hr className="my-6 border-slate-200 dark:border-slate-700/50" />

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Current Password (Required)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full border border-amber-300 dark:border-amber-700/50 rounded-xl p-2.5 bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                required
                placeholder="Required to encrypt token"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 font-semibold text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:bg-indigo-400 w-full md:w-auto mt-2"
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          <hr className="my-8 border-slate-200 dark:border-slate-700/50" />

          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
            Manual Synchronization
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Your collection is automatically verified when you log in. If you made recent changes on
            Discogs and want them to appear immediately, you can force a manual sync here.
          </p>
          <button
            onClick={() => {
              if (user) performSync(user.username);
            }}
            disabled={isSyncing}
            className="bg-emerald-600 font-semibold text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:bg-emerald-400 w-full md:w-auto flex items-center justify-center gap-2"
          >
            Force Sync Collection
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
