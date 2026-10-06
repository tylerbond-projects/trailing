import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { connectSocket, disconnectSocket } from './socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const refresh = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const { user } = await api('/auth/me');
      setUser(user);
      connectSocket();
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = useCallback(({ token, user }) => {
    setToken(token);
    setUser(user);
    connectSocket();
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  useEffect(() => {
    window.addEventListener('trailing:logout', logout);
    return () => window.removeEventListener('trailing:logout', logout);
  }, [logout]);

  return <AuthContext.Provider value={{ user, setUser, loading, signIn, logout, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
