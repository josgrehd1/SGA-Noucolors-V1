// Gestor de Caché LocalStorage para evitar sobrecargar la API de SAP / Backend

// Gestor de Caché LocalStorage para el SGA
const STORAGE_KEYS = {
  ACTIVE_PRINTER: 'sga_active_printer',
  USER_SESSION: 'sga_user_session'
};

export const storage = {
  // Impresora activa seleccionada
  getActivePrinter: () => localStorage.getItem(STORAGE_KEYS.ACTIVE_PRINTER) || '',
  setActivePrinter: (printerIp) => {
    if (printerIp) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PRINTER, printerIp);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PRINTER);
    }
  },

  // Sesión de usuario persistente
  getUserSession: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setUserSession: (user) => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    }
  },

  // Limpiar sesión al cerrar
  clearUserSession: () => {
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
  }
};

export default storage;
