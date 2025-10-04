import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { auth } from "../lib/firebase";

const AuthCtx = createContext({ user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signOut = async () => { await fbSignOut(auth); };

  return (
    <AuthCtx.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }
