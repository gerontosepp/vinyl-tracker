import React from 'react';
import { Home, Disc, User, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const NavItem = ({ path, icon: Icon, label }: { path: string; icon: any; label: string }) => (
        <button
            onClick={() => navigate(path)}
            className={`flex flex-col items-center justify-center p-4 w-full transition-colors ${isActive(path) ? 'text-black' : 'text-gray-400 hover:text-gray-600'
                }`}
        >
            <Icon size={28} strokeWidth={isActive(path) ? 2.5 : 2} />
            <span className={`mt-1 text-sm ${isActive(path) ? 'font-semibold' : ''}`}>{label}</span>
        </button>
    );

    return (
        <aside className="hidden md:flex flex-col w-24 h-screen bg-gray-50 fixed left-0 top-0 border-r border-gray-200 z-20 items-center py-8">
            <h1 className="text-xl font-bold mb-12 text-center leading-tight">
                Vinyl<br />Tracker
            </h1>

            <nav className="flex-1 flex flex-col gap-4 w-full">
                <NavItem path="/" icon={Home} label="Home" />
                <NavItem path="/collection" icon={Disc} label="Collection" />
                <NavItem path="/profile" icon={User} label="Profile" />
            </nav>

            <button
                onClick={() => navigate('/settings')}
                className="p-4 text-gray-400 hover:text-gray-600"
            >
                <Settings size={24} />
            </button>

            {/* Blue scan button placeholder if needed in sidebar, though mockup shows it elsewhere or implied */}
        </aside>
    );
};

export default Sidebar;
