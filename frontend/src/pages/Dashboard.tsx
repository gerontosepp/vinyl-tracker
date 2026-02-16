import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRecentListens, getTopRecords } from '../services/api';
import type { ListenEvent } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [recentListens, setRecentListens] = useState<ListenEvent[]>([]);
  const [topRecords, setTopRecords] = useState<{ name: string; count: number }[]>([]);
  const [showScanner, setShowScanner] = useState(false);

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
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Vinyl Tracker</h1>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            v{__APP_VERSION__}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 mr-2">{user?.username}</span>
          <button
            onClick={() => navigate('/settings')}
            className="text-sm text-gray-600 hover:text-gray-900 mr-2"
          >
            Settings
          </button>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700">
            Logout
          </button>
        </div>
      </header>

      <main className="p-4 max-w-screen-md mx-auto">
        {showScanner ? (
          <div className="mb-6">
            <button
              onClick={() => setShowScanner(false)}
              className="mb-2 text-sm text-gray-500 hover:text-gray-800"
            >
              &larr; Back to Dashboard
            </button>
            <BarcodeScanner />
          </div>
        ) : (
          <div className="mb-6 text-center">
            <button
              onClick={() => setShowScanner(true)}
              className="bg-purple-600 text-white text-lg font-semibold px-8 py-4 rounded-full shadow-lg hover:bg-purple-700 transition"
            >
              SCAN RECORD
            </button>
          </div>
        )}

        {!showScanner && (
          <>
            <section className="bg-white rounded shadow p-4 mb-6">
              <h2 className="text-lg font-bold mb-4 border-b pb-2">Top Records</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topRecords} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]}>
                      {topRecords.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index % 2 === 0 ? '#8884d8' : '#82ca9d'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white rounded shadow p-4">
              <h2 className="text-lg font-bold mb-4 border-b pb-2">Recent Listens</h2>
              {recentListens.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No records scanned yet.</p>
              ) : (
                <ul className="space-y-4">
                  {recentListens.map((event) => (
                    <li key={event.id} className="flex items-center space-x-4">
                      <img
                        src={event.record.thumbUrl || '/placeholder.png'}
                        alt={event.record.title}
                        className="w-16 h-16 object-cover rounded shadow-sm bg-gray-200"
                      />
                      <div>
                        <p className="font-semibold">{event.record.title}</p>
                        <p className="text-sm text-gray-600">{event.record.artist}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
