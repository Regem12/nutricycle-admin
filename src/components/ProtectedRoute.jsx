import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

// Cache the auth status to avoid repeated checks
let authStatusCache = null;
let authStatusCheckInProgress = false;

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [authDisabled, setAuthDisabled] = useState(authStatusCache);
  const location = useLocation();

  useEffect(() => {
    // If we already checked, use cached result
    if (authStatusCache !== null) {
      setAuthDisabled(authStatusCache);
      return;
    }

    // Avoid duplicate checks while one is in progress
    if (authStatusCheckInProgress) {
      return;
    }

    authStatusCheckInProgress = true;

    // Check if auth is disabled by calling /admin/verify endpoint with timeout
    const checkAuthStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

        const response = await fetch(`${API_URL}/admin/verify`, {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        // If we got a successful response, auth is disabled or user is logged in
        const result = response.ok;
        authStatusCache = result;
        setAuthDisabled(result);
      } catch (error) {
        // Timeout or network error - assume auth is enabled (safer default)
        console.debug("Auth check error:", error.message);
        authStatusCache = false;
        setAuthDisabled(false);
      } finally {
        authStatusCheckInProgress = false;
      }
    };

    checkAuthStatus();
  }, []);

  // Show loading spinner only while auth is being checked AND auth context is loading
  if (loading || authDisabled === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is enabled and no user, redirect to login
  if (!user && !authDisabled) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
