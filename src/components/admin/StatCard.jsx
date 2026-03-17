import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({
  icon: Icon,
  title,
  value,
  change,
  changeType = "increase",
  color = "green",
  subtitle,
}) {
  const colorClasses = {
    green: "from-green-500 to-emerald-600",
    blue: "from-blue-500 to-cyan-600",
    purple: "from-purple-500 to-pink-600",
    orange: "from-orange-500 to-amber-600",
    emerald: "from-emerald-500 to-teal-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>

          {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}

          {change && (
            <div className="flex items-center gap-1 mt-2">
              {changeType === "increase" ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  changeType === "increase" ? "text-green-600" : "text-red-600"
                }`}
              >
                {change}
              </span>
              <span className="text-sm text-gray-500">vs last month</span>
            </div>
          )}
        </div>

        <div
          className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
