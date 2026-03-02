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
    className={`p-4 transition-colors ${isActive ? 'text-black' : 'text-gray-400'}`}
  >
    <Icon size={28} strokeWidth={isActive ? 2.5 : 2} />
  </button>
);

const BottomNav: React.FC<BottomNavProps> = ({ onScanClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-between items-center px-6 py-2 z-50 h-[80px] pb-safe">
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
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg flex items-center justify-center transition-transform active:scale-95 w-16 h-16"
        >
          <ScanLine size={32} />
        </button>
      </div>

      <NavItem path="/profile" icon={User} isActive={isActive('/profile')} navigate={navigate} />
      {/* Additional placeholder to balance spacing if needed */}
      <div className="w-8"></div>
    </nav>
  );
};

export default BottomNav;
