import React from 'react';

interface StatisticWidgetProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  error?: string;
}

const StatisticWidget: React.FC<StatisticWidgetProps> = ({
  title,
  subtitle,
  children,
  className = '',
  loading = false,
  error,
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 p-5 shadow-sm flex flex-col transition-colors ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          {title}
          {subtitle && (
            <span className="text-xs text-slate-400 normal-case ml-2">{subtitle}</span>
          )}
        </h3>
        {error && !loading && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">{error}</p>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin"></div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default StatisticWidget;
