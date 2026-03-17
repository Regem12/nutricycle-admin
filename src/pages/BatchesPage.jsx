import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Package,
  Search,
  Calendar,
  Cpu,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  Download,
  FilterX,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import DashboardHeader from "@/components/admin/DashboardHeader";
import { getBatches, deleteBatch } from "@/services/api";
import { auth } from "@/config/firebase";
import toast from "react-hot-toast";

// Pure utility — module-level to avoid re-creation on every render
const normalizeStatus = (status) => {
  if (!status) return "queued";
  const normalized = status.toLowerCase();
  if (normalized === "running" || normalized === "processing")
    return "processing";
  if (normalized === "idle") return "queued";
  if (normalized === "error") return "failed";
  return normalized; // completed, queued, failed
};

export default function BatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  // Pre-filter by machine when navigated from MachinesPage
  const [machineIdFilter, setMachineIdFilter] = useState(
    () => searchParams.get("machineId") || "",
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, status
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Delete a batch (only allowed for non-completed batches)
  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    try {
      setDeleting(true);
      await deleteBatch(selectedBatch.batchNumber);
      toast.success(`Batch ${selectedBatch.batchNumber} deleted`);
      setShowDeleteConfirm(false);
      setSelectedBatch(null);
      await fetchBatches();
    } catch (err) {
      console.error("Failed to delete batch:", err);
      toast.error(err.message || "Failed to delete batch");
    } finally {
      setDeleting(false);
    }
  };

  // Fetch batches from API
  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      const user = auth.currentUser;

      if (!user) {
        setError("Please log in to view batches");
        setBatches([]);
        setLoading(false);
        return;
      }

      const data = await getBatches();

      // Backend returns array directly
      if (Array.isArray(data)) {
        setBatches(data);
      } else {
        setBatches([]);
      }
    } catch (err) {
      console.error("Failed to fetch batches:", err);
      setError(err.message || "Failed to load batches");
      setBatches([]);
      toast.error("Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, []);

  // Export batches to CSV
  const exportToCSV = () => {
    try {
      const headers = [
        "Batch Number",
        "Machine ID",
        "Status",
        "Created",
        "Started",
        "Ended",
        "Duration",
        "Compost Output (kg)",
        "Feed Output (kg)",
      ];

      const rows = filteredBatches.map((batch) => [
        batch.batchNumber,
        batch.machine?.machineId || "N/A",
        normalizeStatus(batch.status),
        new Date(batch.createdAt).toLocaleString(),
        batch.startedAt ? new Date(batch.startedAt).toLocaleString() : "N/A",
        batch.endedAt ? new Date(batch.endedAt).toLocaleString() : "N/A",
        getDuration(batch.startedAt, batch.endedAt),
        batch.compostOutput || "N/A",
        batch.feedOutput || "N/A",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batches-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Batches exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export batches");
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setSortBy("newest");
    setMachineIdFilter("");
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    filterStatus !== "all" ||
    sortBy !== "newest" ||
    machineIdFilter !== "";

  // Fetch batches on component mount
  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Auto-refresh for active batches (every 10 seconds)
  // Uses fetchBatches from useCallback so the interval never captures a stale closure
  useEffect(() => {
    const hasActiveBatches = batches.some(
      (b) => b.status === "processing" || b.status === "running",
    );

    if (!hasActiveBatches) return;

    const interval = setInterval(fetchBatches, 10000);
    return () => clearInterval(interval);
  }, [batches, fetchBatches]);

  const filteredBatches = useMemo(() => {
    return batches
      .filter((batch) => {
        try {
          if (!batch) return false;

          const normalizedStatus = normalizeStatus(batch.status);
          const machineId =
            batch.machine?.machineId || batch.machineId || "N/A";
          const batchNumber = batch.batchNumber || "";

          // Search matching
          const matchesSearch =
            searchTerm === "" ||
            batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            machineId.toLowerCase().includes(searchTerm.toLowerCase());

          // Status filter matching
          const matchesFilter =
            filterStatus === "all" || normalizedStatus === filterStatus;

          // Machine filter matching (from URL ?machineId= param)
          const matchesMachine =
            machineIdFilter === "" ||
            machineId.toLowerCase() === machineIdFilter.toLowerCase();

          return matchesSearch && matchesFilter && matchesMachine;
        } catch (err) {
          console.error("Error filtering batch:", batch, err);
          return false;
        }
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return new Date(b.createdAt) - new Date(a.createdAt);
          case "oldest":
            return new Date(a.createdAt) - new Date(b.createdAt);
          case "status":
            return normalizeStatus(a.status).localeCompare(
              normalizeStatus(b.status),
            );
          default:
            return 0;
        }
      });
  }, [batches, searchTerm, filterStatus, sortBy, machineIdFilter]);

  // Paginate batches
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredBatches.slice(startIndex, endIndex);
  }, [filteredBatches, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortBy, machineIdFilter]);

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "queued":
        return "bg-yellow-100 text-yellow-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "processing":
        return <Clock className="w-4 h-4 animate-spin" />;
      case "queued":
        return <Clock className="w-4 h-4" />;
      case "failed":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return "Not started";
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getDuration = (start, end) => {
    if (!start || !end) return "In progress";
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffInMinutes = Math.floor((endDate - startDate) / 60000);

    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    return `${Math.floor(diffInMinutes / 60)}h ${diffInMinutes % 60}m`;
  };

  const completedCount = batches.filter(
    (b) => b && normalizeStatus(b.status) === "completed",
  ).length;
  const processingCount = batches.filter(
    (b) => b && normalizeStatus(b.status) === "processing",
  ).length;
  const queuedCount = batches.filter(
    (b) => b && normalizeStatus(b.status) === "queued",
  ).length;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <DashboardHeader
        title="Batches Management"
        subtitle="Track and manage processing batches"
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
                placeholder="Search by batch number or machine..."
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
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="queued">Queued</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">Sort by Status</option>
            </select>

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
            {/* Refresh Button - Icon Only */}
            <button
              onClick={fetchBatches}
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
              disabled={batches.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export batches to CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Machine filter banner */}
        {machineIdFilter && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Cpu className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700 flex-1">
              Showing batches for machine{" "}
              <span className="font-bold">{machineIdFilter}</span>
            </p>
            <button
              onClick={() => setMachineIdFilter("")}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
              title="Clear machine filter"
            >
              <X className="w-3.5 h-3.5 text-blue-600" />
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1 text-lg">
                Failed to load batches
              </h3>
              <p className="text-sm text-red-700 mb-3">{error}</p>
              <button
                onClick={fetchBatches}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Batches</p>
                <p className="text-2xl font-bold text-gray-900">
                  {batches.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {completedCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-gray-900">
                  {processingCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Queued</p>
                <p className="text-2xl font-bold text-gray-900">
                  {queuedCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Batches Table */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                <p className="text-gray-600 font-medium">Loading batches...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Batch Number
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Machine
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Output
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredBatches.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-6 py-12 text-center text-gray-500"
                        >
                          {batches.length === 0 ? (
                            <div className="flex flex-col items-center gap-3">
                              <Package className="w-12 h-12 text-gray-300" />
                              <div>
                                <p className="font-medium text-gray-900 mb-1">
                                  No batches yet
                                </p>
                                <p className="text-sm text-gray-500">
                                  Create your first batch to get started
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <Search className="w-12 h-12 text-gray-300" />
                              <div>
                                <p className="font-medium text-gray-900 mb-1">
                                  No batches found
                                </p>
                                <p className="text-sm text-gray-500">
                                  Try adjusting your search or filters
                                </p>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedBatches.map((batch) => (
                        <tr
                          key={batch.id}
                          onClick={() => setSelectedBatch(batch)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {batch.batchNumber}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(
                                    batch.createdAt,
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const mid =
                                  batch.machine?.machineId || batch.machineId;
                                if (mid)
                                  navigate(`/admin/machines?search=${mid}`);
                              }}
                              className="flex items-center gap-2 hover:text-green-600 transition-colors group"
                              title="View machine"
                            >
                              <Cpu className="w-4 h-4 text-gray-400 group-hover:text-green-500" />
                              <span className="text-sm font-medium text-gray-900 group-hover:underline">
                                {batch.machine?.machineId ||
                                  batch.machineId ||
                                  "N/A"}
                              </span>
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(normalizeStatus(batch.status))}`}
                            >
                              {getStatusIcon(normalizeStatus(batch.status))}
                              {normalizeStatus(batch.status)
                                .charAt(0)
                                .toUpperCase() +
                                normalizeStatus(batch.status).slice(1)}
                              {normalizeStatus(batch.status) ===
                                "processing" && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {batch.compostOutput !== null ? (
                              <div className="text-sm">
                                <p className="text-gray-900">
                                  🌱 Compost: {batch.compostOutput} kg
                                </p>
                                <p className="text-gray-600">
                                  🐔 Feed: {batch.feedOutput} kg
                                </p>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {getTimeAgo(batch.startedAt)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {getDuration(batch.startedAt, batch.endedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredBatches.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t-2 border-gray-200">
                  <div className="text-sm text-gray-600">
                    Showing{" "}
                    {Math.min(
                      (currentPage - 1) * itemsPerPage + 1,
                      filteredBatches.length,
                    )}{" "}
                    to{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredBatches.length,
                    )}{" "}
                    of {filteredBatches.length}{" "}
                    {filteredBatches.length === 1 ? "batch" : "batches"}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Previous</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1,
                        ).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === page
                                ? "bg-green-600 text-white"
                                : "border border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        <span className="text-sm font-medium">Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-2 border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Batch Details
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selectedBatch.batchNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-2 font-medium">
                    Batch Number
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedBatch.batchNumber}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-2 font-medium">
                    Machine
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedBatch.machine?.machineId ||
                      selectedBatch.machineId ||
                      "N/A"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-2 font-medium">
                    Status
                  </p>
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(normalizeStatus(selectedBatch.status))}`}
                  >
                    {getStatusIcon(normalizeStatus(selectedBatch.status))}
                    {normalizeStatus(selectedBatch.status)
                      .charAt(0)
                      .toUpperCase() +
                      normalizeStatus(selectedBatch.status).slice(1)}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-2 font-medium">
                    Feed Status
                  </p>
                  <p className="text-xl font-bold text-gray-900">
                    {selectedBatch.feedStatus || "pending"}
                  </p>
                </div>
                {selectedBatch.estimatedWeight && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 mb-2 font-medium">
                      Estimated Weight
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {selectedBatch.estimatedWeight} kg
                    </p>
                  </div>
                )}
              </div>

              {/* Environmental Data */}
              {(selectedBatch.temperature || selectedBatch.humidity) && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Environmental Data
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedBatch.temperature && (
                      <div className="bg-orange-50 rounded-lg p-4">
                        <p className="text-sm text-orange-600 mb-1">
                          Temperature
                        </p>
                        <p className="text-2xl font-bold text-orange-700">
                          {selectedBatch.temperature}°C
                        </p>
                      </div>
                    )}
                    {selectedBatch.humidity && (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-600 mb-1">Humidity</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {selectedBatch.humidity}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t-2 border-gray-200 pt-6">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-600" />
                  Timeline
                </h4>
                <div className="space-y-3 text-sm bg-gray-50 rounded-xl p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Created:</span>
                    <span className="text-gray-900 font-semibold">
                      {new Date(selectedBatch.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedBatch.startedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">
                        Started:
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {new Date(selectedBatch.startedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedBatch.endedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Ended:</span>
                      <span className="text-gray-900 font-semibold">
                        {new Date(selectedBatch.endedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Output */}
              {selectedBatch.compostOutput !== null && (
                <div className="border-t-2 border-gray-200 pt-6">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-600" />
                    Output
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border-2 border-green-200">
                      <p className="text-sm text-green-700 mb-2 font-semibold">
                        Compost Output
                      </p>
                      <p className="text-3xl font-bold text-green-800">
                        {selectedBatch.compostOutput} kg
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-5 border-2 border-yellow-200">
                      <p className="text-sm text-yellow-700 mb-2 font-semibold">
                        Feed Output
                      </p>
                      <p className="text-3xl font-bold text-yellow-800">
                        {selectedBatch.feedOutput} kg
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t-2 border-gray-200 flex-shrink-0">
              {/* Delete — only for non-completed batches */}
              {normalizeStatus(selectedBatch.status) !== "completed" ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-2 border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Batch
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setSelectedBatch(null)}
                className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Delete Batch?
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">
                You are about to permanently delete batch{" "}
                <span className="font-bold">{selectedBatch.batchNumber}</span>.
                All associated detection events will also be deleted.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBatch}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
