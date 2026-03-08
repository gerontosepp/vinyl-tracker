import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Layout from '../components/Layout/Layout';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleScan = () => {
    navigate('/', { state: { scan: true } });
  };

  return (
    <Layout onScanClick={handleScan}>
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 transition-colors">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-400 text-3xl font-bold">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user?.username}</h1>
          <p className="text-gray-500 dark:text-gray-400">Member</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3 px-4 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left flex justify-between items-center"
          >
            Settings
            <span>&rarr;</span>
          </button>

          <button
            onClick={logout}
            className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-left"
          >
            Sign Out
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
