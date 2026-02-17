import React from 'react';
import { Trash2 } from 'lucide-react';
import type { ListenEvent } from '../../types';

interface RecentListensProps {
    listens: ListenEvent[];
    onDelete: (id: number) => void;
    className?: string;
}

const RecentListens: React.FC<RecentListensProps> = ({ listens, onDelete, className = '' }) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm flex flex-col overflow-hidden ${className}`}>
            <div className="p-6 pb-2 border-b border-gray-100 bg-white z-10">
                <h2 className="text-xl font-bold">Recent Listens</h2>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-6 pt-4">
                {/* Grid Layout inside scrollable area */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {listens.map((event) => (
                        <div key={event.id} className="bg-gray-50 rounded-xl p-4 flex md:flex-col gap-4 items-center md:items-start group border border-gray-100">
                            {/* Cover Image */}
                            <div className="relative flex-shrink-0">
                                <img
                                    src={event.record.thumbUrl || '/placeholder.png'}
                                    alt={event.record.title}
                                    className="w-16 h-16 md:w-full md:h-40 object-cover rounded-md md:rounded-lg bg-gray-200"
                                />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 w-full">
                                <h3 className="font-bold text-gray-900 truncate" title={event.record.title}>
                                    {event.record.title}
                                </h3>
                                <p className="text-sm text-gray-500 truncate">{event.record.artist}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {new Date(event.timestamp).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col items-end gap-2 md:w-full md:flex-row md:justify-end md:mt-auto">
                                <button
                                    onClick={() => onDelete(event.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {listens.length === 0 && (
                    <div className="text-center py-12 text-gray-400 border-dashed border-2 border-gray-100 rounded-xl">
                        <p>No recent listens. Scan a record to get started!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentListens;
