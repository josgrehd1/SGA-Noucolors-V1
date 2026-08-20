import React from 'react';
import { Card, Tag, Button, Row, Col, Typography, Space, message } from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  EyeOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import client from '../../utils/client';

const { Text } = Typography;

export const AlbaranList = ({ albaranes = [], onSelectAlbaran, loading }) => {
  if (!albaranes || albaranes.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px 16px', borderRadius: 12, border: '1px solid #dee2e6', marginTop: 16 }}>
        <FileTextOutlined style={{ fontSize: 40, color: '#6c757d', marginBottom: 12 }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#495057' }}>No se encontraron albaranes de entrega</div>
        <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>Pruebe a ajustar los filtros de número o cliente</div>
      </Card>
    );
  }

  const handlePrintPdf = async (e, docentry) => {
    e.stopPropagation();
    try {
      message.loading({ content: 'Enviando albarán a la impresora del servidor...', key: 'print_pdf' });
      const res = await client.post(`/albaranes/${docentry}/imprimir`);
      if (res.status === 'ok') {
        message.success({ content: res.message || 'Albarán enviado a la impresora', key: 'print_pdf' });
      } else {
        message.error({ content: res.message || 'Error al imprimir albarán', key: 'print_pdf' });
      }
    } catch (err) {
      message.error({ content: err.message || 'Error al conectar con el servicio de impresión', key: 'print_pdf' });
    }
  };

  return (
    <Row gutter={[16, 16]}>
      {albaranes.map((alb) => {
        const docentry = alb.DocEntry || alb.DOCENTRY;
        const docnum = alb.DocNum || alb.DOCNUM;
        const cardname = alb.CardName || alb.CARDNAME || 'Cliente no especificado';
        const cardcode = alb.CardCode || alb.CARDCODE || '';
        const docdate = alb.DocDate ? String(alb.DocDate).substring(0, 10) : '';
        const status = alb.DocumentStatus || alb.DOCUMENTSTATUS;
        const isOpen = status === 'bost_Open' || status === 'O';

        return (
          <Col xs={24} sm={12} lg={8} key={docentry || docnum}>
            <Card
              className="sga-alb-card"
              styles={{ body: { padding: 16 } }}
            >
              {/* 1. Cabecera de la Tarjeta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212529', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileTextOutlined style={{ color: '#0d6efd' }} />
                    Albarán #{docnum}
                  </div>
                  {cardcode && (
                    <Text type="secondary" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      CÓDIGO: {cardcode}
                    </Text>
                  )}
                </div>

                <Tag color={isOpen ? 'green' : 'default'} style={{ borderRadius: 6, fontWeight: 600 }}>
                  {isOpen ? 'Abierto' : 'Cerrado'}
                </Tag>
              </div>

              {/* 2. Información Central */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#343a40', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserOutlined style={{ color: '#6c757d' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cardname}
                  </span>
                </div>

                <Row gutter={8} style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarOutlined />
                      <span>{docdate}</span>
                    </div>
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color: '#495057' }}>
                      {alb.DocTotal ? `${alb.DocTotal} €` : ''}
                    </div>
                  </Col>
                </Row>
              </div>

              {/* 3. Acciones Inferiores Uniformes */}
              <div style={{ paddingTop: 10, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onSelectAlbaran(alb)}
                  className="sga-alb-btn-detail"
                  style={{ flex: 1, borderRadius: 6 }}
                >
                  Ver Detalle
                </Button>

                <Button
                  type="default"
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={(e) => handlePrintPdf(e, docentry)}
                  className="sga-alb-btn-print"
                  style={{ flex: 1, borderRadius: 6 }}
                  title="Enviar a impresora de red del servidor"
                >
                  Imprimir
                </Button>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

export default AlbaranList;
