import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { message, notification } from 'antd';

export const CLIENT_VERSION = "1.0.1";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Determinar la URL del servidor WebSocket (http://localhost:5000)
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : 'http://localhost:5000';

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    newSocket.on('connect', () => {
      console.log('[WebSocket] Conectado exitosamente al servidor SGA NouColors');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[WebSocket] Desconectado del servidor');
      setIsConnected(false);
    });

    // Control Automático de Versión en Tiempo Real
    newSocket.on('version_check', (data) => {
      const serverVersion = data?.version;
      console.log(`[Version Control] Versión Cliente: ${CLIENT_VERSION} | Versión Servidor: ${serverVersion}`);

      if (serverVersion && serverVersion !== CLIENT_VERSION) {
        notification.warning({
          message: '🔄 Actualización del Sistema Detectada',
          description: `Se ha desplegado una nueva versión de SGA NouColors (v${serverVersion}). El sistema se actualizará automáticamente en 2 segundos...`,
          duration: 4,
          placement: 'topRight'
        });

        setTimeout(() => {
          window.location.reload(true);
        }, 2000);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, clientVersion: CLIENT_VERSION }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
