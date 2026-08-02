import React from 'react';
import { Row, Col, Card, Empty, Spin } from 'antd';
import { StockCard } from './StockCard';

export const StockCardGrid = ({ items, loading, onOpenDetail, onOpenPrint }) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="Consultando stock en SAP SQL Server..." />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px 0', marginTop: 20 }}>
        <Empty description="No se encontraron productos coincidentes en el stock" />
      </Card>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {items.map((item) => (
        <Col key={item.ItemCode} xs={24} sm={12} md={8} lg={6} xl={6}>
          <StockCard
            item={item}
            onOpenDetail={onOpenDetail}
            onOpenPrint={onOpenPrint}
          />
        </Col>
      ))}
    </Row>
  );
};
