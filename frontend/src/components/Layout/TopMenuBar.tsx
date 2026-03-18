import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { getCollection } from '../../services/api';
import { LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TopMenuBar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [totalRecords, setTotalRecords] = useState<number | null>(null);

  useEffect(() => {
    if (user?.username) {
      // Fetch just 1 record to get the total count efficiently
      getCollection(user.username, 1, 1)
        .then((res) => {
          setTotalRecords(res.pagination ? res.pagination.items : res.releases.length);
        })
        .catch((err) => {
          console.error('Failed to fetch total records for top bar', err);
        });
    }
  }, [user]);

  if (!user) return null;

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700 z-30 px-4 md:px-8 flex items-center justify-between transition-colors shadow-sm">
      {/* Logo / Left Side */}
      <div className="flex items-center gap-2 md:gap-3">
        <img
          src="/logo.png"
          alt="Logo"
          className="w-8 h-8 md:w-10 md:h-10 rounded-full shadow-sm"
        />
        <span className="font-black text-lg md:text-xl text-slate-900 dark:text-white tracking-tighter">
          Vinyl<span className="text-indigo-600 dark:text-indigo-400">Tracker</span>
        </span>
      </div>

      {/* Center - Stats */}
      <div className="hidden sm:flex flex-1 justify-center items-center">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
          Total Records:{' '}
          {totalRecords !== null ? (
            <strong className="text-indigo-600 dark:text-indigo-400">{totalRecords}</strong>
          ) : (
            <span className="w-6 h-4 inline-block bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>
          )}
        </span>
      </div>

      {/* Right - User Area */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end hidden md:flex">
          <span className="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1">
            {user.username}
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
            v{__APP_VERSION__}
          </span>
        </div>

        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all font-bold">
          {user.username.charAt(0).toUpperCase()}
        </div>

        <div className="flex items-center gap-2 ml-2 pl-4 border-l border-slate-200 dark:border-slate-700">
          <button
            onClick={() => navigate('/settings')}
            className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Settings"
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Log Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopMenuBar;
