import axios from 'axios';

// Cliente HTTP Axios configurado para comunicar el frontend React con la API Flask unificada
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Interceptor de peticiones para propagar el estado de impresión en TEST y las impresoras seleccionadas
client.interceptors.request.use((config) => {
  const testPrintEnabled = localStorage.getItem('sga_test_print_enabled');
  if (testPrintEnabled !== null) {
    config.headers['X-Test-Print-Enabled'] = testPrintEnabled;
  }
  const activePdf = localStorage.getItem('sga_active_pdf_printer');
  if (activePdf) {
    config.headers['X-Active-Pdf-Printer'] = activePdf;
  }
  const activeZebra = localStorage.getItem('sga_active_printer');
  if (activeZebra) {
    config.headers['X-Active-Printer'] = activeZebra;
  }
  return config;
});

// Interceptor para manejo unificado de respuestas y extracción de mensajes de error
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let errorMsg = error.response?.data?.message || error.message;
    if (!error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      errorMsg = 'Sin conexión con el servidor. Comprueba la señal Wi-Fi en almacén.';
    }
    return Promise.reject(new Error(errorMsg || 'Error en la petición a la API'));
  }
);

export default client;
