import React from "react";
import { User, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOutletContext } from "react-router-dom";

export default function DashboardHeader({ title, subtitle }) {
  const { user } = useAuth();
  const { toggleSidebar } = useOutletContext();

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4">
      <div className="flex items-center justify-between">
        {/* Mobile Menu Button & Title Section */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1 hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-semibold text-gray-900">
                {user?.displayName || "Admin User"}
              </p>
              <p className="text-xs text-gray-500">
                {user?.email || "admin@nutricycle.com"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
