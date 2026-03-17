import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Cpu,
  Package,
  Activity,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import DashboardHeader from "@/components/admin/DashboardHeader";
import StatCard from "@/components/admin/StatCard";
import {
  getUsers,
  getAllMachines,
  getBatches,
  getDetectionEvents,
} from "@/services/api";
import toast from "react-hot-toast";

// Build activity timeline from recent events
const buildActivityTimeline = (batches, machines, detections) => {
  const activities = [];

  // Add batch activities
  batches.forEach((batch) => {
    if (batch.startedAt) {
      activities.push({
        id: `batch-start-${batch.id}`,
        type: "batch-start",
        icon: Package,
        color: "blue",
        title: `Batch ${batch.batchNumber} started`,
        description: `Machine: ${batch.machine?.machineId || "Unknown"}`,
        timestamp: new Date(batch.startedAt),
      });
    }
    if (batch.endedAt && batch.status?.toLowerCase() === "completed") {
      activities.push({
        id: `batch-complete-${batch.id}`,
        type: "batch-complete",
        icon: CheckCircle,
        color: "green",
        title: `Batch ${batch.batchNumber} completed`,
        description: batch.compostOutput
          ? `Output: ${batch.compostOutput}kg compost`
          : "Processing finished",
        timestamp: new Date(batch.endedAt),
      });
    }
  });

  // Add detection events
  if (Array.isArray(detections)) {
    detections.slice(0, 5).forEach((detection) => {
      if (detection.foreignObject) {
        activities.push({
          id: `detection-${detection.id}`,
          type: "detection",
          icon: AlertTriangle,
          color: "red",
          title: "Foreign object detected",
          description: `Machine: ${detection.machine?.machineId || detection.machineId} (${Math.round(detection.confidence * 100)}% confidence)`,
          timestamp: new Date(detection.timestamp),
        });
      }
    });
  }

  // Sort by most recent
  return activities.sort((a, b) => b.timestamp - a.timestamp);
};

// Build chart data for batch completions over last 7 days
const buildChartData = (batches) => {
  const data = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayBatches = batches.filter((batch) => {
      const batchDate = batch.startedAt
        ? new Date(batch.startedAt)
        : new Date(batch.createdAt);
      return batchDate >= date && batchDate < nextDate;
    });

    const completed = dayBatches.filter(
      (b) => b.status?.toLowerCase() === "completed",
    ).length;
    const processing = dayBatches.filter((b) =>
      ["processing", "running"].includes(b.status?.toLowerCase()),
    ).length;
    const failed = dayBatches.filter(
      (b) => b.status?.toLowerCase() === "failed",
    ).length;

    data.push({
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      completed,
      processing,
      failed,
      total: dayBatches.length,
    });
  }

  return data;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeMachines: 0,
    totalMachines: 0,
    processingBatches: 0,
    completedToday: 0,
  });
  const [recentBatches, setRecentBatches] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activityTimeline, setActivityTimeline] = useState([]);
  const [chartData, setChartData] = useState([]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      setLoading(true);
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);

      // Fetch all data in parallel
      const [usersData, machinesData, batchesData, detectionData] =
        await Promise.all([
          getUsers().catch(() => ({ users: [] })),
          getAllMachines(false).catch(() => []),
          getBatches().catch(() => []),
          getDetectionEvents().catch(() => []),
        ]);

      // Calculate stats
      const totalUsers = usersData.users?.length || 0;
      const allMachines = Array.isArray(machinesData) ? machinesData : [];
      const activeMachines = allMachines.filter(
        (m) => m.status?.toLowerCase() === "online",
      ).length;
      const totalMachines = allMachines.length;

      const allBatches = Array.isArray(batchesData) ? batchesData : [];
      const processingBatches = allBatches.filter((b) =>
        ["processing", "running"].includes(b.status?.toLowerCase()),
      ).length;

      // Count batches completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completedToday = allBatches.filter((b) => {
        if (b.status?.toLowerCase() !== "completed" || !b.endedAt) return false;
        const endDate = new Date(b.endedAt);
        endDate.setHours(0, 0, 0, 0);
        return endDate.getTime() === today.getTime();
      }).length;

      setStats({
        totalUsers,
        activeMachines,
        totalMachines,
        processingBatches,
        completedToday,
      });

      // Get recent batches (last 5)
      const sortedBatches = [...allBatches]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      setRecentBatches(sortedBatches);

      // Get machines for status display
      setMachines(allMachines.slice(0, 5));

      // Build activity timeline
      const timeline = buildActivityTimeline(
        allBatches,
        allMachines,
        detectionData,
      );
      setActivityTimeline(timeline.slice(0, 10));

      // Build chart data for last 7 days
      const chart = buildChartData(allBatches);
      setChartData(chart);

      if (isRefresh) {
        toast.success("Dashboard refreshed");
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError("Failed to load dashboard data");
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || "queued";
    switch (statusLower) {
      case "online":
      case "completed":
        return "bg-green-500";
      case "processing":
      case "running":
        return "bg-blue-500";
      case "queued":
      case "idle":
        return "bg-yellow-500";
      case "offline":
      case "failed":
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getMachineStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || "offline";
    switch (statusLower) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <DashboardHeader
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening with your system today."
      />

      <div className="p-4 sm:p-8 space-y-8">
        {/* Refresh Button */}
        <div className="flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="text-sm font-medium">
              {refreshing ? "Refreshing..." : "Refresh"}
            </span>
          </button>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">
                  Error loading dashboard
                </p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => fetchDashboardData()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <>
            {/* Skeleton Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-16 mt-2"></div>
                    </div>
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Skeleton Activity Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-48 mb-6"></div>
              <div className="h-64 bg-gray-100 rounded-lg"></div>
            </div>

            {/* Skeleton Three Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
                >
                  <div className="h-6 bg-gray-200 rounded w-32 mb-6"></div>
                  <div className="space-y-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center gap-3 py-3">
                        <div className="w-5 h-5 bg-gray-200 rounded"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon={Users}
                title="Total Users"
                value={stats.totalUsers.toString()}
                color="green"
              />
              <StatCard
                icon={Cpu}
                title="Active Machines"
                value={`${stats.activeMachines}/${stats.totalMachines}`}
                color="blue"
              />
              <StatCard
                icon={Activity}
                title="Processing Batches"
                value={stats.processingBatches.toString()}
                color="purple"
              />
              <StatCard
                icon={CheckCircle}
                title="Completed Today"
                value={stats.completedToday.toString()}
                color="emerald"
              />
            </div>

            {/* Activity Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">
                  Batch Activity (Last 7 Days)
                </h3>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b7280"
                      style={{ fontSize: "12px" }}
                    />
                    <YAxis stroke="#6b7280" style={{ fontSize: "12px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Completed"
                      dot={{ fill: "#10b981", r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="processing"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Processing"
                      dot={{ fill: "#3b82f6", r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      stroke="#ef4444"
                      strokeWidth={2}
                      name="Failed"
                      dot={{ fill: "#ef4444", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                  <div className="text-center">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No activity data yet</p>
                  </div>
                </div>
              )}
            </div>

            {/* Three Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Batches */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    Recent Batches
                  </h3>
                  <button
                    onClick={() => navigate("/admin/batches")}
                    className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-4">
                  {recentBatches.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No batches yet</p>
                    </div>
                  ) : (
                    recentBatches.map((batch) => (
                      <div
                        key={batch.id}
                        onClick={() => navigate("/admin/batches")}
                        className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-semibold text-gray-900">
                              {batch.batchNumber}
                            </p>
                            <p className="text-sm text-gray-500">
                              {batch.machine?.machineId || "Unknown Machine"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${getStatusColor(batch.status)}`}
                            ></span>
                            <span className="text-sm font-medium text-gray-700 capitalize">
                              {batch.status?.toLowerCase() || "queued"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(batch.startedAt || batch.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    Recent Activity
                  </h3>
                </div>
                <div className="space-y-4">
                  {activityTimeline.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        No recent activity
                      </p>
                    </div>
                  ) : (
                    activityTimeline.map((activity) => {
                      const Icon = activity.icon;
                      const colorClasses = {
                        green: "bg-green-100 text-green-600",
                        blue: "bg-blue-100 text-blue-600",
                        red: "bg-red-100 text-red-600",
                        yellow: "bg-yellow-100 text-yellow-600",
                      };

                      return (
                        <div
                          key={activity.id}
                          className="flex gap-3 py-2 border-b border-gray-100 last:border-0"
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClasses[activity.color] || colorClasses.blue}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {activity.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {activity.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatTimeAgo(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Machine Status */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    Machine Status
                  </h3>
                  <button
                    onClick={() => navigate("/admin/machines")}
                    className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-4">
                  {machines.length === 0 ? (
                    <div className="text-center py-8">
                      <Cpu className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No machines yet</p>
                    </div>
                  ) : (
                    machines.map((machine) => (
                      <div
                        key={machine.id}
                        onClick={() =>
                          navigate(
                            `/admin/machines?search=${encodeURIComponent(machine.machineId)}`,
                          )
                        }
                        className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Cpu className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-semibold text-gray-900">
                              {machine.machineId}
                            </p>
                            <p className="text-sm text-gray-500">
                              {machine.userMachines?.length || 0} user(s) linked
                              {machine.lastCommandAt &&
                                ` • Last seen ${formatTimeAgo(machine.lastCommandAt)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${getMachineStatusColor(machine.status)}`}
                          ></span>
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {machine.status?.toLowerCase() || "offline"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
