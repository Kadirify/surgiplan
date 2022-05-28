import { Box, CircularProgress } from '@mui/material';
import { Permission } from '@surgiplan/shared';
import { lazy, ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { SetPasswordPage } from './pages/auth/SetPasswordPage';

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const SchedulePage = lazy(() => import('./pages/schedule/SchedulePage'));
const RequestsPage = lazy(() => import('./pages/requests/RequestsPage'));
const NewSurgeryPage = lazy(() => import('./pages/surgery/NewSurgeryPage'));
const SurgeryDetailPage = lazy(() => import('./pages/surgery/SurgeryDetailPage'));
const MyCasesPage = lazy(() => import('./pages/my/MyCasesPage'));
const LiveBoardPage = lazy(() => import('./pages/board/LiveBoardPage'));
const AvailabilityPage = lazy(() => import('./pages/availability/AvailabilityPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const CatalogPage = lazy(() => import('./pages/admin/CatalogPage'));
const AuditPage = lazy(() => import('./pages/admin/AuditPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function FullScreenLoader() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={28} />
    </Box>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route
          path="/board"
          element={
            <RequireAuth>
              <LiveBoardPage />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="requests" element={<RequirePermission permission={Permission.SurgeriesCreate}><RequestsPage /></RequirePermission>} />
          <Route path="surgeries/new" element={<RequirePermission permission={Permission.SurgeriesCreate}><NewSurgeryPage /></RequirePermission>} />
          <Route path="surgeries/:id" element={<SurgeryDetailPage />} />
          <Route path="my" element={<MyCasesPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="reports" element={<RequirePermission permission={Permission.ReportsRead}><ReportsPage /></RequirePermission>} />
          <Route path="admin/users" element={<RequirePermission permission={Permission.UsersManage}><UsersPage /></RequirePermission>} />
          <Route path="admin/catalog" element={<RequirePermission permission={Permission.CatalogManage}><CatalogPage /></RequirePermission>} />
          <Route path="admin/audit" element={<RequirePermission permission={Permission.AuditRead}><AuditPage /></RequirePermission>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<Navigate to="/profile" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
