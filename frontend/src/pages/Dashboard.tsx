import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRecentListens, getTopRecords, deleteScan } from '../services/api';
import type { ListenEvent } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import Layout from '../components/Layout/Layout';
import TopRecords from '../components/Dashboard/TopRecords';
import RecentListens from '../components/Dashboard/RecentListens';
import { useLocation } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [recentListens, setRecentListens] = useState<ListenEvent[]>([]);
  const [topRecords, setTopRecords] = useState<{ name: string; count: number }[]>([]);
  const [showScanner, setShowScanner] = useState(false);
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
      const tops = await getTopRecords(user.username);
      const formatted = tops.map((t: Record<string, any>) => ({
        name: t.key || t.name || Object.keys(t)[0],
        count: t.value || t.count || Object.values(t)[0],
      }));
      setTopRecords(formatted);
    } catch (e) {
      console.error('Failed to delete scan', e);
      alert('Failed to delete scan');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const recents = await getRecentListens(user.username);
        setRecentListens(recents);

        const tops = await getTopRecords(user.username);
        const formatted = tops.map((t: Record<string, any>) => ({
          name: t.key || t.name || Object.keys(t)[0],
          count: t.value || t.count || Object.values(t)[0],
        }));
        setTopRecords(formatted);
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      }
    };

    if (user) {
      loadData();
    }
  }, [user, showScanner]);

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
