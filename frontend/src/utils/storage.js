// Gestor de Caché LocalStorage para evitar sobrecargar la API de SAP / Backend

// Gestor de Caché LocalStorage para el SGA
const STORAGE_KEYS = {
  ACTIVE_PRINTER: 'sga_active_printer',
  ACTIVE_PDF_PRINTER: 'sga_active_pdf_printer',
  USER_SESSION: 'sga_user_session'
};

export const storage = {
  // Impresora de etiquetas Zebra activa seleccionada (por IP)
  getActivePrinter: () => localStorage.getItem(STORAGE_KEYS.ACTIVE_PRINTER) || '',
  setActivePrinter: (printerIp) => {
    if (printerIp) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PRINTER, printerIp);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PRINTER);
    }
  },

  // Impresora de albaranes / documentos PDF activa seleccionada (por IP)
  getActivePdfPrinter: () => localStorage.getItem(STORAGE_KEYS.ACTIVE_PDF_PRINTER) || '',
  setActivePdfPrinter: (printerIp) => {
    if (printerIp) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PDF_PRINTER, printerIp);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PDF_PRINTER);
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
  },

  // Control de impresión en entorno TEST (por defecto: desactivada para no gastar papel)
  getTestPrintEnabled: () => {
    const val = localStorage.getItem('sga_test_print_enabled');
    return val === null ? false : val === 'true';
  },
  setTestPrintEnabled: (enabled) => {
    localStorage.setItem('sga_test_print_enabled', String(Boolean(enabled)));
  }
};

export default storage;
