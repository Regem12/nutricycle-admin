import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  User,
  Search,
  Trash2,
  Mail,
  Calendar,
  Key,
  Copy,
  Check,
  Shield,
  ShieldOff,
  Loader2,
  RefreshCw,
  Ban,
  UserCheck,
  AlertTriangle,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import DashboardHeader from "@/components/admin/DashboardHeader";
import {
  sendPasswordResetLink,
  setAdminClaim,
  getUsers,
  deleteUser,
  updateUser,
  createUser,
} from "@/services/api";
import { auth } from "@/config/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import toast from "react-hot-toast";

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, active, disabled
  const [sortBy, setSortBy] = useState("email-asc"); // email-asc, newest, oldest, machines
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showResetLinkModal, setShowResetLinkModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showAdminConfirmModal, setShowAdminConfirmModal] = useState(false);
  const [showDisableConfirmModal, setShowDisableConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [userToToggleAdmin, setUserToToggleAdmin] = useState(null);
  const [userToToggleDisable, setUserToToggleDisable] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [resetLink, setResetLink] = useState("");
  const [resetLinkEmail, setResetLinkEmail] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingFor, setGeneratingFor] = useState(null); // Track which user is being processed
  const [togglingAdminFor, setTogglingAdminFor] = useState(null); // Track admin toggle in progress
  const [togglingDisableFor, setTogglingDisableFor] = useState(null); // Track disable toggle in progress
  const [deletingUserId, setDeletingUserId] = useState(null); // Track which user is being deleted

  // State for users data
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add User Modal States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState("");

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUsers();

      // Handle case where response doesn't have users property
      if (!response || !response.users) {
        throw new Error("Invalid API response: missing users data");
      }

      // Transform API data to match component expectations
      const transformedUsers = response.users.map((user) => ({
        id: user.uid,
        email: user.email || "No email",
        firebaseUid: user.uid,
        createdAt: user.metadata?.creationTime || new Date().toISOString(),
        machineCount: user.machineCount || 0, // Now using actual count from API
        isAdmin: user.customClaims?.admin === true,
        customClaims: user.customClaims || {},
        displayName: user.displayName,
        disabled: user.disabled,
        lastSignIn: user.metadata?.lastSignInTime,
      }));

      setUsers(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      const errorMsg =
        error.response?.data?.error || error.message || "Failed to load users";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = users.filter((user) => {
      if (!user.lastSignIn) return false;
      const lastSignIn = new Date(user.lastSignIn);
      lastSignIn.setHours(0, 0, 0, 0);
      return lastSignIn.getTime() === today.getTime();
    }).length;

    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    const newThisMonth = users.filter((user) => {
      const created = new Date(user.createdAt);
      return (
        created.getMonth() === thisMonth && created.getFullYear() === thisYear
      );
    }).length;

    return { activeToday, newThisMonth };
  }, [users]);

  // Filter users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter((user) => {
      const matchesSearch = user.email
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? !user.disabled
            : statusFilter === "disabled"
              ? user.disabled
              : true;
      return matchesSearch && matchesStatus;
    });

    // Sort users
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "email-asc":
          return a.email.localeCompare(b.email);
        case "newest":
          return new Date(b.createdAt) - new Date(a.createdAt);
        case "oldest":
          return new Date(a.createdAt) - new Date(b.createdAt);
        case "machines":
          return b.machineCount - a.machineCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [users, searchTerm, statusFilter, sortBy]);

  // Paginate users
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy]);

  const handleDeleteUser = async (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmPermanentDelete = async () => {
    if (!userToDelete || deletingUserId) return;

    try {
      setDeletingUserId(userToDelete.id);
      const loadingToast = toast.loading("Permanently deleting user...");

      await deleteUser(userToDelete.firebaseUid);
      toast.dismiss(loadingToast);

      // Remove user from state
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      toast.success("User permanently deleted!");
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    } catch (error) {
      toast.dismiss();
      console.error("Error deleting user:", error);

      if (
        error.response?.status === 400 &&
        error.response?.data?.error?.includes("own account")
      ) {
        toast.error("Cannot delete your own account");
      } else if (error.response?.status === 404) {
        toast.error("User not found");
      } else {
        toast.error(error.message || "Failed to delete user");
      }
    } finally {
      setDeletingUserId(null);
    }
  };

  const promptToggleDisable = (user) => {
    setUserToToggleDisable(user);
    setShowDisableConfirmModal(true);
  };

  const handleToggleDisable = async () => {
    const user = userToToggleDisable;
    if (!user || togglingDisableFor) {
      return;
    }

    // Close modal
    setShowDisableConfirmModal(false);

    const action = user.disabled ? "enable" : "disable";

    try {
      setTogglingDisableFor(user.id);
      const loadingToast = toast.loading(
        `${user.disabled ? "Enabling" : "Disabling"} account...`,
      );

      await updateUser(user.firebaseUid, {
        disabled: !user.disabled,
      });

      toast.dismiss(loadingToast);

      // Update user in state
      setUsers(
        users.map((u) =>
          u.id === user.id ? { ...u, disabled: !user.disabled } : u,
        ),
      );

      toast.success(
        `Account ${user.disabled ? "enabled" : "disabled"} successfully!`,
      );
    } catch (error) {
      toast.dismiss();
      toast.error(
        error.message || `Failed to ${action} account. Please try again.`,
      );
    } finally {
      setTogglingDisableFor(null);
      setUserToToggleDisable(null);
    }
  };

  const promptPasswordReset = (user) => {
    setUserToReset(user);
    setShowResetConfirmModal(true);
  };

  const handleSendPasswordReset = async () => {
    const user = userToReset;
    if (!user || generatingFor) return;

    // Close confirmation modal
    setShowResetConfirmModal(false);

    try {
      setGeneratingFor(user.id);
      const loadingToast = toast.loading("Generating reset link...");

      const response = await sendPasswordResetLink(user.firebaseUid);

      if (response.success) {
        setResetLink(response.resetLink);
        setResetLinkEmail(response.email);
        setLinkCopied(false);

        // Also send the actual reset email using Firebase (same as login page)
        let emailSent = false;
        try {
          await sendPasswordResetEmail(auth, response.email);
          emailSent = true;
          console.log(`Password reset email sent to ${response.email}`);
        } catch (emailError) {
          console.warn("Could not send reset email:", emailError);
        }

        setResetEmailSent(emailSent);
        setShowResetLinkModal(true);
        setUserToReset(null);

        toast.dismiss(loadingToast);
        toast.success(
          emailSent
            ? "Reset link generated & email sent!"
            : "Password reset link generated!",
        );
      } else {
        toast.dismiss(loadingToast);
        toast.error("Failed to generate reset link");
      }
    } catch (error) {
      toast.dismiss();

      // Handle specific error cases
      if (error.response?.status === 429) {
        toast.error(
          error.response.data.error ||
            "Too many requests. Please wait a few minutes.",
        );
      } else {
        toast.error(error.message || "Failed to generate reset link");
      }
    } finally {
      setGeneratingFor(null);
    }
  };

  const copyResetLink = () => {
    navigator.clipboard.writeText(resetLink);
    setLinkCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setLinkCopied(false), 3000);
  };

  const promptAdminToggle = (user) => {
    setUserToToggleAdmin(user);
    setShowAdminConfirmModal(true);
  };

  const handleToggleAdmin = async () => {
    const user = userToToggleAdmin;
    if (!user || togglingAdminFor) return;

    const isCurrentlyAdmin = user.customClaims?.admin === true;

    // Close confirmation modal
    setShowAdminConfirmModal(false);

    try {
      setTogglingAdminFor(user.id);
      const loadingToast = toast.loading(
        `${isCurrentlyAdmin ? "Revoking" : "Granting"} admin access...`,
      );

      const response = await setAdminClaim(user.firebaseUid, !isCurrentlyAdmin);
      toast.dismiss(loadingToast);

      if (response.success) {
        // Update user in state
        setUsers(
          users.map((u) =>
            u.id === user.id
              ? {
                  ...u,
                  customClaims: { admin: !isCurrentlyAdmin },
                  isAdmin: !isCurrentlyAdmin,
                }
              : u,
          ),
        );
        toast.success(
          `Admin access ${isCurrentlyAdmin ? "revoked" : "granted"}!`,
        );
      }
      setUserToToggleAdmin(null);
    } catch (error) {
      toast.dismiss();
      toast.error(
        error.message ||
          `Failed to ${isCurrentlyAdmin ? "revoke" : "grant"} admin access. Please try again.`,
      );
    } finally {
      setTogglingAdminFor(null);
    }
  };

  const validatePassword = (password) => {
    const requirements = {
      minLength: password.length >= 6,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*]/.test(password),
    };

    const isValid = Object.values(requirements).every((req) => req);
    return { requirements, isValid };
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateUserError("");

    // Validation
    if (!newUserEmail || !newUserPassword) {
      setCreateUserError("Email and password are required");
      return;
    }

    if (!newUserEmail.includes("@")) {
      setCreateUserError("Please enter a valid email address");
      return;
    }

    const passwordCheck = validatePassword(newUserPassword);
    if (!passwordCheck.isValid) {
      const missing = [];
      if (!passwordCheck.requirements.minLength) missing.push("6+ characters");
      if (!passwordCheck.requirements.hasUppercase)
        missing.push("uppercase letter");
      if (!passwordCheck.requirements.hasNumber) missing.push("number");
      if (!passwordCheck.requirements.hasSpecial)
        missing.push("special character (!@#$%^&*)");

      setCreateUserError(`Password must contain: ${missing.join(", ")}`);
      return;
    }

    try {
      setIsCreatingUser(true);
      const loadingToast = toast.loading("Creating user account...");

      const response = await createUser({
        email: newUserEmail,
        password: newUserPassword,
        isAdmin: newUserIsAdmin,
      });

      toast.dismiss(loadingToast);

      // Reset form
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserIsAdmin(false);
      setShowAddUserModal(false);

      // Refresh users list
      await fetchUsers();

      toast.success(
        `User account created successfully!${newUserIsAdmin ? " (Admin access granted)" : ""}`,
      );
    } catch (error) {
      toast.dismiss();
      console.error("Error creating user:", error);

      let errorMessage = "Failed to create user";

      if (error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData.error?.includes("already exists")) {
          errorMessage = "An account with this email already exists";
        } else if (errorData.error?.includes("Invalid email")) {
          errorMessage = "Invalid email address";
        } else if (errorData.error?.includes("Password")) {
          errorMessage = errorData.error;
        } else {
          errorMessage = errorData.error || errorMessage;
        }
      }

      setCreateUserError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const closeAddUserModal = () => {
    setShowAddUserModal(false);
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserIsAdmin(false);
    setCreateUserError("");
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <DashboardHeader
        title="Users Management"
        subtitle="Manage user accounts and access"
      />

      <div className="p-4 sm:p-8 space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white appearance-none cursor-pointer text-sm"
              >
                <option value="email-asc">Email A-Z</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="machines">Most Machines</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white appearance-none cursor-pointer text-sm"
              >
                <option value="all">All Users</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>

            {/* Refresh Button - Icon Only */}
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh users"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>

            {/* Add User Button */}
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add User</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-red-800 font-medium">Error loading users</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={fetchUsers}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.activeToday}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">New This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.newThisMonth}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Firebase UID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Machines
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Joined Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                        <p className="text-gray-600 font-medium">
                          Loading users...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      {searchTerm || statusFilter !== "all"
                        ? "No users found matching your filters"
                        : "No users found"}
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              user.disabled
                                ? "bg-gray-400"
                                : "bg-gradient-to-br from-green-500 to-emerald-600"
                            }`}
                          >
                            <span className="text-white font-semibold text-sm">
                              {user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p
                                className={`font-medium ${
                                  user.disabled
                                    ? "text-gray-500"
                                    : "text-gray-900"
                                }`}
                              >
                                {user.email}
                              </p>
                              {user.disabled && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                  <Ban className="w-3 h-3" />
                                  Disabled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center">
                          {user.customClaims?.admin ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              <Shield className="w-3.5 h-3.5" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              <User className="w-3.5 h-3.5" />
                              User
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span
                          className="text-sm text-gray-600 font-mono cursor-help"
                          title={user.firebaseUid}
                        >
                          {user.firebaseUid.substring(0, 12)}...
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                            user.machineCount === 0
                              ? "bg-gray-100 text-gray-600"
                              : "bg-blue-100 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {user.machineCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => promptAdminToggle(user)}
                            disabled={togglingAdminFor === user.id}
                            className={`p-2 rounded-lg transition-colors ${
                              togglingAdminFor === user.id
                                ? "text-gray-400 bg-gray-100 cursor-wait"
                                : user.customClaims?.admin
                                  ? "text-purple-600 hover:bg-purple-50"
                                  : "text-gray-600 hover:bg-gray-100"
                            }`}
                            title={
                              user.customClaims?.admin
                                ? "Revoke admin access"
                                : "Grant admin access"
                            }
                          >
                            {togglingAdminFor === user.id ? (
                              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                            ) : user.customClaims?.admin ? (
                              <ShieldOff className="w-4 h-4" />
                            ) : (
                              <Shield className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => promptPasswordReset(user)}
                            disabled={
                              generatingFor === user.id || user.disabled
                            }
                            className={`p-2 rounded-lg transition-colors ${
                              generatingFor === user.id || user.disabled
                                ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                                : "text-blue-600 hover:bg-blue-50"
                            }`}
                            title={
                              user.disabled
                                ? "Cannot reset password for disabled account"
                                : "Send password reset link"
                            }
                          >
                            {generatingFor === user.id ? (
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Key className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => promptToggleDisable(user)}
                            disabled={togglingDisableFor === user.id}
                            className={`p-2 rounded-lg transition-colors ${
                              togglingDisableFor === user.id
                                ? "text-gray-400 bg-gray-100 cursor-wait"
                                : user.disabled
                                  ? "text-green-600 hover:bg-green-50"
                                  : "text-orange-600 hover:bg-orange-50"
                            }`}
                            title={
                              user.disabled
                                ? "Enable account"
                                : "Disable account"
                            }
                          >
                            {togglingDisableFor === user.id ? (
                              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                            ) : user.disabled ? (
                              <UserCheck className="w-4 h-4" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUserId === user.id}
                            className={`p-2 rounded-lg transition-colors ${
                              deletingUserId === user.id
                                ? "text-gray-400 bg-gray-100 cursor-wait"
                                : "text-red-600 hover:bg-red-50"
                            }`}
                            title="Permanently delete user"
                          >
                            {deletingUserId === user.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredUsers.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing{" "}
                {Math.min(
                  (currentPage - 1) * itemsPerPage + 1,
                  filteredUsers.length,
                )}{" "}
                to {Math.min(currentPage * itemsPerPage, filteredUsers.length)}{" "}
                of {filteredUsers.length}{" "}
                {filteredUsers.length === 1 ? "user" : "users"}
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
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
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
                      ),
                    )}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
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
        </div>
      </div>

      {/* Admin Access Confirmation Modal */}
      {showAdminConfirmModal && userToToggleAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  userToToggleAdmin.customClaims?.admin
                    ? "bg-orange-100"
                    : "bg-purple-100"
                }`}
              >
                {userToToggleAdmin.customClaims?.admin ? (
                  <ShieldOff className="w-6 h-6 text-orange-600" />
                ) : (
                  <Shield className="w-6 h-6 text-purple-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {userToToggleAdmin.customClaims?.admin
                    ? "Revoke Admin Access?"
                    : "Grant Admin Access?"}
                </h3>
                <p className="text-gray-600 text-sm">
                  {userToToggleAdmin.customClaims?.admin
                    ? "Remove admin privileges from:"
                    : "Grant administrator privileges to:"}
                </p>
                <p className="font-semibold text-gray-900 mt-1">
                  {userToToggleAdmin.email}
                </p>
              </div>
            </div>

            <div
              className={`border rounded-lg p-3 mb-4 ${
                userToToggleAdmin.customClaims?.admin
                  ? "bg-orange-50 border-orange-200"
                  : "bg-purple-50 border-purple-200"
              }`}
            >
              <p
                className={`text-sm ${
                  userToToggleAdmin.customClaims?.admin
                    ? "text-orange-800"
                    : "text-purple-800"
                }`}
              >
                {userToToggleAdmin.customClaims?.admin
                  ? "This user will lose access to the admin panel and all management features."
                  : "This user will gain full access to the admin panel, including user management, machine control, and batch operations."}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAdminConfirmModal(false);
                  setUserToToggleAdmin(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleAdmin}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  userToToggleAdmin.customClaims?.admin
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
              >
                {userToToggleAdmin.customClaims?.admin
                  ? "Revoke Access"
                  : "Grant Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable/Enable Account Confirmation Modal */}
      {showDisableConfirmModal && userToToggleDisable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  userToToggleDisable.disabled
                    ? "bg-green-100"
                    : "bg-orange-100"
                }`}
              >
                {userToToggleDisable.disabled ? (
                  <UserCheck className="w-6 h-6 text-green-600" />
                ) : (
                  <Ban className="w-6 h-6 text-orange-600" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {userToToggleDisable.disabled
                    ? "Enable Account?"
                    : "Disable Account?"}
                </h3>
                <p className="text-gray-600 text-sm">
                  {userToToggleDisable.disabled
                    ? "Restore access for:"
                    : "Suspend access for:"}
                </p>
                <p className="font-semibold text-gray-900 mt-1">
                  {userToToggleDisable.email}
                </p>
              </div>
            </div>

            <div
              className={`border rounded-lg p-3 mb-4 ${
                userToToggleDisable.disabled
                  ? "bg-green-50 border-green-200"
                  : "bg-orange-50 border-orange-200"
              }`}
            >
              <p
                className={`text-sm ${
                  userToToggleDisable.disabled
                    ? "text-green-800"
                    : "text-orange-800"
                }`}
              >
                {userToToggleDisable.disabled
                  ? "This user will regain access to sign in and use their account."
                  : "⚠️ This user will be immediately logged out and cannot sign in until re-enabled. All data will be preserved."}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDisableConfirmModal(false);
                  setUserToToggleDisable(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleDisable}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                  userToToggleDisable.disabled
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-orange-600 hover:bg-orange-700 text-white"
                }`}
              >
                {userToToggleDisable.disabled
                  ? "Enable Account"
                  : "Disable Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Confirmation Modal */}
      {showResetConfirmModal && userToReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Send Password Reset Email?
                </h3>
                <p className="text-gray-600 text-sm">
                  This will send a password reset email to:
                </p>
                <p className="font-semibold text-gray-900 mt-1">
                  {userToReset.email}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                The user will receive an email with a secure link to reset their
                password.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowResetConfirmModal(false);
                  setUserToReset(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendPasswordReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {showDeleteConfirmModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Permanently Delete User?
                </h3>
                <p className="text-gray-600 text-sm">
                  You are about to permanently delete:
                </p>
                <p className="font-semibold text-gray-900 mt-1">
                  {userToDelete.email}
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800 font-medium mb-2">
                ⚠️ This action cannot be undone!
              </p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li>User data will be permanently deleted</li>
                <li>All associated machines will be unlinked</li>
                <li>User cannot be recovered</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">💡 Tip:</span> Consider using
                "Disable Account" instead to preserve data while preventing
                access.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPermanentDelete}
                disabled={deletingUserId === userToDelete?.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingUserId === userToDelete?.id
                  ? "Deleting..."
                  : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Create New User
                </h3>
                <p className="text-gray-600 text-sm">
                  Add a new user account to the system
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Error Message */}
              {createUserError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{createUserError}</p>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="user@example.com"
                  required
                  disabled={isCreatingUser}
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="e.g., SecurePass123!"
                  required
                  disabled={isCreatingUser}
                />

                {/* Password Requirements Checklist */}
                {newUserPassword && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      Password must contain:
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {validatePassword(newUserPassword).requirements
                          .minLength ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-red-500 font-bold text-xs">
                            ✕
                          </span>
                        )}
                        <span
                          className={`text-xs ${validatePassword(newUserPassword).requirements.minLength ? "text-green-700" : "text-gray-600"}`}
                        >
                          At least 6 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {validatePassword(newUserPassword).requirements
                          .hasUppercase ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-red-500 font-bold text-xs">
                            ✕
                          </span>
                        )}
                        <span
                          className={`text-xs ${validatePassword(newUserPassword).requirements.hasUppercase ? "text-green-700" : "text-gray-600"}`}
                        >
                          One uppercase letter (A-Z)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {validatePassword(newUserPassword).requirements
                          .hasNumber ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-red-500 font-bold text-xs">
                            ✕
                          </span>
                        )}
                        <span
                          className={`text-xs ${validatePassword(newUserPassword).requirements.hasNumber ? "text-green-700" : "text-gray-600"}`}
                        >
                          One number (0-9)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {validatePassword(newUserPassword).requirements
                          .hasSpecial ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <span className="w-3.5 h-3.5 text-red-500 font-bold text-xs">
                            ✕
                          </span>
                        )}
                        <span
                          className={`text-xs ${validatePassword(newUserPassword).requirements.hasSpecial ? "text-green-700" : "text-gray-600"}`}
                        >
                          One special character (!@#$%^&*)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  User can change this after first login via password reset
                </p>
              </div>

              {/* Admin Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={newUserIsAdmin}
                  onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                  className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  disabled={isCreatingUser}
                />
                <label htmlFor="isAdmin" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">
                      Grant Admin Access
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    User will have full admin privileges immediately
                  </p>
                </label>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">📧 Next step:</span> Use the
                  "Reset Password" action to send a password reset email to the
                  user, or share the temporary password securely.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeAddUserModal}
                  disabled={isCreatingUser}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Link Modal */}
      {showResetLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Password Reset Link Generated
                </h3>
                <p className="text-gray-600">
                  Share this link with{" "}
                  <span className="font-semibold">{resetLinkEmail}</span> to
                  reset their password.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Reset Link:
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 overflow-x-auto">
                  <code className="text-sm text-gray-900 break-all">
                    {resetLink}
                  </code>
                </div>
                <button
                  onClick={copyResetLink}
                  className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    linkCopied
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">⏱ Valid for 1 hour:</span> This
                link expires after 1 hour. Generate a new one if needed.
              </p>
            </div>

            {resetEmailSent ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-green-800">
                  <span className="font-semibold">✅ Email sent:</span> A
                  password reset email has been automatically sent to{" "}
                  <span className="font-semibold">{resetLinkEmail}</span>. You
                  can also share the link above manually.
                </p>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-orange-800">
                  <span className="font-semibold">
                    📋 Manual share required:
                  </span>{" "}
                  The email could not be sent automatically. Please copy and
                  share the link above with the user directly.
                </p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">🔒 Security Note:</span> For
                security, there's a limit on password reset requests per user.
                If you hit the limit, wait a few minutes before generating
                another link.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowResetLinkModal(false);
                  setResetLink("");
                  setResetLinkEmail("");
                  setResetEmailSent(false);
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
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
