import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { Sidebar } from './components/layout/Sidebar';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Loading } from './components/common/Loading';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAuthContext } from './components/auth/useAuthContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminOperationBannerProvider } from './components/common/AdminOperationBanner';

// Route-level code splitting with automatic retry on new deployment chunk mismatch:
// If a user has a stale tab open when Amplify finishes a new build, a dynamic import
// might 404 on the old hash. lazyWithRetry catches this and automatically reloads
// the window to fetch the new build seamlessly without any crash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const pageHasBeenForceRefreshed = window.sessionStorage.getItem('chunk_reload_attempted') === 'true';

    try {
      const module = await factory();
      window.sessionStorage.removeItem('chunk_reload_attempted');
      return module;
    } catch (error) {
      if (!pageHasBeenForceRefreshed) {
        window.sessionStorage.setItem('chunk_reload_attempted', 'true');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

const CheckoutPage = lazyWithRetry(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CourseDetailPage = lazyWithRetry(() => import('./pages/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })));
const VideoPlayerPage = lazyWithRetry(() => import('./pages/VideoPlayerPage').then((m) => ({ default: m.VideoPlayerPage })));
const AdminDashboardPage = lazyWithRetry(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminCoursePage = lazyWithRetry(() => import('./pages/AdminCoursePage').then((m) => ({ default: m.AdminCoursePage })));
const AdminStudentsPage = lazyWithRetry(() => import('./pages/AdminStudentsPage').then((m) => ({ default: m.AdminStudentsPage })));
const AdminStudentDetailPage = lazyWithRetry(() => import('./pages/AdminStudentDetailPage').then((m) => ({ default: m.AdminStudentDetailPage })));
const AdminPurchasesPage = lazyWithRetry(() => import('./pages/AdminPurchasesPage').then((m) => ({ default: m.AdminPurchasesPage })));
const AdminAccountsPage = lazyWithRetry(() => import('./pages/AdminAccountsPage').then((m) => ({ default: m.AdminAccountsPage })));
const AdminPurchaseDetailPage = lazyWithRetry(() => import('./pages/AdminPurchaseDetailPage').then((m) => ({ default: m.AdminPurchaseDetailPage })));
const AdminCouponsPage = lazyWithRetry(() => import('./pages/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage })));
const AdminSystemLogsPage = lazyWithRetry(() => import('./pages/AdminSystemLogsPage').then((m) => ({ default: m.AdminSystemLogsPage })));

const ScrollToPageStart = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Le pagine pubbliche scorrono nella finestra, quelle autenticate nel
    // contenitore centrale accanto alla sidebar: riportiamo entrambi all'inizio.
    // L'hash non è una dipendenza intenzionalmente, così i link della landing
    // continuano a scorrere alla sezione richiesta.
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('[data-app-scroll]')?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return null;
};

function App() {
  const { isAuthenticated, isAdmin, loading } = useAuthContext();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading && location.pathname !== '/' && location.pathname !== '/login') {
    return <Loading fullScreen text="Loading..." />;
  }

  if (isAuthenticated) {
    // App shell per le aree autenticate: altezza bloccata al viewport,
    // la sidebar resta fissa e solo il contenuto centrale scrolla.
    // Questo evita che elementi fixed/sticky (sidebar, barre di azione)
    // finiscano per sovrapporsi a navbar/footer su pagine lunghe.
    return (
      <AdminOperationBannerProvider>
      <div className="h-[100dvh] flex flex-col overflow-hidden">
        <ScrollToPageStart />
        <Navbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

        <div className="flex flex-1 w-full max-w-full min-h-0">
          {/* Mobile Overlay */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-gray-900/50 z-40 xl:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
          <Sidebar isAdmin={isAdmin} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

          <main data-app-scroll className="flex-1 w-full min-w-0 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain relative">
            <ErrorBoundary>
              <Suspense fallback={<Loading fullScreen text="Loading..." />}>
                <Routes>
                  <Route
                    path="/dashboard"
                    element={(
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/courses/:courseId"
                    element={(
                      <ProtectedRoute>
                        <CourseDetailPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/courses/:courseId/lessons/:lessonId"
                    element={(
                      <ProtectedRoute>
                        <VideoPlayerPage />
                      </ProtectedRoute>
                    )}
                  />

                  <Route
                    path="/admin"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminDashboardPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/course"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminCoursePage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/students"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminStudentsPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/students/:studentId"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminStudentDetailPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/purchases"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminPurchasesPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/purchases/:purchaseId"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminPurchaseDetailPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/accounts"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminAccountsPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/coupons"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminCouponsPage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/admin/system-logs"
                    element={(
                      <ProtectedRoute requireAdmin>
                        <AdminSystemLogsPage />
                      </ProtectedRoute>
                    )}
                  />

                  <Route
                    path="/"
                    element={isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      </AdminOperationBannerProvider>
    );
  }

  // Pagine pubbliche: layout normale con footer marketing, la pagina scrolla per intero.
  return (
    <div className="flex flex-col min-h-screen relative">
      <ScrollToPageStart />
      <Navbar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

      <div className="flex flex-1 w-full max-w-full">
        <main className="flex-1 w-full min-w-0">
          <ErrorBoundary>
            <Suspense fallback={<Loading fullScreen text="Loading..." />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <Footer />
    </div>
  );
}

export default App;
