import React from "react";
import {
  LayoutDashboard,
  Users,
  Cpu,
  Package,
  LogOut,
  X,
  Loader2,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo1.png";

export default function Sidebar({ onLogout, isOpen, onClose, isLoggingOut }) {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Users", path: "/users" },
    { icon: Cpu, label: "Machines", path: "/machines" },
    { icon: Package, label: "Batches", path: "/batches" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-white border-r border-gray-200 h-screen flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="NutriCycle Logo"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="font-bold text-gray-900">NutriCycle</h2>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-green-50 text-green-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            disabled={isLoggingOut}
            className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Logging out...</span>
              </>
            ) : (
              <>
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
