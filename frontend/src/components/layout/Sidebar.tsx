import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Video,
  Upload,
  Users,
  BarChart3,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isAdmin = false }) => {
  const location = useLocation();

  const studentLinks = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/dashboard/course', icon: BookOpen, label: 'Course' },
  ];

  const adminLinks = [
    { to: '/admin', icon: BarChart3, label: 'Dashboard' },
    { to: '/admin/course', icon: BookOpen, label: 'Course Structure' },
    { to: '/admin/upload', icon: Upload, label: 'Upload Videos' },
    { to: '/admin/students', icon: Users, label: 'Students' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen sticky top-16 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;

          return (
            <Link
              key={link.to}
              to={link.to}
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
    </aside>
  );
};
