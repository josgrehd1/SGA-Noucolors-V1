import React from 'react';
import { Typography } from 'antd';
import { BinLabelPrinter } from '../components/labels/BinLabelPrinter';

const { Title } = Typography;

export const EtiquetasPage = () => {
  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 20 }}>
        Impresión de Etiquetas de Ubicación y Estanterías ZPL
      </Title>

      <BinLabelPrinter />
    </div>
  );
};
