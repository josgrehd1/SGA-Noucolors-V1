import axios from 'axios';

// Cliente HTTP Axios configurado para comunicar el frontend React con la API Flask unificada
const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Interceptor para manejo unificado de respuestas y extracción de mensajes de error
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMsg = error.response?.data?.message || error.message || 'Error en la petición a la API';
    return Promise.reject(new Error(errorMsg));
  }
);

export default client;
