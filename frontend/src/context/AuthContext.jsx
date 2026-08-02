import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../utils/client';
import storage from '../utils/storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePrinter, setActivePrinter] = useState(storage.getActivePrinter() || '');
  const [printersList, setPrintersList] = useState([]);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPrinters();
    }
  }, [user]);

  const checkSession = async () => {
    try {
      const res = await client.get('/auth/session');
      if (res && res.authenticated) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await client.get('/print/printers');
      if (res.status === 'ok') {
        const list = res.impresoras || [];
        setPrintersList(list);
        if (!activePrinter && list.length > 0) {
          const defaultKey = list[0].key;
          setActivePrinter(defaultKey);
          storage.setActivePrinter(defaultKey);
        }
      }
    } catch (err) {
      console.warn('No se pudieron cargar las impresoras Zebra:', err.message);
    }
  };

  const login = async (username, password, company_db) => {
    const res = await client.post('/auth/login', { username, password, company_db });
    if (res.status === 'ok') {
      const loggedUser = res.user || { username, company_db };
      setUser(loggedUser);
      return true;
    }
    throw new Error(res.message || 'Error de autenticación');
  };

  const logout = async () => {
    try {
      await client.post('/auth/logout');
    } catch (err) {
      console.warn('Error durante logout:', err);
    } finally {
      setUser(null);
      storage.clearUserSession();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        activePrinter,
        setActivePrinter,
        printersList,
        checkSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
