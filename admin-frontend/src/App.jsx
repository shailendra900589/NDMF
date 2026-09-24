import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerListings from './pages/CustomerListings';
import Customers from './pages/Customers';
import Tracking from './pages/Tracking';
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
  const user = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
  if (!canAccess(user, permission)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<PermissionRoute permission="dashboard"><Dashboard /></PermissionRoute>} />
        <Route path="customer-listings" element={<PermissionRoute permission="customerListings"><CustomerListings /></PermissionRoute>} />
        <Route path="customers" element={<PermissionRoute permission="customers"><Customers /></PermissionRoute>} />
        <Route path="attendance" element={<PermissionRoute permission="attendance"><Attendance /></PermissionRoute>} />
        <Route path="tracking" element={<PermissionRoute permission="tracking"><Tracking /></PermissionRoute>} />
        <Route path="call-logs" element={<PermissionRoute permission="callLogs"><CallLogs /></PermissionRoute>} />
        <Route path="users" element={<PermissionRoute permission="users"><Users /></PermissionRoute>} />
        <Route path="branches" element={<PermissionRoute permission="branches"><Branches /></PermissionRoute>} />
        <Route path="payslips" element={<PermissionRoute permission="payslips"><PaySlips /></PermissionRoute>} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}
