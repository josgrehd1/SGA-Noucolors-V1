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
      message.loading({ content: 'Enviando albarán PDF a la impresora...', key: 'print_pdf' });
      const res = await client.post(`/albaranes/${docentry}/imprimir`);
      if (res.status === 'ok') {
        message.success({ content: res.message || 'Albarán PDF enviado a imprimir', key: 'print_pdf' });
      } else {
        message.error({ content: res.message || 'Error al imprimir albarán PDF', key: 'print_pdf' });
      }
    } catch (err) {
      message.error({ content: err.message || 'Error al conectar con el servicio de impresión PDF', key: 'print_pdf' });
    }
  };

  const handleViewPdf = (e, docentry) => {
    e.stopPropagation();
    window.open(`/api/albaranes/${docentry}/pdf`, '_blank');
  };

  return (
    <Row gutter={[16, 16]}>
      {albaranes.map((alb) => {
        const docentry = alb.DocEntry || alb.DOCENTRY;
        const docnum = alb.DocNum || alb.DOCNUM;
        const cardname = alb.CardName || alb.CARDNAME || 'Cliente no especificado';
        const cardcode = alb.CardCode || alb.CARDCODE || '';
        const docdate = alb.DocDate ? String(alb.DocDate).split('T')[0] : '-';
        const numLineas = alb.DocumentLines?.length || alb.LINEAS?.length || alb.LINE_COUNT || 0;

        return (
          <Col xs={24} sm={12} lg={8} key={docentry}>
            <Card
              hoverable
              styles={{ body: { padding: 18 } }}
              style={{
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                borderLeft: '4px solid #6c757d',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backgroundColor: '#ffffff'
              }}
            >
              <div>
                {/* 1. Header Tarjeta: Badge Albarán #DocNum */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Tag
                    style={{
                      backgroundColor: '#f8f9fa',
                      color: '#495057',
                      borderColor: '#dee2e6',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: '0.82rem',
                      padding: '3px 10px',
                      borderRadius: 6
                    }}
                  >
                    Albarán #{docnum}
                  </Tag>
                </div>

                {/* 2. Datos del Cliente y Fecha + Mini-KPI Líneas */}
                <Row align="middle" style={{ marginBottom: 12 }}>
                  <Col span={16}>
                    <div style={{ fontWeight: 800, color: '#1f2937', fontSize: '0.95rem', lineHeight: 1.3 }} className="text-truncate" title={cardname}>
                      {cardname}
                    </div>
                    {cardcode && (
                      <div style={{ fontSize: '0.78rem', color: '#6c757d', fontFamily: 'monospace', marginTop: 2 }}>
                        <UserOutlined style={{ marginRight: 4 }} />
                        {cardcode}
                      </div>
                    )}
                    <div style={{ fontSize: '0.78rem', color: '#6c757d', marginTop: 2 }}>
                      <CalendarOutlined style={{ marginRight: 4, color: '#0d6efd' }} />
                      {docdate}
                    </div>
                  </Col>

                  {/* Mini-KPI Líneas */}
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Líneas
                    </div>
                    <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.4rem', color: '#212529', lineHeight: 1.1 }}>
                      {numLineas}
                    </div>
                  </Col>
                </Row>
              </div>

              {/* 3. Acciones Inferiores (Detalle, Ver PDF, Imprimir) */}
              <div style={{ paddingTop: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6 }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onSelectAlbaran(alb)}
                  style={{
                    flex: 1,
                    backgroundColor: '#0d6efd',
                    borderColor: '#0d6efd',
                    fontWeight: 600,
                    borderRadius: 6,
                    height: 32
                  }}
                >
                  Detalle
                </Button>

                <Button
                  danger
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={(e) => handleViewPdf(e, docentry)}
                  style={{
                    flex: 1,
                    fontWeight: 600,
                    borderRadius: 6,
                    height: 32
                  }}
                >
                  Ver PDF
                </Button>

                <Button
                  type="default"
                  size="small"
                  icon={<PrinterOutlined />}
                  onClick={(e) => handlePrintPdf(e, docentry)}
                  style={{
                    flex: 1,
                    borderColor: '#6c757d',
                    color: '#495057',
                    fontWeight: 600,
                    borderRadius: 6,
                    height: 32
                  }}
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
