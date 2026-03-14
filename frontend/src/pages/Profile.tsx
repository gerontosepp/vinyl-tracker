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
      <div className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-8 transition-colors">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400 text-3xl font-black tracking-tighter shadow-inner">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {user?.username}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Member</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3.5 px-5 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left flex justify-between items-center"
          >
            Settings
            <span>&rarr;</span>
          </button>

          <button
            onClick={logout}
            className="w-full py-3.5 px-5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-left"
          >
            Sign Out
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
