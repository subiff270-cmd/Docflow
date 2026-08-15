"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { syncUserWithBackend } from "../lib/api";

interface UserProfile {
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  total_conversions: number;
  period_usage: number;
  max_quota: number;
  max_file_size_mb: number;
  days_until_reset: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const data = await syncUserWithBackend(user.uid, user.email, user.displayName);
      setProfile(data);
    } catch (e) {
      console.error("Profile sync error:", e);
    }
  };

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (
        String(event.reason).includes("Database is closing") ||
        String(event.reason).includes("closing/hidden") ||
        String(event.reason).includes("IndexedDB")
      )) {
        event.preventDefault();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("unhandledrejection", handleUnhandledRejection);
    }

    try {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            const data = await syncUserWithBackend(currentUser.uid, currentUser.email, currentUser.displayName);
            setProfile(data);
          } catch (err) {
            console.error("Auth state profile error:", err);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("unhandledrejection", handleUnhandledRejection);
        }
        unsubscribe();
      };
    } catch (e) {
      setLoading(false);
    }
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
