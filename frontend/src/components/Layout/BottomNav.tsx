import React from 'react';
import { Home, Disc, User, ScanLine } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BottomNavProps {
  onScanClick: () => void;
}

const NavItem = ({
  path,
  icon: Icon,
  isActive,
  navigate,
}: {
  path: string;
  icon: React.ElementType;
  isActive: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) => (
  <button
    onClick={() => navigate(path)}
    className={`p-4 transition-all duration-200 ${isActive ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
  >
    <Icon size={28} strokeWidth={isActive ? 2.5 : 2} />
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({ onScanClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700 flex justify-between items-center px-6 py-2 z-50 h-[80px] pb-safe transition-colors shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <NavItem path="/" icon={Home} isActive={isActive('/')} navigate={navigate} />
      <NavItem
        path="/collection"
        icon={Disc}
        isActive={isActive('/collection')}
        navigate={navigate}
      />

      {/* Floating Scan Button */}
      <div className="relative -top-6">
        <button
          onClick={onScanClick}
          aria-label="Scan Record"
          className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full p-4 shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)] flex items-center justify-center transition-transform hover:-translate-y-1 active:scale-95 w-16 h-16 border-4 border-slate-50 dark:border-slate-900"
        >
          <ScanLine size={30} strokeWidth={2.5} />
        </button>
      </div>

      <NavItem path="/profile" icon={User} isActive={isActive('/profile')} navigate={navigate} />
      {/* Additional placeholder to balance spacing if needed */}
      <div className="w-8"></div>
    </nav>
  );
};

export default BottomNav;
