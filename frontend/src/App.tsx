import React from 'react';
// L'import di 'Router' qui non è più necessario, ma 'Routes', 'Route', 'Navigate' sì.
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { Sidebar } from './components/layout/Sidebar';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { DashboardPage } from './pages/DashboardPage';
import { VideoPlayerPage } from './pages/VideoPlayerPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUploadPage } from './pages/AdminUploadPage';
import { AdminCoursePage } from './pages/AdminCoursePage';
import { AdminStudentsPage } from './pages/AdminStudentsPage';

import { useAuth } from './hooks/useAuth';

function App() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    // <Router> <-- RIMOSSA QUESTA RIGA
      <div className="flex flex-col min-h-screen">
        <Navbar />

        <div className="flex flex-1">
          {/* Sidebar for authenticated users */}
          {isAuthenticated && (
            <Sidebar isAdmin={isAdmin} />
          )}

          {/* Main content */}
          <main className="flex-1">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />

              {/* Protected student routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/video/:lessonId"
                element={
                  <ProtectedRoute>
                    <VideoPlayerPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected admin routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/upload"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminUploadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/course"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminCoursePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminStudentsPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch all - redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        <Footer />
      </div>
    // </Router> <-- RIMOSSA QUESTA RIGA
  );
}

export default App;