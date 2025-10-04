import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}
