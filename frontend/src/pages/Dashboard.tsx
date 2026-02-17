import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRecentListens, getTopRecords, deleteScan } from '../services/api';
import type { ListenEvent, AnalyticsTopRecord } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import Layout from '../components/Layout/Layout';
import TopRecords from '../components/Dashboard/TopRecords';
import RecentListens from '../components/Dashboard/RecentListens';
import { useLocation } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [recentListens, setRecentListens] = useState<ListenEvent[]>([]);
  const [topRecords, setTopRecords] = useState<AnalyticsTopRecord[]>([]);
  const [showScanner, setShowScanner] = useState(false);

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

  const location = useLocation();

  useEffect(() => {
    if (location.state && (location.state as any).scan) {
      setShowScanner(true);
      // Optional: clear state so refresh doesn't re-open, but tricky with React Router
      // For now, it's fine. 
      // Better: window.history.replaceState({}, document.title)
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleDelete = async (id: number) => {
    if (!user || !window.confirm('Delete this scan?')) return;
    try {
      await deleteScan(id, user.username);
      setRecentListens((prev) => prev.filter((item) => item.id !== id));
      // Refresh top records as well
      const tops = await getTopRecords(user.username, startDate, endDate);
      setTopRecords(tops);
    } catch (e) {
      console.error('Failed to delete scan', e);
      alert('Failed to delete scan');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const recents = await getRecentListens(user.username, startDate, endDate);
        setRecentListens(recents);

        const tops = await getTopRecords(user.username, startDate, endDate);
        setTopRecords(tops);
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      }
    };

    if (user) {
      loadData();
    }
  }, [user, showScanner, startDate, endDate]);

  return (
    <Layout onScanClick={() => setShowScanner(true)}>
      {showScanner ? (
        <div className="bg-white rounded-xl shadow-sm p-4 animate-fade-in h-full">
          <button
            onClick={() => setShowScanner(false)}
            className="mb-4 text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
          >
            &larr; Back to Dashboard
          </button>
          <div className="max-w-md mx-auto">
            <BarcodeScanner />
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)] space-y-4">
          {/* Welcome Section - Fixed Height */}
          <div className="flex-none flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.username}</h1>
              <p className="text-gray-500 text-sm">Here's what you've been listening to recently.</p>
            </div>
            <div className="flex gap-2 items-center bg-white p-1.5 rounded-lg shadow-sm border border-gray-100">
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${!startDate && !endDate
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
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
                className={`text-xs px-2 py-1 rounded-md transition-colors ${startDate === getTodayString() && endDate === getTodayString()
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                Today
              </button>
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-gray-200 rounded-md text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                title="Start Date"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-gray-200 rounded-md text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                title="End Date"
              />
            </div>
          </div>

          {/* Split Content */}
          <TopRecords data={topRecords} className="flex-1 min-h-0" />

          <RecentListens listens={recentListens} onDelete={handleDelete} className="flex-1 min-h-0" />
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
