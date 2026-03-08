import React, { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useAuth } from '../../context/useAuth';

interface LayoutProps {
  children: ReactNode;
  onScanClick?: () => void; // Optional for now, as Dashboard handles scanning logic mostly
}

const Layout: React.FC<LayoutProps> = ({ children, onScanClick }) => {
  // Safe default if no handler provided
  const handleScan = onScanClick || (() => console.log('Scan clicked'));
  const authContext = useAuth();

  // Safe extraction so layout doesn't crash on unauthenticated pages if context isn't fully ready
  const isSyncing = authContext?.isSyncing || false;
  const syncMessage = authContext?.syncMessage || '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar onScanClick={handleScan} />

      {/* Main Content Area */}
      <main className="flex-1 w-full md:ml-24 pb-24 md:pb-0 min-h-screen transition-all duration-300">
        <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav onScanClick={handleScan} />

      {/* Sync Global Toast Notification */}
      {(isSyncing || syncMessage) && (
        <div
          className={`fixed bottom-32 md:bottom-8 right-4 md:right-8 left-4 md:left-auto p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center space-x-3 z-50 text-sm font-medium transition-all duration-300 transform translate-y-0 opacity-100 max-w-full md:max-w-md
          ${syncMessage.includes('Failed') ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}
        >
          {isSyncing ? (
            <>
              <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
              <span>Syncing Discogs Collection...</span>
            </>
          ) : (
            <>
              {!syncMessage.includes('Failed') && (
                <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
              )}
              <span>{syncMessage}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Layout;
