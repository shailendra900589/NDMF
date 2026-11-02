import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './Session';

// Apply the platform boundary before mounting any operational page or its API calls.
export default function ConsoleScope({ children }) {
  const { user } = useSession();
  const { pathname } = useLocation();
  if (user.role === 'superAdmin' && pathname !== '/super-admin' && pathname !== '/super-admin/api' && pathname !== '/super-admin/packages' && pathname !== '/profile') {
    return <Navigate to="/super-admin" replace />;
  }
  if (user.role !== 'superAdmin' && pathname.startsWith('/super-admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  if (user.role !== 'superAdmin' && user.company?.subscription?.isActive === false && user.company?.subscription?.status !== 'not_assigned' && pathname !== '/subscription' && pathname !== '/profile') {
    return <Navigate to="/subscription" replace />;
  }
  return children;
}
