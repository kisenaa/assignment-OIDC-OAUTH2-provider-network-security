import { Loader2 } from 'lucide-react';
import { Suspense, lazy } from 'react';
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from 'react-router';

import ErrorBoundary from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';

const Home = lazy(() => import('@/pages/Home'));
const Settings = lazy(() => import('@/pages/Settings'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const RouteLoader = () => (
  <div className="flex h-[calc(100vh-60px)] items-center justify-center">
    <Loader2 className="size-6 animate-spin" />
  </div>
);

function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          {/* <Route path="/page1" element={<Page1 />} />
          <Route path="/page2" element={<Page2 />} /> */}
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRouter() {
  return (
    <Router>
      <AppRoutes />
      <Toaster position="top-right" />
    </Router>
  );
}

export default AppRouter;
