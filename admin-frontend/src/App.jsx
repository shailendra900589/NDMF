import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { lazy, Suspense } from 'react';
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerListings from './pages/CustomerListings';
import Customers from './pages/Customers';
import Tracking from './pages/Tracking';
import EmployeeTracking from './pages/EmployeeTracking';
import CallLogs from './pages/CallLogs';
import Attendance from './pages/Attendance';
import Users from './pages/Users';
import Branches from './pages/Branches';
import PaySlips from './pages/PaySlips';
import Profile from './pages/Profile';
import { canAccess } from './utils/permissions';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('ndfa_token');
  if (!token) return <Navigate to="/login" />;
  return children;
}

function PermissionRoute({ permission, children }) {
  let user = {};
  try {
    const parsed = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
    user = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    user = {};
  }
  if (!canAccess(user, permission)) {
    return <Navigate to={user.role === 'superAdmin' ? '/super-admin' : '/profile'} replace />;
  }
  return children;
}

function HomeRoute() {
  const user = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  if (user.role === 'superAdmin') return <Navigate to="/super-admin" replace />;
  return canAccess(user, 'dashboard') ? <Dashboard /> : <Navigate to="/profile" replace />;
}
function SuperAdminRoute() {
  const user = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  return user.role === 'superAdmin' ? <Suspense fallback={<div>Loading company console…</div>}><SuperAdmin /></Suspense> : <Navigate to="/" replace />;
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<HomeRoute />} />
        <Route path="super-admin" element={<SuperAdminRoute />} />
        <Route path="customer-listings" element={<PermissionRoute permission="customerListings"><CustomerListings /></PermissionRoute>} />
        <Route path="customers" element={<PermissionRoute permission="customers"><Customers /></PermissionRoute>} />
        <Route path="attendance" element={<PermissionRoute permission="attendance"><Attendance /></PermissionRoute>} />
        <Route path="tracking" element={<PermissionRoute permission="tracking"><Tracking /></PermissionRoute>} />
        <Route path="tracking/employee" element={<PermissionRoute permission="tracking"><EmployeeTracking /></PermissionRoute>} />
        <Route path="call-logs" element={<PermissionRoute permission="callLogs"><CallLogs /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute permission="users"><Users /></PermissionRoute>} />
        <Route path="branches" element={<PermissionRoute permission="branches"><Branches /></PermissionRoute>} />
        <Route path="payslips" element={<PermissionRoute permission="payslips"><PaySlips /></PermissionRoute>} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
