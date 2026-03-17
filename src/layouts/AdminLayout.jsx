import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Sidebar from "@/components/admin/Sidebar";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Add small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 600));
      await logout();
      toast.success("Logged out successfully.");
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        isLoggingOut={isLoggingOut}
      />
      <Outlet context={{ toggleSidebar }} />
    </div>
  );
}
