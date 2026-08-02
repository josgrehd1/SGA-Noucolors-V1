import React from 'react';
import { Tag } from 'antd';

export const StatusBadge = ({ status }) => {
  let color = 'default';
  let label = status || 'Pendiente';

  switch (String(status).toUpperCase()) {
    case 'O':
    case 'OPEN':
      color = 'processing';
      label = 'Abierto';
      break;
    case 'C':
    case 'CLOSED':
      color = 'success';
      label = 'Cerrado / Preparado';
      break;
    case 'SEMI':
      color = 'warning';
      label = 'Semi Preparado';
      break;
    case 'CANCELLED':
      color = 'error';
      label = 'Cancelado';
      break;
    default:
      break;
  }

  return <Tag color={color} style={{ fontWeight: 600 }}>{label}</Tag>;
};
