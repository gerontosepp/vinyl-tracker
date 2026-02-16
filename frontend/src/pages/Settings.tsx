import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Settings: React.FC = () => {
  const { user, updateDiscogs, isLoading } = useAuth();
  const [discogsUsername, setDiscogsUsername] = useState(user?.discogsUsername || '');
  const [token, setToken] = useState(''); // Don't verify existing token for security, just let set new
  const [password, setPassword] = useState(''); // Required to encrypt
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
    } catch (err) {
      console.error(err);
      setError('Failed to update settings. Check your password.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow p-4 flex items-center sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="mr-4 text-gray-600">
          &larr; Back
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <div className="p-4 max-w-screen-md mx-auto">
        <div className="bg-white p-6 rounded shadow-md">
          <h2 className="text-lg font-semibold mb-4">Discogs Integration</h2>
          <p className="text-sm text-gray-500 mb-4">
            To enable scanning, please provide your Discogs credentials. Your token is encrypted
            securely using your password.
          </p>

          {msg && <div className="bg-green-100 text-green-700 p-2 mb-4 rounded">{msg}</div>}
          {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="discogsUsername" className="block text-sm font-medium text-gray-700">
                Discogs Username
              </label>
              <input
                id="discogsUsername"
                type="text"
                value={discogsUsername}
                onChange={(e) => setDiscogsUsername(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded p-2"
              />
            </div>
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                New Discogs Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded p-2"
                placeholder="Enter only if changing"
              />
            </div>

            <hr className="my-4" />

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Current Password (Required)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded p-2 bg-yellow-50"
                required
                placeholder="Required to encrypt token"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
