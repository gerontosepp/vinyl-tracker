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
    className={`flex flex-col items-center justify-center p-4 w-full transition-colors ${
      isActive ? 'text-black' : 'text-gray-400 hover:text-gray-600'
    }`}
  >
    <Icon size={28} strokeWidth={isActive ? 2.5 : 2} />
    <span className={`mt-1 text-sm ${isActive ? 'font-semibold' : ''}`}>{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ onScanClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="hidden md:flex flex-col w-24 h-screen bg-gray-50 fixed left-0 top-0 border-r border-gray-200 z-20 items-center py-8">
      <h1 className="text-xl font-bold mb-12 text-center leading-tight">
        Vinyl
        <br />
        Tracker
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

        <div className="px-4 mt-4">
          <button
            onClick={onScanClick}
            className="flex flex-col items-center justify-center p-3 w-full bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-colors"
            aria-label="Scan Record"
          >
            <ScanLine size={24} />
            <span className="mt-1 text-xs font-semibold">Scan</span>
          </button>
        </div>
      </nav>

      <button
        onClick={() => navigate('/settings')}
        className="p-4 text-gray-400 hover:text-gray-600"
      >
        <Settings size={24} />
      </button>
    </aside>
  );
};

export default Sidebar;
