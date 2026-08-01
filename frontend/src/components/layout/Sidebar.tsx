import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../auth/useAuthContext';
import {
  Home,
  Users,
  BarChart3,
  BookOpen,
  ChevronRight,
  CreditCard,
  Shield,
  TicketPercent,
  User,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isAdmin = false, mobileMenuOpen, setMobileMenuOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const studentLinks = [
    { to: '/dashboard', icon: Home, label: 'I Miei Corsi' },
  ];

  const adminLinks = [
    { to: '/admin', icon: BarChart3, label: 'Dashboard' },
    { to: '/admin/course', icon: BookOpen, label: 'Catalogo Corsi' },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/purchases', icon: CreditCard, label: 'Purchases' },
    { to: '/admin/coupons', icon: TicketPercent, label: 'Coupons' },
    { to: '/admin/accounts', icon: Shield, label: 'Admin Accounts' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  return (
    <aside className={`
      fixed left-0 top-16 bottom-0 z-50 w-64 bg-white border-r border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out overflow-hidden
      ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      xl:static xl:top-auto xl:bottom-auto xl:shadow-none xl:translate-x-0 xl:h-full flex flex-col flex-shrink-0
    `}>
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);

          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen && setMobileMenuOpen(false)}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 mb-4 px-2 overflow-hidden">
           <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
             <User className="w-5 h-5 text-white" />
           </div>
           <div className="text-sm font-medium text-gray-700 truncate">
             {user?.fullName || user?.email}
           </div>
        </div>
        <button
          onClick={() => void handleLogout()}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-700 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
