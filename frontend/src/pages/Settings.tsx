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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 max-w-2xl mx-auto space-y-8 transition-colors">
        <div>
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Settings</h1>

          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Appearance
          </h2>
          <div className="mb-8">
            <label
              htmlFor="themeSelect"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Theme Preference
            </label>
            <select
              id="themeSelect"
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="mt-1 block border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System Default</option>
            </select>
          </div>

          <hr className="my-8 border-gray-200 dark:border-gray-700" />

          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Discogs Integration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            To enable scanning, please provide your Discogs credentials. Your token is encrypted
            securely using your password.
          </p>

          {msg && <div className="bg-green-100 text-green-700 p-2 mb-4 rounded">{msg}</div>}
          {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="discogsUsername"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Discogs Username
              </label>
              <input
                id="discogsUsername"
                type="text"
                value={discogsUsername}
                onChange={(e) => setDiscogsUsername(e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                New Discogs Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Enter only if changing"
              />
            </div>

            <hr className="my-4 border-gray-200 dark:border-gray-700" />

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Current Password (Required)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-yellow-50 dark:bg-yellow-900 dark:text-gray-100"
                required
                placeholder="Required to encrypt token"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 w-full md:w-auto"
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          <hr className="my-8 border-gray-200 dark:border-gray-700" />

          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Manual Synchronization
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Your collection is automatically verified when you log in. If you made recent changes on
            Discogs and want them to appear immediately, you can force a manual sync here.
          </p>
          <button
            onClick={() => {
              if (user) performSync(user.username);
            }}
            disabled={isSyncing}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-300 w-full md:w-auto flex items-center justify-center gap-2"
          >
            Force Sync Collection
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
