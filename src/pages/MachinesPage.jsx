import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Cpu,
  Search,
  Edit2,
  Trash2,
  Power,
  Activity,
  Clock,
  X,
  Users,
  Info,
  Package,
  Thermometer,
  Droplet,
  ArrowUp,
  ArrowDown,
  FilterX,
  Download,
  RefreshCw,
  Inbox,
  AlertCircle,
  Archive,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import DashboardHeader from "@/components/admin/DashboardHeader";
import {
  getAllMachines,
  archiveMachine,
  restoreMachine,
  permanentlyDeleteMachine,
} from "@/services/api";
import toast from "react-hot-toast";

export default function MachinesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Pre-populate search from URL param (e.g. navigated from BatchesPage machine link)
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get("search") || "",
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("lastActive");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machineToArchive, setMachineToArchive] = useState(null);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archivingMachineId, setArchivingMachineId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] =
    useState(false);
  const [machineToDelete, setMachineToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingMachineId, setDeletingMachineId] = useState(null);
  const [restoringMachineId, setRestoringMachineId] = useState(null);

  const fetchMachines = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllMachines(showArchived);
      // Store full machine data including userMachines and batches
      setMachines(data);
    } catch (error) {
      console.error("Failed to fetch machines:", error);
      toast.error("Failed to load machines");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  // Fetch machines on mount and when showArchived changes
  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  const filteredMachines = machines
    .filter((machine) => {
      // Filter by archived status based on toggle
      const matchesArchiveFilter = showArchived
        ? machine.isArchived === true
        : machine.isArchived === false;

      // Advanced search: search by machine ID, user emails, or custom names
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        machine.machineId.toLowerCase().includes(searchLower) ||
        machine.userMachines?.some(
          (um) =>
            um.user?.email?.toLowerCase().includes(searchLower) ||
            um.name?.toLowerCase().includes(searchLower),
        );
      const matchesFilter =
        filterStatus === "all" || machine.status === filterStatus;
      return matchesArchiveFilter && matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case "machineId":
          compareValue = a.machineId.localeCompare(b.machineId);
          break;
        case "lastActive":
          compareValue =
            new Date(b.lastCommandAt || b.createdAt) -
            new Date(a.lastCommandAt || a.createdAt);
          break;
        case "users":
          compareValue =
            (b.userMachines?.length || 0) - (a.userMachines?.length || 0);
          break;
        case "batches":
          compareValue = (b.batches?.length || 0) - (a.batches?.length || 0);
          break;
        default:
          compareValue = 0;
      }

      return sortOrder === "asc" ? -compareValue : compareValue;
    });

  const handleViewDetails = (machine) => {
    setSelectedMachine(machine);
    setShowDetailsModal(true);
  };

  const getStatusColor = (status) => {
    return status === "online" ? "bg-green-500" : "bg-gray-400";
  };

  const getStatusBadgeColor = (status) => {
    return status === "online"
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-700";
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getOfflineDuration = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInMinutes / 1440);

    if (diffInMinutes < 60) return `${diffInMinutes} minutes`;
    if (diffInHours < 24) return `${diffInHours} hours`;
    return `${diffInDays} days`;
  };

  const handleArchiveMachine = async () => {
    if (!machineToArchive) return;

    try {
      setArchivingMachineId(machineToArchive.machineId);
      await archiveMachine(machineToArchive.machineId);
      toast.success("Machine archived successfully");
      setShowArchiveModal(false);
      setMachineToArchive(null);
      // Refresh the list
      await fetchMachines();
    } catch (error) {
      console.error("Failed to archive machine:", error);
      toast.error("Failed to archive machine");
    } finally {
      setArchivingMachineId(null);
    }
  };

  const handleRestoreMachine = async (machine) => {
    try {
      setRestoringMachineId(machine.machineId);
      await restoreMachine(machine.machineId);
      toast.success("Machine restored successfully");
      // Refresh the list
      await fetchMachines();
    } catch (error) {
      console.error("Failed to restore machine:", error);
      toast.error("Failed to restore machine");
    } finally {
      setRestoringMachineId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!machineToDelete) return;

    // Verify confirmation matches machine ID
    if (deleteConfirmation !== machineToDelete.machineId) {
      toast.error("Machine ID does not match");
      return;
    }

    try {
      setDeletingMachineId(machineToDelete.machineId);
      const result = await permanentlyDeleteMachine(machineToDelete.machineId);
      toast.success(
        `Machine permanently deleted. Removed ${result.deletedRecords.batches} batches.`,
      );
      setShowPermanentDeleteModal(false);
      setMachineToDelete(null);
      setDeleteConfirmation("");
      // Refresh the list
      await fetchMachines();
    } catch (error) {
      console.error("Failed to permanently delete machine:", error);
      toast.error(error.message || "Failed to permanently delete machine");
    } finally {
      setDeletingMachineId(null);
    }
  };

  const confirmPermanentDelete = (machine) => {
    setMachineToDelete(machine);
    setDeleteConfirmation("");
    setShowPermanentDeleteModal(true);
  };

  const confirmArchive = (machine) => {
    setMachineToArchive(machine);
    setShowArchiveModal(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setSortBy("lastActive");
    setSortOrder("desc");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    filterStatus !== "all" ||
    sortBy !== "lastActive" ||
    sortOrder !== "desc";

  const exportToCSV = () => {
    try {
      // Prepare CSV headers
      const headers = [
        "Machine ID",
        "Status",
        "Temperature (°C)",
        "Humidity (%)",
        "Batches",
        "Users",
        "Last Active",
        "Created At",
      ];

      // Prepare CSV rows
      const rows = filteredMachines.map((machine) => [
        machine.machineId,
        machine.status,
        machine.lastTelemetry?.temperature ?? "N/A",
        machine.lastTelemetry?.humidity ?? "N/A",
        machine.batches?.length || 0,
        machine.userMachines?.length || 0,
        machine.lastCommandAt
          ? new Date(machine.lastCommandAt).toLocaleString()
          : "Never",
        new Date(machine.createdAt).toLocaleString(),
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `machines_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${filteredMachines.length} machines to CSV`);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export data");
    }
  };

  const onlineCount = machines.filter((m) => m.status === "online").length;
  const offlineCount = machines.filter((m) => m.status === "offline").length;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <DashboardHeader
        title="Machines Management"
        subtitle="Monitor and manage IoT devices"
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by machine ID, user email, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>

            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-sm"
              >
                <option value="lastActive">Last Active</option>
                <option value="machineId">Machine ID</option>
                <option value="users">User Count</option>
                <option value="batches">Batch Count</option>
              </select>

              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? (
                  <ArrowUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-gray-600" />
                )}
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                title="Clear all filters"
              >
                <FilterX className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Show Archived Toggle */}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg transition-colors font-medium ${
                showArchived
                  ? "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              title={
                showArchived
                  ? "Hide archived machines"
                  : "Show archived machines"
              }
            >
              <Archive className="w-4 h-4" />
              <span className="hidden lg:inline">
                {showArchived ? "Archived" : "Archived"}
              </span>
            </button>

            {/* Refresh Button - Icon Only */}
            <button
              onClick={fetchMachines}
              disabled={loading}
              className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>

            {/* Export Button */}
            <button
              onClick={exportToCSV}
              disabled={machines.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export machines to CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Cpu className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Machines</p>
                <p className="text-2xl font-bold text-gray-900">
                  {machines.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Power className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Online</p>
                <p className="text-2xl font-bold text-gray-900">
                  {onlineCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Offline</p>
                <p className="text-2xl font-bold text-gray-900">
                  {offlineCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Machines Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                <p className="text-gray-600 font-medium">Loading machines...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Machine ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Telemetry
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Batches
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMachines.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-16">
                        <div className="flex flex-col items-center justify-center text-center">
                          {machines.length === 0 ? (
                            <>
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Inbox className="w-8 h-8 text-gray-400" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                No Machines Yet
                              </h3>
                              <p className="text-sm text-gray-500 mb-4">
                                Machines will appear here once they are
                                registered with the system.
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="w-8 h-8 text-orange-500" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                No Machines Found
                              </h3>
                              <p className="text-sm text-gray-500 mb-4">
                                {searchTerm
                                  ? `No machines match "${searchTerm}"`
                                  : "Try adjusting your filters"}
                              </p>
                              {hasActiveFilters && (
                                <button
                                  onClick={clearFilters}
                                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                                >
                                  Clear all filters
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMachines.map((machine) => (
                      <tr
                        key={machine.id}
                        onClick={() => handleViewDetails(machine)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
                              <Cpu className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {machine.machineId}
                              </p>
                              <p className="text-xs text-gray-500">
                                Added{" "}
                                {new Date(
                                  machine.createdAt,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${getStatusColor(machine.status)}`}
                            ></span>
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(machine.status)}`}
                            >
                              {machine.status.charAt(0).toUpperCase() +
                                machine.status.slice(1)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {machine.lastTelemetry &&
                          (machine.lastTelemetry.temperature !== undefined ||
                            machine.lastTelemetry.humidity !== undefined) ? (
                            <div className="text-sm">
                              {machine.lastTelemetry.temperature !==
                                undefined && (
                                <p className="text-gray-900">
                                  🌡️ {machine.lastTelemetry.temperature}°C
                                </p>
                              )}
                              {machine.lastTelemetry.humidity !== undefined && (
                                <p className="text-gray-600">
                                  💧 {machine.lastTelemetry.humidity}%
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">
                              No data
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {machine.batches?.length || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {machine.userMachines?.length || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className="flex items-center gap-2 text-sm text-gray-600"
                            title={
                              machine.lastCommandAt
                                ? new Date(
                                    machine.lastCommandAt,
                                  ).toLocaleString()
                                : "Never"
                            }
                          >
                            <Clock className="w-4 h-4" />
                            {getTimeAgo(machine.lastCommandAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {machine.isArchived ? (
                              <>
                                {/* Restore Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreMachine(machine);
                                  }}
                                  disabled={
                                    restoringMachineId === machine.machineId
                                  }
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Restore machine"
                                >
                                  {restoringMachineId === machine.machineId ? (
                                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Archive className="w-4 h-4" />
                                  )}
                                </button>
                                {/* Permanent Delete Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmPermanentDelete(machine);
                                  }}
                                  disabled={
                                    deletingMachineId === machine.machineId
                                  }
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Permanently delete machine"
                                >
                                  {deletingMachineId === machine.machineId ? (
                                    <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            ) : (
                              <>
                                {/* View Details Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(machine);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View details"
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                {/* Archive Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmArchive(machine);
                                  }}
                                  disabled={
                                    archivingMachineId === machine.machineId
                                  }
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Archive machine"
                                >
                                  {archivingMachineId === machine.machineId ? (
                                    <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveModal && machineToArchive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Archive Machine?
                </h3>
                <p className="text-sm text-gray-500">
                  Machine will be hidden but can be restored
                </p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-orange-800">
                Are you sure you want to archive{" "}
                <span className="font-semibold">
                  {machineToArchive.machineId}
                </span>
                ?
              </p>
              <p className="text-xs text-orange-700 mt-2">
                The machine will be hidden from the active list but can be
                restored later. Historical data and batch records will be
                preserved.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setMachineToArchive(null);
                }}
                disabled={archivingMachineId === machineToArchive.machineId}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveMachine}
                disabled={archivingMachineId === machineToArchive.machineId}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {archivingMachineId === machineToArchive.machineId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Archiving...</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    <span>Archive Machine</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {showPermanentDeleteModal && machineToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Permanently Delete Machine?
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 font-semibold mb-2">
                ⚠️ WARNING: This will permanently delete:
              </p>
              <ul className="text-xs text-red-700 space-y-1 ml-4 list-disc">
                <li>{machineToDelete.batches?.length || 0} batch records</li>
                <li>All telemetry data</li>
                <li>All command logs</li>
                <li>All detection events</li>
                <li>User connections</li>
              </ul>
              <p className="text-xs text-red-700 mt-3 font-medium">
                This data cannot be recovered once deleted.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type{" "}
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                  {machineToDelete.machineId}
                </span>{" "}
                to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Enter machine ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPermanentDeleteModal(false);
                  setMachineToDelete(null);
                  setDeleteConfirmation("");
                }}
                disabled={deletingMachineId === machineToDelete.machineId}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={
                  deletingMachineId === machineToDelete.machineId ||
                  deleteConfirmation !== machineToDelete.machineId
                }
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingMachineId === machineToDelete.machineId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Machine Details Modal */}
      {showDetailsModal && selectedMachine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedMachine.machineId}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Status and Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${getStatusColor(selectedMachine.status)}`}
                    ></span>
                    <span className="text-lg font-semibold text-gray-900 capitalize">
                      {selectedMachine.status}
                    </span>
                  </div>
                  {selectedMachine.status === "offline" &&
                    selectedMachine.lastCommandAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Offline for{" "}
                        {getOfflineDuration(selectedMachine.lastCommandAt)}
                      </p>
                    )}
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Last Active</p>
                  <p
                    className="text-lg font-semibold text-gray-900"
                    title={
                      selectedMachine.lastCommandAt
                        ? new Date(
                            selectedMachine.lastCommandAt,
                          ).toLocaleString()
                        : "Never"
                    }
                  >
                    {getTimeAgo(
                      selectedMachine.lastCommandAt ||
                        selectedMachine.createdAt,
                    )}
                  </p>
                  {selectedMachine.lastCommandAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(selectedMachine.lastCommandAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Telemetry */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Telemetry Data
                </h4>
                {selectedMachine.lastTelemetry &&
                (selectedMachine.lastTelemetry.temperature !== undefined ||
                  selectedMachine.lastTelemetry.humidity !== undefined) ? (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedMachine.lastTelemetry.temperature !==
                      undefined && (
                      <div className="bg-orange-50 rounded-lg p-4">
                        <p className="text-sm text-orange-600 mb-1">
                          Temperature
                        </p>
                        <p className="text-2xl font-bold text-orange-700">
                          {selectedMachine.lastTelemetry.temperature}°C
                        </p>
                      </div>
                    )}
                    {selectedMachine.lastTelemetry.humidity !== undefined && (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-600 mb-1">Humidity</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {selectedMachine.lastTelemetry.humidity}%
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4">
                    No telemetry data available
                  </p>
                )}
              </div>

              {/* Connected Users */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Connected Users ({selectedMachine.userMachines?.length || 0})
                </h4>
                {selectedMachine.userMachines &&
                selectedMachine.userMachines.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedMachine.userMachines.map((userMachine, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {userMachine.user.email || "No email"}
                          </p>
                          <p className="text-sm text-gray-500">
                            Machine name: {userMachine.name || "Unnamed"}
                          </p>
                        </div>
                        {index === 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                            Primary
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4">
                    No users connected
                  </p>
                )}
              </div>

              {/* Batches */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Recent Batches ({selectedMachine.batches?.length || 0})
                </h4>
                {selectedMachine.batches &&
                selectedMachine.batches.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedMachine.batches.slice(0, 5).map((batch) => (
                      <div
                        key={batch.id}
                        onClick={() => {
                          setShowDetailsModal(false);
                          navigate(
                            `/batches?machineId=${encodeURIComponent(selectedMachine.machineId)}`,
                          );
                        }}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {batch.batchNumber}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(batch.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            batch.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : batch.status === "running"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </div>
                    ))}
                    {selectedMachine.batches.length > 5 && (
                      <p className="text-xs text-gray-500 text-center py-2">
                        + {selectedMachine.batches.length - 5} more batches
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4">No batches found</p>
                )}
              </div>

              {/* Machine Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Machine Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Machine ID:</span>
                    <span className="font-mono text-gray-900">
                      {selectedMachine.machineId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Registered:</span>
                    <span className="text-gray-900">
                      {new Date(selectedMachine.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Batches:</span>
                    <span className="text-gray-900">
                      {selectedMachine.batches?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  navigate(
                    `/batches?machineId=${encodeURIComponent(selectedMachine.machineId)}`,
                  );
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
              >
                <Package className="w-4 h-4" />
                View Batches
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
