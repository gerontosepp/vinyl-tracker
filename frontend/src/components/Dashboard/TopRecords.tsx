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
    <div className={`bg-white rounded-xl shadow-sm flex flex-col overflow-hidden ${className}`}>
      <div className="p-6 pb-2 border-b border-gray-100 bg-white z-10">
        <h2 className="text-xl font-bold">Top Records</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
        {data.map((record, index) => (
          <div key={index}>
            <div className="flex gap-4 mb-2">
              {/* Cover Image */}
              <div className="w-12 h-12 flex-shrink-0 bg-gray-200 rounded-md overflow-hidden">
                {record.thumbUrl ? (
                  <img
                    src={getProxiedImageUrl(record.thumbUrl)}
                    alt={record.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    No Cover
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="truncate pr-2">
                    <h3
                      className="font-bold text-gray-900 leading-tight truncate"
                      title={record.title || record.recordTitle}
                    >
                      {record.title || record.recordTitle}
                    </h3>
                    {record.artist && (
                      <p className="text-sm text-gray-500 truncate">{record.artist}</p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-blue-600 flex-shrink-0">
                    {record.count} plays
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mt-2">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${(record.count / maxCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-gray-400 text-center py-4">No records listened to yet.</p>
        )}
      </div>
    </div>
  );
};

export default TopRecords;
