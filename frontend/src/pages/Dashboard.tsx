import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { getRecentListens, getTopRecords, deleteScan } from '../services/api';
import type { ListenEvent, AnalyticsTopRecord } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import Layout from '../components/Layout/Layout';
import TopRecords from '../components/Dashboard/TopRecords';
import RecentListens from '../components/Dashboard/RecentListens';
import { useLocation } from 'react-router-dom';
import { getErrorMessage } from '../utils/error';

const isCanceledRequest = (error: unknown): boolean => {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_CANCELED')
  );
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [recentListens, setRecentListens] = useState<ListenEvent[]>([]);
  const [topRecords, setTopRecords] = useState<AnalyticsTopRecord[]>([]);

  const location = useLocation();
  const [showScanner, setShowScanner] = useState<boolean>(() => {
    return !!(location.state && (location.state as { scan?: boolean }).scan);
  });

  // Helper to get local date string YYYY-MM-DD
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date filter state - default to today (local time)
  const [startDate, setStartDate] = useState<string>(getTodayString());
  const [endDate, setEndDate] = useState<string>(getTodayString());

  useEffect(() => {
    if (location.state && (location.state as { scan?: boolean }).scan) {
      // Clear state so refresh doesn't re-open, but tricky with React Router
      // Better: window.history.replaceState({}, document.title)
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!user || !window.confirm('Delete this scan?')) return;
      try {
        await deleteScan(id, user.username);
        setRecentListens((prev) => prev.filter((item) => item.id !== id));
        // Refresh top records as well
        const tops = await getTopRecords(user.username, startDate, endDate);
        setTopRecords(tops);
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Failed to delete scan');
        console.error('Failed to delete scan:', message);
        alert(message);
      }
    },
    [user, startDate, endDate]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      if (!user) return;

      try {
        const [recents, tops] = await Promise.all([
          getRecentListens(user.username, startDate, endDate, {
            signal: controller.signal,
          }),
          getTopRecords(user.username, startDate, endDate, {
            signal: controller.signal,
          }),
        ]);
        setRecentListens(recents);
        setTopRecords(tops);
      } catch (error: unknown) {
        if (!isCanceledRequest(error)) {
          console.error(
            'Failed to load dashboard lists:',
            getErrorMessage(error, 'Unknown dashboard error')
          );
        }
      }
    };

    if (user) {
      loadData();
    }

    return () => {
      controller.abort();
    };
  }, [user, showScanner, startDate, endDate]);

  const dateFilterControls = (
    <div className="flex gap-2 items-center bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-600 w-full md:w-auto max-w-full overflow-x-auto transition-colors">
      <button
        onClick={() => {
          setStartDate('');
          setEndDate('');
        }}
        className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${
          !startDate && !endDate
            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
            : 'text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }`}
      >
        All
      </button>
      <button
        onClick={() => {
          const today = getTodayString();
          setStartDate(today);
          setEndDate(today);
        }}
        className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${
          startDate === getTodayString() && endDate === getTodayString()
            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
            : 'text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }`}
      >
        Today
      </button>
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="bg-transparent border-slate-200 dark:border-slate-700 rounded-lg text-xs py-1.5 px-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none font-medium"
        title="Start Date"
      />
      <span className="text-slate-400 dark:text-slate-500 font-medium">-</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="bg-transparent border-slate-200 dark:border-slate-700 rounded-lg text-xs py-1.5 px-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none font-medium"
        title="End Date"
      />
    </div>
  );

  return (
    <Layout onScanClick={() => setShowScanner(true)}>
      {showScanner ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 sm:p-8 animate-fade-in h-full transition-colors">
          <button
            onClick={() => setShowScanner(false)}
            className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            &larr; Back to Dashboard
          </button>
          <div className="max-w-md mx-auto">
            <BarcodeScanner />
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:h-[calc(100vh-5rem)] space-y-6">
          <TopRecords
            data={topRecords}
            className="flex-none md:flex-1 min-h-0"
            headerActions={dateFilterControls}
          />

          <RecentListens
            listens={recentListens}
            onDelete={handleDelete}
            className="flex-none md:flex-1 min-h-0"
          />
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
