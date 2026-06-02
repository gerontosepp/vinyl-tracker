import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout/Layout';
import StatisticWidget from '../components/Dashboard/StatisticWidget';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/ToastContext';
import { getCollectionValue, getGenreBreakdown } from '../services/api';
import { getErrorMessage } from '../utils/error';
import type { CollectionValueResponse, GenreBreakdownItem } from '../types';
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
const MOCK_LISTENING_DATA = [
  { day: 'Mon', hrs: 2 },
  { day: 'Tue', hrs: 4 },
  { day: 'Wed', hrs: 3 },
  { day: 'Thu', hrs: 6 },
  { day: 'Fri', hrs: 5 },
  { day: 'Sat', hrs: 8 },
  { day: 'Sun', hrs: 7 },
];

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

const Statistics: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [collectionValue, setCollectionValue] = useState<CollectionValueResponse | null>(null);
  const [genreData, setGenreData] = useState<GenreBreakdownItem[]>([]);
  const [isCollectionValueLoading, setIsCollectionValueLoading] = useState(true);
  const [isGenreLoading, setIsGenreLoading] = useState(true);
  const [collectionValueError, setCollectionValueError] = useState('');
  const [genreError, setGenreError] = useState('');
  const [collectionValueHistory, setCollectionValueHistory] = useState<CollectionValueTrendPoint[]>(
    []
  );

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

      const now = new Date(); // Local time
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
    const controller = new AbortController();

    const loadData = async () => {
      if (!user) return;
      setIsCollectionValueLoading(true);
      setIsGenreLoading(true);
      setCollectionValueError('');
      setGenreError('');

      try {
        const val = await getCollectionValue({ signal: controller.signal });
        setCollectionValue(val);
        appendCollectionValueHistory(val);
      } catch (error: unknown) {
        if (!isCanceledRequest(error)) {
          const message = getErrorMessage(error, 'Collection value currently unavailable.');
          setCollectionValue(null);
          setCollectionValueError(message);
          showToast(message, 'error');
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
          const message = getErrorMessage(error, 'Genre breakdown currently unavailable.');
          setGenreData([]);
          setGenreError(message);
          showToast(message, 'error');
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
  }, [user, appendCollectionValueHistory, showToast]);

  return (
    <Layout>
      <div className="flex flex-col space-y-6 md:h-[calc(100vh-5rem)]">
        <div className="flex-none flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Collection Statistics
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
              Detailed breakdown of your vinyl collection value and genres.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
          <StatisticWidget
            title="Collection Value"
            subtitle="(Discogs Estimate)"
            className="lg:col-span-2"
            loading={isCollectionValueLoading}
            error={collectionValueError}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                {collectionValue ? (
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
                  <div className="text-3xl font-black text-slate-900 dark:text-slate-100">N/A</div>
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
                      outline: 'none',
                      border: 'none',
                    }}
                    itemStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                    labelFormatter={(_, payload) => {
                      const ts = payload?.[0]?.payload?.timestamp;
                      if (!ts) return 'Unknown Time';
                      return new Date(ts).toLocaleString();
                    }}
                    formatter={(
                      value: number | string,
                      name: string | number,
                      item: { payload?: { currency?: string } }
                    ) => [
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
          </StatisticWidget>

          <StatisticWidget
            title="Genre Breakdown"
            loading={isGenreLoading}
            error={genreError}
            className="flex flex-col"
          >
            <div className="flex-1 flex items-center justify-center relative min-h-[180px]">
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
                      outline: 'none',
                    }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {genreData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Records</span>
              </div>
            </div>

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
          </StatisticWidget>

          <StatisticWidget
            title="Listening Habits"
            subtitle="Weekly Listening (hrs)"
            className="lg:col-span-3"
          >
            <div className="h-40 w-full">
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
                      outline: 'none',
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
          </StatisticWidget>
        </div>
      </div>
    </Layout>
  );
};

export default Statistics;
