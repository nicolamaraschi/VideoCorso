import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { Sidebar } from './components/layout/Sidebar';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Loading } from './components/common/Loading';
import { useAuthContext } from './components/auth/useAuthContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminOperationBannerProvider } from './components/common/AdminOperationBanner';

// Route-level code splitting: only the landing/login pages (the first thing
// an anonymous visitor sees) are bundled eagerly. Everything else - the
// checkout flow, the authenticated client area, and the entire admin panel -
// is loaded on demand so public visitors never download admin-only code.
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })));
const VideoPlayerPage = lazy(() => import('./pages/VideoPlayerPage').then((m) => ({ default: m.VideoPlayerPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminCoursePage = lazy(() => import('./pages/AdminCoursePage').then((m) => ({ default: m.AdminCoursePage })));
const AdminStudentsPage = lazy(() => import('./pages/AdminStudentsPage').then((m) => ({ default: m.AdminStudentsPage })));
const AdminStudentDetailPage = lazy(() => import('./pages/AdminStudentDetailPage').then((m) => ({ default: m.AdminStudentDetailPage })));
const AdminPurchasesPage = lazy(() => import('./pages/AdminPurchasesPage').then((m) => ({ default: m.AdminPurchasesPage })));
const AdminAccountsPage = lazy(() => import('./pages/AdminAccountsPage').then((m) => ({ default: m.AdminAccountsPage })));
const AdminPurchaseDetailPage = lazy(() => import('./pages/AdminPurchaseDetailPage').then((m) => ({ default: m.AdminPurchaseDetailPage })));
const AdminCouponsPage = lazy(() => import('./pages/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage })));

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
                path="/"
                element={isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
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
          <Suspense fallback={<Loading fullScreen text="Loading..." />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </main>
      </div>

      <Footer />
    </div>
  );
}

export default App;
