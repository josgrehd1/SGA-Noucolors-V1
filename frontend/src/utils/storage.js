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

  // Limpiar sesión al cerrar
  clearUserSession: () => {
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
  }
};

export default storage;
