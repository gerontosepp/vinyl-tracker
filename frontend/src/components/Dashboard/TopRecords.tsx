import React from 'react';
import { getProxiedImageUrl } from '../../services/api';
import type { AnalyticsTopRecord } from '../../types';

interface TopRecordsProps {
  data: AnalyticsTopRecord[];
  className?: string;
}

const TopRecords: React.FC<TopRecordsProps> = ({ data, className = '' }) => {
  const maxCount = Math.max(...data.map((r) => r.count), 0);

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50 ${className}`}
    >
      <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 z-10 transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Top Records</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
        {data.map((record, index) => (
          <div key={index} className="group transition-all duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 -mx-4 p-4 rounded-xl">
            <div className="flex gap-4 mb-2">
              {/* Cover Image */}
              <div className="w-14 h-14 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden relative shadow-sm">
                {record.thumbUrl ? (
                  <img
                    src={getProxiedImageUrl(record.thumbUrl)}
                    alt={record.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-medium">
                    No Cover
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="truncate pr-4">
                    <h3
                      className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate"
                      title={record.title || record.recordTitle}
                    >
                      {record.title || record.recordTitle}
                    </h3>
                    {record.artist && (
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {record.artist}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                    {record.count} plays
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden mt-3 shadow-inner">
                  <div
                    className="bg-indigo-500 hover:bg-indigo-400 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${(record.count / maxCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-slate-400 dark:text-slate-500 text-center py-8 font-medium border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            No records listened to yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default TopRecords;
