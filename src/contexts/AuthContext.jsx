import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getIdTokenResult,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
} from "firebase/auth";
import { auth } from "@/config/firebase";

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authDisabled, setAuthDisabled] = useState(null); // null = checking, true/false = result

  // Check if auth is disabled on mount (only once)
  useEffect(() => {
    const checkAuthDisabled = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${API_URL}/admin/verify`, {
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        });

        clearTimeout(timeoutId);
        setAuthDisabled(response.ok);
      } catch (error) {
        // Timeout or error - assume auth is enabled (safer default)
        console.debug("Auth disabled check error:", error.message);
        setAuthDisabled(false);
      }
    };

    checkAuthDisabled();
  }, []);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (firebaseUser) {
        // Retry getting token with admin claim (handles token refresh delay)
        let tokenResult;
        let hasAdminClaim = false;

        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          try {
            tokenResult = await getIdTokenResult(firebaseUser, true);
            if (tokenResult.claims.admin === true) {
              hasAdminClaim = true;
              break;
            }
          } catch (error) {
            console.error("Error getting token:", error);
          }
        }

        if (hasAdminClaim) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || "Admin User",
          });
        } else {
          // No admin claim - sign out
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      // Just sign in - let onAuthStateChanged handle validation
      await signInWithEmailAndPassword(auth, email, password);

      // Return success immediately
      // Navigation will happen when user state updates
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);

      // Handle specific Firebase errors
      let errorMessage = "Login failed. Please try again.";

      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-credential"
      ) {
        errorMessage =
          "No account found with this email. Click 'Create Account' below to sign up first.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage =
          "This account has been disabled. Please contact support.";
      }

      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const register = async (email, password) => {
    try {
      const _userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      await signOut(auth);
      return {
        success: false,
        error: "Account created. Ask an admin to grant access, then sign in.",
      };
    } catch (error) {
      console.error("Registration error:", error);

      let errorMessage = "Registration failed. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Account already exists. Please sign in instead.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters.";
      } else if (error.code === "auth/password-does-not-meet-requirements") {
        errorMessage =
          "Password must contain: uppercase letter, number, and special character (!@#$%^&*).";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage =
          "Account creation is temporarily disabled. Please contact support.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      }

      return { success: false, error: errorMessage };
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email, {
        // After password reset completion, return user to admin app
        url: "https://nutricycle-admin.vercel.app/",
      });
      return { success: true };
    } catch (error) {
      console.error("Password reset error:", error);

      let errorMessage = "Failed to send password reset email.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage =
          "Too many password reset attempts. Please wait a few minutes and try again.";
      } else if (error.code === "auth/quota-exceeded") {
        errorMessage = "Password reset quota exceeded. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      return { success: false, error: errorMessage };
    }
  };

  const verifyResetCode = async (code) => {
    try {
      // Verify the password reset code and get the user's email
      const email = await verifyPasswordResetCode(auth, code);
      return email;
    } catch (error) {
      console.error("Verify reset code error:", error);

      let errorMessage = "Invalid or expired reset code.";

      if (error.code === "auth/invalid-action-code") {
        errorMessage = "This reset link is invalid or has already been used.";
      } else if (error.code === "auth/expired-action-code") {
        errorMessage = "This reset link has expired. Please request a new one.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "User account not found.";
      }

      throw new Error(errorMessage);
    }
  };

  const confirmPasswordReset = async (code, newPassword) => {
    try {
      // Confirm the password reset with the code and new password
      await firebaseConfirmPasswordReset(auth, code, newPassword);
      return { success: true };
    } catch (error) {
      console.error("Confirm password reset error:", error);

      let errorMessage = "Failed to reset password.";

      if (error.code === "auth/invalid-action-code") {
        errorMessage = "This reset link is invalid or has already been used.";
      } else if (error.code === "auth/expired-action-code") {
        errorMessage = "This reset link has expired. Please request a new one.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (error.code === "auth/password-does-not-meet-requirements") {
        errorMessage =
          "Password must contain: uppercase letter, number, and special character (!@#$%^&*).";
      }

      throw new Error(errorMessage);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    resetPassword,
    verifyResetCode,
    confirmPasswordReset,
    authDisabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
