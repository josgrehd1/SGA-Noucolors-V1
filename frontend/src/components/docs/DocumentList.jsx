import React, { useState } from 'react';
import { Row, Col, Card, Tag, Button, Space, Typography, Empty, Spin } from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  ShopOutlined,
  CommentOutlined,
  InfoCircleOutlined,
  RightOutlined,
  UnorderedListOutlined,
  StopOutlined
} from '@ant-design/icons';

const { Text } = Typography;

export const DocumentList = ({ documents, loading, onOpenDetail, onDeactivateDocument }) => {
  const [expandedDoc, setExpandedDoc] = useState(null);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="Consultando documentos en SAP SQL Server..." />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px 0', marginTop: 16, borderRadius: 12 }}>
        <Empty description="No se encontraron documentos coincidentes en SAP" />
      </Card>
    );
  }

  const toggleExpand = (docEntry) => {
    setExpandedDoc(expandedDoc === docEntry ? null : docEntry);
  };

  return (
    <Row gutter={[16, 16]}>
      {documents.map((doc) => {
        const totalLineas = doc.LINEAS?.length || (doc.DocumentLines?.length || 0);
        const gestionadas = Number(doc.CUENTA_PREPARADO) || 0;
        const disponibles = Number(doc.CUENTA_DISPONIBLE) || 0;

        // Detección directa e infalible de stock en PDTE / Semi en cualquier línea del pedido
        const hasLineInPdteOrSemi = (doc.LINEAS || []).some(line => {
          const rawUbis = typeof line.UBICACIONES === 'string' ? line.UBICACIONES : JSON.stringify(line.UBICACIONES || '');
          const hasPdte = rawUbis.toUpperCase().includes('PDTE');
          const binStd = String(line.BIN_STD || line.BinStd || line.U_BinCode || '').toUpperCase();
          const isBinStdPdte = binStd.includes('PDTE');
          const ctdPrep = Number(line.CTD_PREPARADA || 0);

          return hasPdte || isBinStdPdte || ctdPrep > 0;
        });

        const isPurchase = String(doc.OBJTYPE || doc.ObjType) === '22';
        const isSemi = !isPurchase && (
                       Boolean(doc.IS_SEMI_PREPARADO) ||
                       hasLineInPdteOrSemi ||
                       (doc.SGA_PREPARADAS && doc.SGA_PREPARADAS.length > 0) ||
                       (gestionadas > 0 && gestionadas < totalLineas)
        );

        const isPrep = !isSemi && (Boolean(doc.IS_COMPLETAMENTE_PREPARADO) || (totalLineas > 0 && gestionadas >= totalLineas));
        const isSinStk = totalLineas > 0 && disponibles === 0 && gestionadas === 0 && !isSemi;
        const isStkParcial = totalLineas > 0 && disponibles > 0 && disponibles < totalLineas && gestionadas === 0 && !isSemi;

        let stateKey = 'disponible';
        if (isSemi) {
          stateKey = 'semi_preparado';
        } else if (isPrep) {
          stateKey = 'preparado';
        } else if (isSinStk) {
          stateKey = 'sin_stock';
        } else if (isStkParcial) {
          stateKey = 'stock_parcial';
        } else {
          stateKey = 'disponible';
        }

        const THEMES = {
          preparado: {
            borderTop: '#00bcd4', // Turquesa
            badgeBg: '#e0f7fa',
            badgeBorder: '#80deea',
            badgeColor: '#00838f',
            kpiBg: '#e0f7fa',
            kpiBorder: '#80deea',
            kpiColor: '#00838f',
            label: '🟢 Preparado',
            labelColor: '#00838f',
            labelBg: '#e0f7fa'
          },
          semi_preparado: {
            borderTop: '#f59e0b', // Amarillo / Ámbar
            badgeBg: '#fff8e1',
            badgeBorder: '#ffe082',
            badgeColor: '#b78103',
            kpiBg: '#fff8e1',
            kpiBorder: '#ffe082',
            kpiColor: '#b78103',
            label: '🟡 Semi-Prep',
            labelColor: '#b78103',
            labelBg: '#fff8e1'
          },
          stock_parcial: {
            borderTop: '#f97316', // Naranja
            badgeBg: '#fff7ed',
            badgeBorder: '#fed7aa',
            badgeColor: '#c2410c',
            kpiBg: '#fff7ed',
            kpiBorder: '#fed7aa',
            kpiColor: '#c2410c',
            label: `🟠 Parcial (${disponibles}/${totalLineas})`,
            labelColor: '#c2410c',
            labelBg: '#fff7ed'
          },
          sin_stock: {
            borderTop: '#ef4444', // Rojo
            badgeBg: '#fee2e2',
            badgeBorder: '#fca5a5',
            badgeColor: '#dc2626',
            kpiBg: '#fee2e2',
            kpiBorder: '#fca5a5',
            kpiColor: '#dc2626',
            label: '🔴 Sin Stock',
            labelColor: '#dc2626',
            labelBg: '#fee2e2'
          },
          disponible: {
            borderTop: '#0d6efd', // Azul
            badgeBg: '#e7f1ff',
            badgeBorder: '#9ec5fe',
            badgeColor: '#0d6efd',
            kpiBg: '#e0edff',
            kpiBorder: '#bae0ff',
            kpiColor: '#0d6efd',
            label: '🔵 Disponible',
            labelColor: '#0d6efd',
            labelBg: '#e7f1ff'
          }
        };

        const theme = THEMES[stateKey];

        const formattedDate = doc.DOCDATE ? String(doc.DOCDATE).split('T')[0] : '-';
        const whscode = doc.LINEAS?.[0]?.WHSCODE || '01';
        const isExpanded = expandedDoc === doc.DOCENTRY;

        return (
          <Col xs={24} sm={12} md={8} lg={8} key={doc.DOCENTRY}>
            <Card
              hoverable
              styles={{ body: { padding: '0 16px 16px 16px' } }}
              className="sga-doc-card-container"
              style={{
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 3px 10px rgba(0, 0, 0, 0.05)'
              }}
            >
              {/* Barra Superior Coloreada de Alto Contraste */}
              <div
                style={{
                  height: 6,
                  width: 'calc(100% + 32px)',
                  backgroundColor: theme.borderTop,
                  margin: '0 -16px 12px -16px'
                }}
              />

              <div>
                {/* 1. Fila de Encabezado: Nº Doc + Tag de Estado | Almacén | Fecha */}
                <div className="sga-doc-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        backgroundColor: theme.badgeBg,
                        border: `1px solid ${theme.badgeBorder}`,
                        color: theme.badgeColor,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        fontSize: '0.86rem',
                        padding: '2px 8px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <FileTextOutlined /> #{doc.DOCNUM || doc.DOCENTRY}
                    </span>

                    {/* Tag de Estado Explicativo */}
                    <span
                      style={{
                        backgroundColor: theme.labelBg,
                        border: `1px solid ${theme.badgeBorder}`,
                        color: theme.labelColor,
                        fontWeight: 800,
                        fontSize: '0.74rem',
                        padding: '2px 6px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {theme.label}
                    </span>
                  </div>

                  <Space size={6}>
                    <Tag style={{ borderRadius: 6, fontSize: '0.78rem', fontFamily: 'monospace', background: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <ShopOutlined style={{ marginRight: 3 }} /> {whscode}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      <CalendarOutlined style={{ marginRight: 3 }} />
                      {formattedDate}
                    </Text>
                  </Space>
                </div>

                {/* 2. Fila del Cliente + Bloque KPI (G / D / T) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#111827', fontSize: '0.95rem', lineHeight: 1.3 }} className="text-truncate">
                      <UserOutlined style={{ marginRight: 6, color: '#6b7280' }} />
                      {doc.CARDNAME || 'Cliente no especificado'}
                    </div>
                    {doc.CARDCODE && (
                      <Text type="secondary" style={{ fontSize: '0.78rem', fontFamily: 'monospace', display: 'block', marginTop: 2 }}>
                        {doc.CARDCODE}
                      </Text>
                    )}
                  </div>

                  {/* Bloque KPI: G (Gestionadas) / D (Disponibles) / T (Total) */}
                  <div
                    style={{
                      backgroundColor: theme.kpiBg,
                      border: `1px solid ${theme.kpiBorder}`,
                      borderRadius: 8,
                      padding: '3px 8px',
                      textAlign: 'center',
                      minWidth: 80,
                      flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        fontSize: '0.92rem',
                        color: theme.kpiColor,
                        display: 'flex',
                        justifyContent: 'space-around',
                        alignItems: 'center'
                      }}
                    >
                      <span>{gestionadas}</span>
                      <span style={{ opacity: 0.4, padding: '0 2px' }}>/</span>
                      <span>{disponibles}</span>
                      <span style={{ opacity: 0.4, padding: '0 2px' }}>/</span>
                      <span>{totalLineas}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        marginTop: 2
                      }}
                    >
                      <span style={{ flex: 1 }}>G</span>
                      <span style={{ flex: 1 }}>D</span>
                      <span style={{ flex: 1 }}>T</span>
                    </div>
                  </div>
                </div>

                {/* 3. Línea de Texto Especial del Pedido (si existe) */}
                {doc.PRIMERA_LINEA_TEXTO && (
                  <div
                    className="sga-doc-info-banner text-truncate"
                    title={doc.PRIMERA_LINEA_TEXTO}
                  >
                    <InfoCircleOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                    {doc.PRIMERA_LINEA_TEXTO}
                  </div>
                )}

                {/* 4. Comentarios del Pedido (si existen) */}
                {doc.COMMENTS && (
                  <div
                    className="sga-doc-comments-banner text-truncate"
                    title={doc.COMMENTS}
                  >
                    <CommentOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
                    {doc.COMMENTS}
                  </div>
                )}
              </div>

              {/* 4. Botonera Inferior */}
              <div>
                <div className="sga-doc-action-bar">
                  {/* Botón Gest. */}
                  <Button
                    type="default"
                    onClick={() => onOpenDetail(doc)}
                    className="sga-doc-btn-gest"
                  >
                    Gest. <RightOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>

                  {/* Botón ≡ Det. */}
                  <Button
                    type="default"
                    onClick={() => toggleExpand(doc.DOCENTRY)}
                    className="sga-doc-btn-det"
                  >
                    <UnorderedListOutlined /> Det.
                  </Button>

                  {/* Botón Desact. */}
                  <Button
                    type="default"
                    danger
                    onClick={() => onDeactivateDocument && onDeactivateDocument(doc)}
                    className="sga-doc-btn-deact"
                  >
                    Desact. <RightOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>
                </div>

                {/* Vista previa desplegable de líneas */}
                {isExpanded && (
                  <div className="sga-doc-preview-box">
                    <Text strong style={{ fontSize: '0.75rem', color: '#6c757d', display: 'block', marginBottom: 6 }}>
                      Vista Previa de Líneas ({totalLineas}):
                    </Text>
                    {doc.LINEAS && doc.LINEAS.length > 0 ? (
                      doc.LINEAS.map((l, lIdx) => (
                        <div
                          key={lIdx}
                          className="sga-doc-preview-row"
                          style={{ borderBottom: lIdx < doc.LINEAS.length - 1 ? '1px dashed #e2e8f0' : 'none' }}
                        >
                          <span style={{ fontWeight: 600, color: '#1f2937' }} className="text-truncate">
                            {l.ITEMCODE} - {l.ITEMNAME || 'Sin descripción'}
                          </span>
                          <Space size={4}>
                            <Tag color="cyan" style={{ fontSize: '0.68rem', borderRadius: 4, margin: 0 }}>
                              D
                            </Tag>
                            <Text strong style={{ fontSize: '0.75rem' }}>Ctd: {l.QUANTITY}</Text>
                          </Space>
                        </div>
                      ))
                    ) : (
                      <Text type="secondary" style={{ fontSize: '0.75rem' }}>Sin detalle de líneas</Text>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};
