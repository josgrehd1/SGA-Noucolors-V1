import React, { useState, useEffect } from 'react';
import { Modal, Card, Tag, Typography, Button, Spin, Row, Col, Space, message } from 'antd';
import { PrinterOutlined, EyeOutlined, BoxPlotOutlined } from '@ant-design/icons';
import client from '../../utils/client';

const { Title, Text } = Typography;

export const AlbaranDetailModal = ({ docEntry, open, onClose }) => {
  const [albaran, setAlbaran] = useState(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (docEntry && open) {
      fetchDetalle(docEntry);
    } else {
      setAlbaran(null);
    }
  }, [docEntry, open]);

  const fetchDetalle = async (id) => {
    setLoading(true);
    try {
      const res = await client.get(`/albaranes/${id}`);
      if (res.status === 'ok') {
        setAlbaran(res.albaran);
      } else {
        message.error(res.message || 'No se pudieron cargar los detalles del albarán');
      }
    } catch (err) {
      message.error(err.message || 'Error consultando albarán en SAP');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!docEntry) return;
    setPrinting(true);
    try {
      const res = await client.post(`/albaranes/${docEntry}/imprimir`);
      if (res.status === 'ok') {
        message.success(res.message || 'Albarán PDF enviado a la impresora');
      } else {
        message.error(res.message || 'Error imprimiendo albarán');
      }
    } catch (err) {
      message.error(err.message || 'Error en la petición de impresión PDF');
    } finally {
      setPrinting(false);
    }
  };

  const handleViewPdf = () => {
    if (docEntry) {
      window.open(`/api/albaranes/${docEntry}/pdf`, '_blank');
    }
  };

  if (!open) return null;

  const lineas = albaran?.DocumentLines || [];

  return (
    <Modal
      title={
        albaran ? (
          <div>
            <Title level={4} style={{ margin: 0 }}>Albarán de Entrega #{albaran.DocNum}</Title>
            <Text type="secondary">{albaran.CardName} ({albaran.CardCode})</Text>
          </div>
        ) : 'Detalle de Albarán'
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="close" onClick={onClose} style={{ borderRadius: 6 }}>
          Cerrar
        </Button>,
        <Button key="viewpdf" icon={<EyeOutlined />} onClick={handleViewPdf} style={{ borderRadius: 6 }}>
          Ver PDF
        </Button>,
        <Button
          key="printpdf"
          type="primary"
          icon={<PrinterOutlined />}
          loading={printing}
          onClick={handlePrintPdf}
          style={{ backgroundColor: '#0d6efd', borderColor: '#0d6efd', borderRadius: 6 }}
        >
          Imprimir PDF
        </Button>
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Cargando detalles de albarán..." />
        </div>
      ) : albaran ? (
        <div>
          <div className="sga-alb-detail-banner">
            <Row justify="space-between" align="middle" gutter={[8, 8]}>
              <Col>
                <Text strong style={{ fontSize: '0.85rem' }}>Fecha: </Text>
                <Text style={{ fontSize: '0.85rem' }}>{albaran.DocDate ? String(albaran.DocDate).substring(0, 10) : ''}</Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: '0.85rem' }}>Estado: </Text>
                <Tag color={albaran.DocumentStatus === 'bost_Open' ? 'green' : 'gray'} style={{ borderRadius: 6 }}>
                  {albaran.DocumentStatus === 'bost_Open' ? 'Abierto' : 'Cerrado'}
                </Tag>
              </Col>
              <Col>
                <Text strong style={{ fontSize: '0.85rem' }}>Total: </Text>
                <Tag color="blue" style={{ fontWeight: 700, borderRadius: 6 }}>{albaran.DocTotal} €</Tag>
              </Col>
            </Row>
          </div>

          <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
            <Row gutter={[12, 12]}>
              {lineas.map((line, idx) => (
                <Col span={24} key={`${line.ItemCode}_${idx}`}>
                  <Card
                    styles={{ body: { padding: 14 } }}
                    className="sga-alb-detail-card"
                  >
                    <Row justify="space-between" align="middle" gutter={[8, 8]}>
                      <Col xs={24} sm={16}>
                        <Space direction="vertical" size={2}>
                          <div className="sga-alb-detail-item-title">
                            <BoxPlotOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                            {line.ItemCode}
                          </div>
                          <Text type="secondary" style={{ fontSize: '0.85rem' }}>
                            {line.ItemDescription || 'Sin descripción'}
                          </Text>
                        </Space>
                      </Col>

                      <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
                        <Tag color="cyan" className="sga-alb-detail-qty-tag">
                          Entregada: {line.Quantity} u.
                        </Tag>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 20 }}>No hay datos disponibles</div>
      )}
    </Modal>
  );
};
