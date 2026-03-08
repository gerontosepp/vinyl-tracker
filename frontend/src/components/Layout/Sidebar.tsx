import React from 'react';
import { Home, Disc, User, Settings, ScanLine } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  onScanClick?: () => void;
}

const NavItem = ({
  path,
  icon: Icon,
  label,
  isActive,
  navigate,
}: {
  path: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) => (
  <button
    onClick={() => navigate(path)}
    className={`flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 ${isActive
        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm'
        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
      }`}
  >
    <Icon size={26} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'drop-shadow-sm' : ''} />
    <span className={`mt-1.5 text-xs tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ onScanClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="hidden md:flex flex-col w-24 h-screen bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl fixed left-0 top-0 border-r border-slate-200/50 dark:border-slate-800/50 z-20 items-center py-8 transition-colors shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]">
      <h1 className="text-xl font-black mb-12 text-center leading-tight text-slate-900 dark:text-white tracking-tighter">
        Vinyl
        <br />
        <span className="text-indigo-600 dark:text-indigo-400">Tracker</span>
      </h1>

      <nav className="flex-1 flex flex-col gap-4 w-full">
        <NavItem path="/" icon={Home} label="Home" isActive={isActive('/')} navigate={navigate} />
        <NavItem
          path="/collection"
          icon={Disc}
          label="Collection"
          isActive={isActive('/collection')}
          navigate={navigate}
        />
        <NavItem
          path="/profile"
          icon={User}
          label="Profile"
          isActive={isActive('/profile')}
          navigate={navigate}
        />

        <div className="px-3 mt-4 w-full">
          <button
            onClick={onScanClick}
            className="flex flex-col items-center justify-center py-3.5 w-full bg-indigo-500 text-white rounded-2xl shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)] hover:bg-indigo-600 hover:-translate-y-1 transition-all duration-300 group"
            aria-label="Scan Record"
          >
            <ScanLine size={24} className="group-hover:scale-110 transition-transform" />
            <span className="mt-1.5 text-xs font-bold tracking-wide">Scan</span>
          </button>
        </div>
      </nav>

      <button
        onClick={() => navigate('/settings')}
        className="p-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 mb-2"
      >
        <Settings size={24} />
      </button>
    </aside>
  );
};

export default Sidebar;
