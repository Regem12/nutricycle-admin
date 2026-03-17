import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import LoginPage from "@/pages/LoginPage";
import AdminLayout from "@/layouts/AdminLayout";
import DashboardPage from "@/pages/DashboardPage";
import UsersPage from "@/pages/UsersPage";
import MachinesPage from "@/pages/MachinesPage";
import BatchesPage from "@/pages/BatchesPage";

export default function App() {
  return (
    <>
      <AuthProvider>
        <Toaster
          position="top-right"
          reverseOrder={false}
          gutter={8}
          containerClassName=""
          containerStyle={{}}
          toastOptions={{
            // Default options
            duration: 4000,
            style: {
              background: "#363636",
              color: "#fff",
            },

            // Default options for specific types
            success: {
              duration: 3000,
              style: {
                background: "#f0fdf4",
                color: "#15803d",
                border: "1px solid #86efac",
              },
              iconTheme: {
                primary: "#22c55e",
                secondary: "#fff",
              },
            },
            error: {
              style: {
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fca5a5",
              },
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff",
              },
            },
            loading: {
              style: {
                background: "#eff6ff",
                color: "#1e40af",
                border: "1px solid #93c5fd",
              },
              iconTheme: {
                primary: "#3b82f6",
                secondary: "#fff",
              },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Routes - Protected */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="machines" element={<MachinesPage />} />
            <Route path="batches" element={<BatchesPage />} />
          </Route>

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </>
  );
}
