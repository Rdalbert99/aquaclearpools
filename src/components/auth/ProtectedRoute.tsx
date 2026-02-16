import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
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