import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const MOCK_LISTENING_DATA = [
  { day: 'Mon', hrs: 2 },
  { day: 'Tue', hrs: 4 },
  { day: 'Wed', hrs: 3 },
  { day: 'Thu', hrs: 6 },
  { day: 'Fri', hrs: 5 },
  { day: 'Sat', hrs: 8 },
  { day: 'Sun', hrs: 7 },
];

const Settings: React.FC = () => {
  const { user, updateDiscogs, isLoading, isSyncing, performSync, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [discogsUsername, setDiscogsUsername] = useState(user?.discogsUsername || '');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
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
      setToken('');
      setPassword('');
    } catch (err) {
      console.error(err);
      setError('Failed to update settings. Check your password.');
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

            {/* Listening Habits Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Listening Habits
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 font-medium">
                Weekly Listening (hrs)
              </p>

              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={MOCK_LISTENING_DATA}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorListening" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      dy={10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        border: 'none',
                      }}
                      itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="hrs"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorListening)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
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

              {msg && (
                <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-3 mb-6 rounded-xl text-sm font-bold border border-emerald-200 dark:border-emerald-800/50">
                  {msg}
                </div>
              )}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 mb-6 rounded-xl text-sm font-bold border border-red-200 dark:border-red-800/50">
                  {error}
                </div>
              )}

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
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-600 p-6 transition-colors">
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
                  className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-bold px-4 py-3 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2"
                >
                  Force Sync Collection
                </button>
                <button className="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                  Export Data (CSV)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
