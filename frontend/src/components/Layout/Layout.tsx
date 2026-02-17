import React, { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

interface LayoutProps {
    children: ReactNode;
    onScanClick?: () => void; // Optional for now, as Dashboard handles scanning logic mostly
}

const Layout: React.FC<LayoutProps> = ({ children, onScanClick }) => {
    // Safe default if no handler provided
    const handleScan = onScanClick || (() => console.log('Scan clicked'));

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 w-full md:ml-24 pb-24 md:pb-0 min-h-screen transition-all duration-300">
                <div className="max-w-7xl mx-auto p-4 md:p-8">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Nav */}
            <BottomNav onScanClick={handleScan} />
        </div>
    );
};

export default Layout;
