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
      <div style={{ textAlign: 'center', padding: '40px 16px', backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #dee2e6' }}>
        <FileTextOutlined style={{ fontSize: 40, color: '#6c757d', marginBottom: 12 }} />
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#495057' }}>No se encontraron albaranes de entrega</div>
        <div style={{ fontSize: '0.85rem', color: '#6c757d' }}>Pruebe a ajustar los filtros de fecha o cliente</div>
      </div>
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
        const cardname = alb.CardName || alb.CARDNAME || 'Sin Cliente';
        const docdate = alb.DocDate ? String(alb.DocDate).substring(0, 10) : '';
        const doctotal = alb.DocTotal || alb.DOCTOTAL || 0;

        return (
          <Col xs={24} sm={12} lg={8} key={docentry}>
            <div className="sga-doc-card border-info p-3" style={{ cursor: 'pointer' }} onClick={() => onSelectAlbaran(alb)}>
              {/* Cabecera Tarjeta: Badge DocNum, Fecha */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span
                  style={{
                    backgroundColor: '#cff4fc',
                    color: '#055160',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontFamily: 'monospace'
                  }}
                >
                  <FileTextOutlined style={{ marginRight: 4 }} />
                  Albarán #{docnum}
                </span>

                <span style={{ fontSize: '0.75rem', color: '#6c757d', fontFamily: 'monospace' }}>
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  {docdate}
                </span>
              </div>

              {/* Nombre del Cliente */}
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#212529', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserOutlined style={{ color: '#6c757d' }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cardname}
                </span>
              </div>

              {/* Total y Botones PDF */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f8f9fa', paddingTop: 10 }}>
                <strong style={{ fontSize: '0.95rem', color: '#198754' }}>
                  {doctotal} €
                </strong>

                <Space size={4}>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={(e) => handleViewPdf(e, docentry)}
                    title="Ver PDF en navegador"
                  >
                    PDF
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PrinterOutlined />}
                    onClick={(e) => handlePrintPdf(e, docentry)}
                    style={{ backgroundColor: '#0d6efd', borderColor: '#0d6efd' }}
                    title="Imprimir PDF"
                  >
                    Imp PDF
                  </Button>
                </Space>
              </div>
            </div>
          </Col>
        );
      })}
    </Row>
  );
};
