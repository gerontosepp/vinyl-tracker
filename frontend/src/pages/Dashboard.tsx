import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import {
  getRecentListens,
  getTopRecords,
  deleteScan,
  getCollectionValue,
  getGenreBreakdown,
} from '../services/api';
import type {
  ListenEvent,
  AnalyticsTopRecord,
  CollectionValueResponse,
  GenreBreakdownItem,
} from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import Layout from '../components/Layout/Layout';
import TopRecords from '../components/Dashboard/TopRecords';
import RecentListens from '../components/Dashboard/RecentListens';
import { useLocation } from 'react-router-dom';
import { getErrorMessage } from '../utils/error';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const GENRE_COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#8b5cf6', '#f59e0b', '#64748b'];
const VALUE_HISTORY_STORAGE_PREFIX = 'dashboard_collection_value_history_v1';
const MAX_VALUE_HISTORY_POINTS = 60;

type CollectionValueTrendPoint = {
  timestamp: string;
  label: string;
  minimum: number;
  median: number;
  maximum: number;
  currency: string;
};

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
  const [collectionValue, setCollectionValue] = useState<CollectionValueResponse | null>(null);
  const [genreData, setGenreData] = useState<GenreBreakdownItem[]>([]);
  const [isCollectionValueLoading, setIsCollectionValueLoading] = useState(true);
  const [isGenreLoading, setIsGenreLoading] = useState(true);
  const [collectionValueError, setCollectionValueError] = useState('');
  const [genreError, setGenreError] = useState('');
  const [collectionValueHistory, setCollectionValueHistory] = useState<CollectionValueTrendPoint[]>(
    []
  );
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

  const getValueHistoryStorageKey = (username: string) => {
    return `${VALUE_HISTORY_STORAGE_PREFIX}_${username}`;
  };

  const formatTrendLabel = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const appendCollectionValueHistory = useCallback(
    (value: CollectionValueResponse) => {
      if (!user) return;

      const minValue = value.minimum?.value;
      const medianValue = value.median?.value;
      const maxValue = value.maximum?.value;

      if (
        typeof minValue !== 'number' ||
        typeof medianValue !== 'number' ||
        typeof maxValue !== 'number'
      ) {
        return;
      }

      const now = new Date();
      const nextPoint: CollectionValueTrendPoint = {
        timestamp: now.toISOString(),
        label: formatTrendLabel(now),
        minimum: minValue,
        median: medianValue,
        maximum: maxValue,
        currency:
          value.median?.currency || value.minimum?.currency || value.maximum?.currency || '$',
      };

      setCollectionValueHistory((previous) => {
        const last = previous[previous.length - 1];
        const isDuplicateLastPoint =
          !!last &&
          last.minimum === nextPoint.minimum &&
          last.median === nextPoint.median &&
          last.maximum === nextPoint.maximum;

        const updated = isDuplicateLastPoint
          ? previous
          : [...previous, nextPoint].slice(-MAX_VALUE_HISTORY_POINTS);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            getValueHistoryStorageKey(user.username),
            JSON.stringify(updated)
          );
        }

        return updated;
      });
    },
    [user]
  );

  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      setCollectionValueHistory([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(getValueHistoryStorageKey(user.username));
      if (!raw) {
        setCollectionValueHistory([]);
        return;
      }

      const parsed = JSON.parse(raw) as CollectionValueTrendPoint[];
      if (!Array.isArray(parsed)) {
        setCollectionValueHistory([]);
        return;
      }

      setCollectionValueHistory(
        parsed
          .filter(
            (point) =>
              typeof point?.timestamp === 'string' &&
              typeof point?.minimum === 'number' &&
              typeof point?.median === 'number' &&
              typeof point?.maximum === 'number'
          )
          .slice(-MAX_VALUE_HISTORY_POINTS)
      );
    } catch {
      setCollectionValueHistory([]);
    }
  }, [user]);

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
      setIsCollectionValueLoading(true);
      setIsGenreLoading(true);
      setCollectionValueError('');
      setGenreError('');

      // Recent listens and top records are coupled and should fail together.
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

      try {
        const val = await getCollectionValue({ signal: controller.signal });
        setCollectionValue(val);
        appendCollectionValueHistory(val);
      } catch (error: unknown) {
        if (!isCanceledRequest(error)) {
          setCollectionValue(null);
          setCollectionValueError('Collection value currently unavailable.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCollectionValueLoading(false);
        }
      }

      try {
        const genres = await getGenreBreakdown({ signal: controller.signal });
        setGenreData(genres);
      } catch (error: unknown) {
        if (!isCanceledRequest(error)) {
          setGenreData([]);
          setGenreError('Genre breakdown currently unavailable.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGenreLoading(false);
        }
      }
    };

    if (user) {
      loadData();
    }

    return () => {
      controller.abort();
    };
  }, [user, showScanner, startDate, endDate, appendCollectionValueHistory]);

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
          {/* Welcome Section - Fixed Height on Desktop */}
          <div className="flex-none flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Welcome back, {user?.username}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                Here's what you've been listening to recently.
              </p>
            </div>
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
          </div>

          {/* Desktop Charts Area - Hidden on very small screens, fits mockup */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Collection Value Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 p-5 shadow-sm lg:col-span-2">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Collection Value{' '}
                    <span className="text-xs text-slate-400 normal-case ml-2">
                      (Discogs Estimate)
                    </span>
                  </h3>
                  {isCollectionValueLoading ? (
                    <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse mt-1"></div>
                  ) : collectionValue ? (
                    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-3">
                      {collectionValue.median ? (
                        <>
                          {collectionValue.median.currency === 'EUR' ? '€' : '$'}
                          {collectionValue.median.value.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </>
                      ) : (
                        'N/A'
                      )}

                      {collectionValue.minimum && collectionValue.maximum && (
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Min: {collectionValue.minimum.value.toLocaleString()} / Max:{' '}
                          {collectionValue.maximum.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
                      £0.00
                    </div>
                  )}
                  {!isCollectionValueLoading && collectionValueError && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                      {collectionValueError}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3 text-xs font-semibold text-slate-500 dark:text-slate-300">
                <div className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  Minimum
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  Median
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Maximum
                </div>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={collectionValueHistory}
                    margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMinimum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMaximum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#334155"
                      opacity={0.2}
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      dy={10}
                      minTickGap={24}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                      }}
                      itemStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                      labelFormatter={(_, payload) => {
                        const ts = payload?.[0]?.payload?.timestamp;
                        if (!ts) return 'Unbekannter Zeitpunkt';
                        return new Date(ts).toLocaleString();
                      }}
                      formatter={(value: any, name: any, item: any) => [
                        `${item?.payload?.currency || collectionValue?.median?.currency || '$'} ${Number(
                          value
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`,
                        name === 'minimum' ? 'Minimum' : name === 'maximum' ? 'Maximum' : 'Median',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="minimum"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorMinimum)"
                    />
                    <Area
                      type="monotone"
                      dataKey="median"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorMedian)"
                    />
                    <Area
                      type="monotone"
                      dataKey="maximum"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorMaximum)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Genre Breakdown Chart */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 p-5 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Genre Breakdown
              </h3>
              <div className="flex-1 flex items-center justify-center relative">
                {isGenreLoading ? (
                  <div className="w-40 h-40 rounded-full border-4 border-slate-200 dark:border-slate-700 animate-pulse"></div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={genreData}
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {genreData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={GENRE_COLORS[index % GENRE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          border: 'none',
                        }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {/* Center text for Donut */}
                {!isGenreLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                      {genreData.reduce((acc, curr) => acc + curr.value, 0)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Records</span>
                  </div>
                )}
              </div>
              {!isGenreLoading && genreError && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center font-medium">
                  {genreError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {genreData.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: GENRE_COLORS[index % GENRE_COLORS.length] }}
                    ></span>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Split Content */}
          <TopRecords data={topRecords} className="flex-none md:flex-1 min-h-0" />

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
