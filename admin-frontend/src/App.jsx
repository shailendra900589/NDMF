import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { lazy, Suspense } from 'react';
const DeveloperAccess = lazy(() => import('./pages/DeveloperAccess'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const Packages = lazy(() => import('./pages/Packages'));
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerListings from './pages/CustomerListings';
import Customers from './pages/Customers';
import Tracking from './pages/Tracking';
const EmployeeTracking = lazy(() => import('./pages/EmployeeTracking'));
import CallLogs from './pages/CallLogs';
import Attendance from './pages/Attendance';
import Users from './pages/Users';
import Branches from './pages/Branches';
import PaySlips from './pages/PaySlips';
import Profile from './pages/Profile';
import TeamWorkspace from './pages/TeamWorkspace';
import { canAccess } from './utils/permissions';
import VerifiedSession, { useSession } from './auth/Session';
import ConsoleScope from './auth/ConsoleScope';

function PermissionRoute({ permission, children }) {
  const { user } = useSession();
  if (!canAccess(user, permission)) {
    return <Navigate to={user.role === 'superAdmin' ? '/super-admin' : '/profile'} replace />;
  }
  return children;
}

function HomeRoute() {
  const { user } = useSession();
  if (user.role === 'superAdmin') return <Navigate to="/super-admin" replace />;
  return canAccess(user, 'dashboard') ? <Dashboard /> : <Navigate to="/profile" replace />;
}
function SuperAdminRoute({ apiAccess = false, packages = false }) {
  const { user } = useSession();
  return user.role === 'superAdmin' ? <Suspense fallback={<div>Loading company console…</div>}><>{packages ? <Packages/> : apiAccess ? <DeveloperAccess /> : <SuperAdmin />}</></Suspense> : <Navigate to="/" replace />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<VerifiedSession><ConsoleScope><Layout /></ConsoleScope></VerifiedSession>}>
        <Route index element={<HomeRoute />} />
        <Route path="super-admin/api" element={<SuperAdminRoute apiAccess />} />
        <Route path="super-admin/packages" element={<SuperAdminRoute packages />} />
        <Route path="super-admin" element={<SuperAdminRoute />} />
        <Route path="customer-listings" element={<PermissionRoute permission="customerListings"><CustomerListings /></PermissionRoute>} />
        <Route path="customers" element={<PermissionRoute permission="customers"><Customers /></PermissionRoute>} />
        <Route path="attendance" element={<PermissionRoute permission="attendance"><Attendance /></PermissionRoute>} />
        <Route path="tracking" element={<PermissionRoute permission="tracking"><Tracking /></PermissionRoute>} />
        <Route path="tracking/employee" element={<PermissionRoute permission="tracking"><Suspense fallback={<div role="status">Loading employee workspace…</div>}><EmployeeTracking /></Suspense></PermissionRoute>} />
        <Route path="call-logs" element={<PermissionRoute permission="callLogs"><CallLogs /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute permission="users"><Users /></PermissionRoute>} />
        <Route path="branches" element={<PermissionRoute permission="branches"><Branches /></PermissionRoute>} />
        <Route path="payroll" element={<PermissionRoute permission="payslips"><PaySlips /></PermissionRoute>} />
        <Route path="payslips" element={<Navigate to="/payroll" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notices" element={<PermissionRoute permission="notices"><TeamWorkspace key="notices" kind="notices" /></PermissionRoute>} />
        <Route path="visits" element={<PermissionRoute permission="visits"><TeamWorkspace key="visits" kind="visits" /></PermissionRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
