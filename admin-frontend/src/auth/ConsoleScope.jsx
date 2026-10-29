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
    return <Navigate to="/" replace />;
  }
  return children;
}
