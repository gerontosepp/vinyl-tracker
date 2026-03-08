import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useNavigate, Link } from 'react-router-dom';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError('');

    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Login failed. Please check your username.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4 transition-colors">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md w-full max-w-sm transition-colors">
        <div className="flex flex-col items-center justify-center gap-3 mb-6">
          <img src="/logo.png" alt="Vinyl Tracker Logo" className="w-20 h-20 rounded-full shadow-lg" />
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
              Vinyl Tracker
            </h1>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              v{__APP_VERSION__}
            </span>
          </div>
        </div>
        {error && (
          <div className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 p-2 mb-4 rounded text-sm text-center">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={password} // Changed from discogsToken to password
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm flex justify-between">
          <Link to="/forgot-password" className="text-blue-600 dark:text-blue-400 hover:underline">
            Forgot Password?
          </Link>
          <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
