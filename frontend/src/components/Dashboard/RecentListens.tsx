import React from 'react';
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
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm flex flex-col overflow-hidden transition-colors ${className}`}
    >
      <div className="p-6 pb-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 transition-colors">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recent Listens</h2>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {/* Grid Layout inside scrollable area */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listens.map((event) => (
            <div
              key={event.id}
              className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 flex md:flex-col gap-4 items-center md:items-start group border border-gray-100 dark:border-gray-700 transition-colors"
            >
              {/* Cover Image */}
              <div className="relative flex-shrink-0">
                <img
                  src={
                    event.record.thumbUrl
                      ? getProxiedImageUrl(event.record.thumbUrl)
                      : '/placeholder.png'
                  }
                  alt={event.record.title}
                  className="w-16 h-16 md:w-full md:h-40 object-cover rounded-md md:rounded-lg bg-gray-200 dark:bg-gray-700"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 w-full">
                <h3
                  className="font-bold text-gray-900 dark:text-gray-100 truncate"
                  title={event.record.title}
                >
                  {event.record.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {event.record.artist}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {new Date(event.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-2 md:w-full md:flex-row md:justify-end md:mt-auto">
                <button
                  onClick={() => onDelete(event.id)}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Delete Scan"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {listens.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 border-dashed border-2 border-gray-100 dark:border-gray-700 rounded-xl">
            <p>No recent listens. Scan a record to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentListens;
