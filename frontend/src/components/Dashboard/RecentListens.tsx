import React, { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { getProxiedImageUrl } from '../../services/api';
import type { ListenEvent } from '../../types';

interface RecentListensProps {
  listens: ListenEvent[];
  onDelete: (id: number) => void;
  className?: string;
}

const RecentListens: React.FC<RecentListensProps> = ({ listens, onDelete, className = '' }) => {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50 ${className}`}
    >
      <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 z-10 transition-colors">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Recent Listens
        </h2>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {/* Grid Layout inside scrollable area */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 md:gap-8">
          {listens.map((event, index) => (
            <div
              key={event.id}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col gap-3 group border hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${(index % 6) * 75}ms`, opacity: 0 }}
            >
              {/* Listen Status Badge (Top-Right of Image) */}
              <div className="absolute top-3 right-3 z-10 bg-slate-900/80 dark:bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md shadow-sm border border-white/10 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                Recent
              </div>

              {/* Cover Image */}
              <div className="w-full aspect-square bg-slate-100 dark:bg-slate-700/50 rounded-xl overflow-hidden relative shadow-inner">
                <img
                  src={
                    event.record.thumbUrl
                      ? getProxiedImageUrl(event.record.thumbUrl)
                      : '/placeholder.png'
                  }
                  alt={event.record.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              {/* Info & Actions */}
              <div className="flex-1 min-w-0 flex flex-col pt-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-bold text-slate-900 dark:text-slate-100 truncate text-base leading-tight mb-1"
                      title={event.record.title}
                    >
                      {event.record.title}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                      {event.record.artist}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(event.id)}
                    className="p-1.5 -mr-1.5 -mt-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 opacity-0 group-hover:opacity-100"
                    title="Delete Scan"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center w-full z-20">
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {new Date(event.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {listens.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-700/60 rounded-2xl bg-white dark:bg-slate-800/30 animate-fade-in">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500 shadow-inner">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
              No Recent Listens
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[250px]">
              Scan a record to start building your history of recently played albums.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(RecentListens);
