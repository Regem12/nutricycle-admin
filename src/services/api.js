import { auth } from "@/config/firebase";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Get Firebase ID token for authenticated requests
 */
async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return await user.getIdToken();
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    // Parse response body
    const data = await response
      .json()
      .catch(() => ({ message: response.statusText }));

    if (!response.ok) {
      // Create error with response details
      const errorMsg =
        data.error || data.message || `API Error: ${response.status}`;
      const error = new Error(errorMsg);
      error.response = {
        status: response.status,
        data: data,
      };
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error);
    throw error;
  }
}

// ============= ADMIN VERIFICATION =============
export const verifyAdmin = async () => {
  return apiRequest("/admin/verify");
};

// ============= USERS API =============
export const getUsers = async () => {
  return apiRequest("/admin/users");
};

export const createUser = async (userData) => {
  return apiRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify(userData),
  });
};

export const updateUser = async (userId, userData) => {
  return apiRequest(`/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });
};

export const deleteUser = async (userId) => {
  return apiRequest(`/admin/users/${userId}`, {
    method: "DELETE",
  });
};

export const sendPasswordResetLink = async (userId) => {
  return apiRequest(`/admin/users/${userId}/reset-password`, {
    method: "POST",
  });
};

export const setAdminClaim = async (userId, isAdmin) => {
  return apiRequest(`/admin/users/${userId}/admin-claim`, {
    method: "PATCH",
    body: JSON.stringify({ isAdmin }),
  });
};

// ============= MACHINES API =============
export const getMachines = async () => {
  return apiRequest("/machines");
};

// Admin endpoint: Get all machines in the system
export const getAllMachines = async (includeArchived = false) => {
  const params = includeArchived ? "?includeArchived=true" : "";
  return apiRequest(`/admin/machines${params}`);
};

export const getMachineById = async (machineId) => {
  return apiRequest(`/machines/${machineId}`);
};

export const createMachine = async (machineData) => {
  return apiRequest("/admin/machines", {
    method: "POST",
    body: JSON.stringify(machineData),
  });
};

export const updateMachine = async (machineId, machineData) => {
  return apiRequest(`/admin/machines/${machineId}`, {
    method: "PUT",
    body: JSON.stringify(machineData),
  });
};

export const archiveMachine = async (machineId) => {
  return apiRequest(`/admin/machines/${machineId}`, {
    method: "DELETE",
  });
};

// Alias for backward compatibility
export const deleteMachine = archiveMachine;

export const restoreMachine = async (machineId) => {
  return apiRequest(`/admin/machines/${machineId}/restore`, {
    method: "POST",
  });
};

export const permanentlyDeleteMachine = async (machineId) => {
  return apiRequest(`/admin/machines/${machineId}/permanent`, {
    method: "DELETE",
  });
};

export const getMachineStatus = async (machineId) => {
  return apiRequest(`/machines/${machineId}/status`);
};

// ============= BATCHES API =============
export const getBatches = async (machineId) => {
  const query = machineId ? `?machineId=${encodeURIComponent(machineId)}` : "";
  return apiRequest(`/batches${query}`);
};

export const getBatchById = async (batchId) => {
  return apiRequest(`/batches/${batchId}`);
};

export const createBatch = async (batchData) => {
  return apiRequest("/batches", {
    method: "POST",
    body: JSON.stringify(batchData),
  });
};

export const updateBatch = async (batchId, batchData) => {
  return apiRequest(`/batches/${batchId}`, {
    method: "PUT",
    body: JSON.stringify(batchData),
  });
};

export const deleteBatch = async (batchId) => {
  return apiRequest(`/batches/${batchId}`, {
    method: "DELETE",
  });
};

// ============= DETECTION EVENTS API =============
export const getDetectionEvents = async () => {
  return apiRequest("/detection");
};

export const getDetectionEventById = async (eventId) => {
  return apiRequest(`/detection/${eventId}`);
};

// ============= DASHBOARD STATS API =============
export const getDashboardStats = async () => {
  try {
    // Fetch all data in parallel
    const [users, machines, batches] = await Promise.all([
      getUsers().catch(() => ({ users: [] })),
      getMachines().catch(() => ({ machines: [] })),
      getBatches().catch(() => ({ batches: [] })),
    ]);

    // Calculate statistics
    const stats = {
      totalUsers: users.users?.length || 0,
      activeMachines:
        machines.machines?.filter((m) => m.status === "ONLINE").length || 0,
      activeBatches:
        batches.batches?.filter((b) => b.status === "PROCESSING").length || 0,
      recentDetections: 0, // Can be calculated from detection events if needed
    };

    return {
      stats,
      users: users.users || [],
      machines: machines.machines || [],
      batches: batches.batches || [],
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    throw error;
  }
};

export default {
  verifyAdmin,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  sendPasswordResetLink,
  getMachines,
  getMachineById,
  createMachine,
  updateMachine,
  deleteMachine,
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  getDetectionEvents,
  getDetectionEventById,
  getDashboardStats,
};
