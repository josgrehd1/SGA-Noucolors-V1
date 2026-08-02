import React from 'react';
import { Typography } from 'antd';
import { TransferForm } from '../components/transfer/TransferForm';

const { Title } = Typography;

export const TrasladoPage = () => {
  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 20 }}>
        Traslados Directos de Stock
      </Title>

      <TransferForm />
    </div>
  );
};
