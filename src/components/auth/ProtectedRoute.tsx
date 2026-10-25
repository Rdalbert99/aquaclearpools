import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Navigate } from 'react-router-dom';
import { routeGate } from '@/lib/route-gate';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, session } = useAuth();
  const gate = routeGate({ loading, hasSession: !!session?.user, hasUser: !!user });

  if (gate === 'loading') {
    return <LoadingSpinner />;
  }

  if (gate === 'login') {
    return <Navigate to="/auth/login" replace />;
  }

  // CLIENT-SIDE UX ONLY - Server-side RLS policies enforce actual access control
  // These checks prevent UI confusion but cannot enforce security; all data access is protected by database RLS
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    if (user.role === 'client') {
      return <Navigate to="/client" replace />;
    } else if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else {
      return <Navigate to="/tech" replace />;
    }
  }

  return <>{children}</>;
};