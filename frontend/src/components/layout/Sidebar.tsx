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
  LogOut,
  Terminal,
  ExternalLink,
  MessageCircle,
  Sparkles,
  HelpCircle,
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
    { to: '/admin/system-logs', icon: Terminal, label: 'Pannello Tecnico' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  return (
    <aside
      className={`
      fixed left-0 top-16 bottom-0 z-50 w-72 bg-white border-r border-primary-100 shadow-xl transform transition-transform duration-300 ease-in-out overflow-hidden
      ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      xl:static xl:top-auto xl:bottom-auto xl:shadow-none xl:translate-x-0 xl:h-full flex flex-col flex-shrink-0
    `}
    >
      {/* Navigation Links Area */}
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        
        {/* Main Section Header */}
        <div className="px-3 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary-800/80">
            {isAdmin ? 'Pannello Amministrazione' : 'Area Corsista'}
          </span>
        </div>

        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to || (link.to !== '/dashboard' && location.pathname.startsWith(`${link.to}/`));

          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen && setMobileMenuOpen(false)}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-primary-900 text-white font-semibold shadow-xs'
                  : 'text-gray-700 hover:bg-primary-50/70 hover:text-primary-950 font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary-200' : 'text-primary-800'}`} />
                <span className="text-sm">{link.label}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 text-primary-300" />}
            </Link>
          );
        })}

        {/* Student-Exclusive Sections */}
        {!isAdmin && (
          <>
            {/* Quick Link: Sito Ufficiale */}
            <div className="pt-2">
              <a
                href="https://chiaramorocutti.it"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-gray-700 hover:bg-primary-50/70 hover:text-primary-950 font-medium transition-all group"
              >
                <div className="flex items-center gap-3">
                  <ExternalLink className="w-4 h-4 text-primary-800 group-hover:text-primary-900" />
                  <span className="text-sm">Sito Ufficiale Chiara</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-primary-700 bg-primary-100/70 px-1.5 py-0.5 rounded">
                  Web
                </span>
              </a>
            </div>

            {/* Luxury Box: Supporto Corsiste & Domande Pratica */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-primary-50 via-[#FAF4F6] to-primary-100/50 border border-primary-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary-800 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-primary-200" />
                </div>
                <div>
                  <h4
                    className="text-xs font-bold text-primary-950 leading-none"
                    style={{ fontFamily: 'Abhaya Libre, serif' }}
                  >
                    Supporto Didattico
                  </h4>
                  <p className="text-[10px] text-primary-800 font-medium mt-0.5">Accademia Chiara Morocutti</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Hai dubbi sulla corretta impugnatura, la pelle sintetica o i pigmenti?
              </p>

              <div className="pt-1 flex flex-col gap-1.5">
                <a
                  href="https://wa.me/393282247737?text=Ciao%20Chiara,%20sono%20una%20corsista%20del%20videocorso%20di%20Microblading"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Scrivi su WhatsApp</span>
                </a>

                <a
                  href="mailto:info@chiaramorocutti.it?subject=Supporto%20Didattico%20Videocorso%20Microblading"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-xl bg-white border border-primary-200 hover:bg-primary-50 text-primary-900 text-[11px] font-medium transition-all"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-primary-700" />
                  <span>Assistenza via Email</span>
                </a>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Enhanced Student Profile & Logout Footer */}
      <div className="p-4 border-t border-primary-100 bg-[#FAF7F8]">
        <div className="flex items-center gap-3 mb-3 px-1">
          {/* Avatar with initial */}
          <div className="w-9 h-9 bg-primary-900 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-xs border border-primary-700">
            {(user?.fullName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-primary-950 truncate">
              {user?.fullName || user?.email?.split('@')[0]}
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/80 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isAdmin ? 'Amministratore' : 'Accesso Masterclass'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-gray-200/80 bg-white w-full transition-all shadow-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Disconnetti</span>
        </button>
      </div>
    </aside>
  );
};
