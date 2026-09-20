import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homeForRole, useAuth } from '@/stores/auth';
import type { Role } from '@/lib/types';

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, token } = useAuth();
  const loc = useLocation();
  if (!token || !user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role) && user.role !== 'ADMIN') return <Navigate to={homeForRole(user.role)} replace />;
  return <Outlet />;
}
