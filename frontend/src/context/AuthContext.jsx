import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';
import authApi from '../api/authApi';
import printApi from '../api/printApi';
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
      fetchPrinters(user);
    }
  }, [user]);

  const checkSession = async () => {
    try {
      const res = await authApi.getSession();
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

  const fetchPrinters = async (currentUser) => {
    try {
      const res = await printApi.getPrinters();
      if (res.status === 'ok') {
        const list = res.impresoras || [];
        setPrintersList(list);

        const targetUser = currentUser || user;
        const targetPrinter = targetUser?.printer || storage.getActivePrinter() || activePrinter;

        if (targetPrinter) {
          const found = list.find((p) => p.key === targetPrinter || p.value === targetPrinter);
          if (found) {
            setActivePrinter(found.key);
            storage.setActivePrinter(found.key);
            return;
          }
        }

        // Si no tiene impresora asignada válida
        if (!targetPrinter) {
          setActivePrinter('');
          storage.setActivePrinter('');
        }
      }
    } catch (err) {
      console.warn('No se pudieron cargar las impresoras Zebra:', err.message);
    }
  };

  const login = async (username, password, company_db) => {
    const res = await authApi.login(username, password, company_db);
    if (res.status === 'ok') {
      const loggedUser = res.user || { username, company_db };
      setUser(loggedUser);

      const assignedPrinter = loggedUser.printer || storage.getActivePrinter() || '';
      if (!assignedPrinter) {
        setActivePrinter('');
        storage.setActivePrinter('');
        message.warning('No tienes impresora asignada');
      } else {
        setActivePrinter(assignedPrinter);
        storage.setActivePrinter(assignedPrinter);
      }
      return true;
    }
    throw new Error(res.message || 'Error de autenticación');
  };

  const logout = async () => {
    try {
      await authApi.logout();
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
