import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Home, Calendar, Users, Calculator, FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = { label: string; icon: typeof Home; path: string };

/**
 * Mobile-only bottom navigation for signed-in users. Mirrors links that already
 * exist in the navbar — no new destinations, no desktop changes.
 */
export const MobileBottomNav = () => {
  const { isAuthenticated, isAdmin, isTech, isClient } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  let items: NavItem[] = [];
  if (isAdmin) {
    items = [
      { label: 'Home', icon: Home, path: '/admin' },
      { label: 'Clients', icon: Users, path: '/admin/clients' },
      { label: 'Requests', icon: FileText, path: '/admin/service-request-management' },
      { label: 'Calc', icon: Calculator, path: '/admin/calculator' },
      { label: 'Profile', icon: User, path: '/profile' },
    ];
  } else if (isTech) {
    items = [
      { label: 'Home', icon: Home, path: '/tech' },
      { label: 'Schedule', icon: Calendar, path: '/tech/schedule' },
      { label: 'Clients', icon: Users, path: '/tech/clients' },
      { label: 'Calc', icon: Calculator, path: '/tech/calculator' },
      { label: 'Profile', icon: User, path: '/profile' },
    ];
  } else if (isClient) {
    items = [
      { label: 'Home', icon: Home, path: '/client' },
      { label: 'Services', icon: FileText, path: '/client/services' },
      { label: 'Profile', icon: User, path: '/profile' },
    ];
  }

  if (items.length === 0) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[150] border-t bg-background/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));
          return (
            <li key={item.path} className="flex-1">
              <Link
                to={item.path}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
