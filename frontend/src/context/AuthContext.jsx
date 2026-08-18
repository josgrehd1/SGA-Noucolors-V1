import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';
import authApi from '../api/authApi';
import printApi from '../api/printApi';
import storage from '../utils/storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(storage.getUserSession());
  const [loading, setLoading] = useState(!storage.getUserSession());
  const [activePrinter, setActivePrinter] = useState(storage.getActivePrinter() || '');
  const [printersList, setPrintersList] = useState([]);

  useEffect(() => {
    checkSession();
  }, []);

  // 1. Screen Wake Lock para PDAs y móviles (mantiene la pantalla encendida mientras se usa la app)
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && user) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
          // Si el dispositivo o navegador no lo permite, continuar normalmente
        }
      }
    };

    requestWakeLock();

    // Re-adquirir Wake Lock y verificar sesión silenciosamente al desbloquear el móvil
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        authApi.getSession().then((res) => {
          if (res && res.authenticated) {
            setUser(res.user);
            storage.setUserSession(res.user);
          }
        }).catch(() => {
          // Si no hay conexión al despertar, no cerramos sesión
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [user]);

  // 2. Heartbeat periódico (Keep-Alive cada 3 min) para que la sesión de SAP / Flask nunca caduque por inactividad
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      authApi.getSession().catch(() => {});
    }, 180000);

    return () => clearInterval(interval);
  }, [user]);

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
        storage.setUserSession(res.user);
      } else {
        // Solo si el backend responde explícitamente que la sesión expiró
        setUser(null);
        storage.clearUserSession();
      }
    } catch (err) {
      // Si la petición falla por caída de Wi-Fi / red en almacén, NO cerramos sesión
      console.warn('[Offline Mode] No se pudo verificar la sesión por fallo de Wi-Fi temporal. Manteniendo sesión local activa.');
      const cached = storage.getUserSession();
      if (cached) {
        setUser(cached);
      }
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
      storage.setUserSession(loggedUser);

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
