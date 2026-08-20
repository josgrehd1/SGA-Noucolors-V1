import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';
import authApi from '../api/authApi';
import printApi from '../api/printApi';
import storage from '../utils/storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(storage.getUserSession());
  const [loading, setLoading] = useState(!storage.getUserSession());
  const [activePrinter, setActivePrinterState] = useState(storage.getActivePrinter() || '');
  const [activePdfPrinter, setActivePdfPrinterState] = useState(storage.getActivePdfPrinter() || '');
  const [printersList, setPrintersList] = useState([]);
  const [pdfPrintersList, setPdfPrintersList] = useState([]);
  const [testPrintEnabled, setTestPrintEnabledState] = useState(storage.getTestPrintEnabled());

  const setActivePrinter = (ip) => {
    setActivePrinterState(ip || '');
    storage.setActivePrinter(ip || '');
  };

  const setActivePdfPrinter = (ip) => {
    setActivePdfPrinterState(ip || '');
    storage.setActivePdfPrinter(ip || '');
  };

  const setTestPrintEnabled = (val) => {
    const isEnabled = Boolean(val);
    setTestPrintEnabledState(isEnabled);
    storage.setTestPrintEnabled(isEnabled);
    client.post('/print/test-toggle', { enabled: isEnabled }).catch(() => {});
    if (isEnabled) {
      message.success('🖨️ Impresiones ACTIVADAS en entorno TEST');
    } else {
      message.info('⏸️ Impresiones DESACTIVADAS en entorno TEST (Modo simulación)');
    }
  };

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
        const zebraList = res.zebra_printers || res.impresoras || [];
        const pdfList = res.pdf_printers || [];
        setPrintersList(zebraList);
        setPdfPrintersList(pdfList);

        const targetUser = currentUser || user;
        const targetPrinter = targetUser?.printer || storage.getActivePrinter() || activePrinter;

        if (targetPrinter) {
          const found = zebraList.find((p) => p.key === targetPrinter || p.value === targetPrinter || p.ip === targetPrinter);
          if (found) {
            setActivePrinter(found.key);
          }
        } else if (zebraList.length > 0 && !storage.getActivePrinter()) {
          // Asignar primera por defecto si no hay ninguna
          setActivePrinter(zebraList[0].key);
        }

        const targetPdfPrinter = storage.getActivePdfPrinter() || activePdfPrinter;
        if (targetPdfPrinter) {
          const foundPdf = pdfList.find((p) => p.key === targetPdfPrinter || p.value === targetPdfPrinter || p.ip === targetPdfPrinter);
          if (foundPdf) {
            setActivePdfPrinter(foundPdf.key);
          }
        } else if (pdfList.length > 0 && !storage.getActivePdfPrinter()) {
          // Asignar primera de albaranes por defecto si no hay ninguna
          setActivePdfPrinter(pdfList[0].key);
        }
      }
    } catch (err) {
      console.warn('No se pudieron cargar las impresoras:', err.message);
    }
  };

  const login = async (username, password, company_db) => {
    const res = await authApi.login(username, password, company_db);
    if (res.status === 'ok') {
      const loggedUser = res.user || { username, company_db };
      setUser(loggedUser);
      storage.setUserSession(loggedUser);

      const assignedPrinter = loggedUser.printer || storage.getActivePrinter() || '';
      if (assignedPrinter) {
        setActivePrinter(assignedPrinter);
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
        activePdfPrinter,
        setActivePdfPrinter,
        pdfPrintersList,
        fetchPrinters,
        checkSession,
        testPrintEnabled,
        setTestPrintEnabled
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
