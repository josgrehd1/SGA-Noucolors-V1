// Gestor de Caché LocalStorage para evitar sobrecargar la API de SAP / Backend

const STORAGE_KEYS = {
  ACTIVE_PRINTER: 'sga_active_printer',
  PRINTERS_LIST: 'sga_printers_list',
  ACTIVE_COMPANY: 'sga_active_company',
  USER_SESSION: 'sga_user_session',
  SEARCH_CACHE: 'sga_search_cache'
};

export const storage = {
  // Impresora activa seleccionada
  getActivePrinter: () => localStorage.getItem(STORAGE_KEYS.ACTIVE_PRINTER) || '',
  setActivePrinter: (printerIp) => localStorage.setItem(STORAGE_KEYS.ACTIVE_PRINTER, printerIp),

  // Lista de impresoras Zebra disponibles
  getPrintersList: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRINTERS_LIST);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setPrintersList: (printers) => localStorage.setItem(STORAGE_KEYS.PRINTERS_LIST, JSON.stringify(printers)),

  // Base de datos SAP activa
  getActiveCompany: () => localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY) || 'NOUCOLORS',
  setActiveCompany: (company) => localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY, company),

  // Sesión de usuario
  getUserSession: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setUserSession: (session) => localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(session)),

  // Limpiar sesión al cerrar
  clearUserSession: () => {
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
  }
};

export default storage;
