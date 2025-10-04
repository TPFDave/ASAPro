import React, { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    (async () => {
      await signOut();
      nav("/", { replace: true });
    })();
  }, [signOut, nav]);
  return <div className="p-6">Signing out…</div>;
}
