import React from 'react';

interface TopRecord {
    name: string;
    count: number;
    artist?: string; // Optional for now
}

interface TopRecordsProps {
    data: TopRecord[];
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
                        <div className="flex justify-between items-end mb-1">
                            <div>
                                <h3 className="font-bold text-gray-900 leading-tight">{record.name}</h3>
                                {record.artist && <p className="text-sm text-gray-500">{record.artist}</p>}
                            </div>
                            <span className="text-sm font-medium text-gray-500">{record.count} plays</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${(record.count / maxCount) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
                {data.length === 0 && <p className="text-gray-400">No records listened to yet.</p>}
            </div>
        </div>
    );
};

export default TopRecords;
