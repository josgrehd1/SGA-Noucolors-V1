import React, { useState } from 'react';
import { Row, Col, Card, Tag, Button, Space, Typography, Empty, Spin } from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  ShopOutlined,
  CommentOutlined,
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
        const totalLineas = doc.LINEAS?.length || 0;
        const gestionadas = doc.CUENTA_PREPARADO || 0;
        const disponibles = doc.CUENTA_DISPONIBLE || 0;

        let borderHeaderColor = '#1677ff'; // Primary blue

        if (disponibles === 0 && totalLineas > 0) {
          borderHeaderColor = '#ff4d4f'; // Danger red
        } else if (disponibles < totalLineas) {
          borderHeaderColor = '#faad14'; // Warning orange
        } else if (gestionadas > 0) {
          borderHeaderColor = '#13c2c2'; // Info cyan
        }

        const formattedDate = doc.DOCDATE ? String(doc.DOCDATE).split('T')[0] : '-';
        const whscode = doc.LINEAS?.[0]?.WHSCODE || '01';
        const isExpanded = expandedDoc === doc.DOCENTRY;

        return (
          <Col xs={24} sm={12} md={8} lg={8} key={doc.DOCENTRY}>
            <Card
              hoverable
              styles={{ body: { padding: 16 } }}
              style={{
                borderRadius: 14,
                border: '1px solid #f0f0f0',
                borderTop: `4px solid ${borderHeaderColor}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                {/* 1. Fila de Encabezado: Nº Doc | Almacén | Fecha */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Tag
                    color="blue"
                    style={{
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      fontSize: '0.88rem',
                      padding: '3px 10px',
                      borderRadius: 6
                    }}
                  >
                    <FileTextOutlined style={{ marginRight: 4 }} /> #{doc.DOCNUM || doc.DOCENTRY}
                  </Tag>

                  <Space size={6}>
                    <Tag style={{ borderRadius: 6, fontSize: '0.78rem', fontFamily: 'monospace' }}>
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
                    <div style={{ fontWeight: 800, color: '#1f2937', fontSize: '0.95rem', lineHeight: 1.3 }} className="text-truncate">
                      <UserOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
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
                      backgroundColor: '#e0edff',
                      border: '1px solid #bae0ff',
                      borderRadius: 10,
                      padding: '4px 10px',
                      textAlign: 'center',
                      minWidth: 85,
                      flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        fontSize: '0.92rem',
                        color: '#0d6efd',
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
                        color: '#6c757d',
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

                {/* 3. Comentarios del Pedido (si existen) */}
                {doc.COMMENTS && (
                  <div
                    style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: 8,
                      padding: '6px 10px',
                      marginBottom: 12,
                      fontSize: '0.8rem',
                      color: '#495057'
                    }}
                    className="text-truncate"
                    title={doc.COMMENTS}
                  >
                    <CommentOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
                    {doc.COMMENTS}
                  </div>
                )}
              </div>

              {/* 4. Botonera Inferior: Gest. → | ≡ Det. | Desact. → (Réplica Exacta Proyecto Original) */}
              <div>
                <div style={{ paddingTop: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6 }}>
                  {/* Botón Gest. */}
                  <Button
                    type="default"
                    onClick={() => onOpenDetail(doc)}
                    style={{
                      flex: 1,
                      borderColor: '#0d6efd',
                      color: '#0d6efd',
                      fontWeight: 700,
                      borderRadius: 6,
                      fontSize: '0.82rem',
                      padding: '0 4px'
                    }}
                  >
                    Gest. <RightOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>

                  {/* Botón ≡ Det. (Desplegar vista previa de líneas) */}
                  <Button
                    type="default"
                    onClick={() => toggleExpand(doc.DOCENTRY)}
                    style={{
                      flex: 1,
                      borderColor: '#6c757d',
                      color: '#495057',
                      fontWeight: 700,
                      borderRadius: 6,
                      fontSize: '0.82rem',
                      padding: '0 4px'
                    }}
                  >
                    <UnorderedListOutlined /> Det.
                  </Button>

                  {/* Botón Desact. */}
                  <Button
                    type="default"
                    danger
                    onClick={() => onDeactivateDocument && onDeactivateDocument(doc)}
                    style={{
                      flex: 1,
                      borderColor: '#dc3545',
                      color: '#dc3545',
                      fontWeight: 700,
                      borderRadius: 6,
                      fontSize: '0.82rem',
                      padding: '0 4px'
                    }}
                  >
                    Desact. <RightOutlined style={{ fontSize: '0.7rem' }} />
                  </Button>
                </div>

                {/* Vista previa desplegable de líneas si se pulsa "≡ Det." */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 10,
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '8px 10px'
                    }}
                  >
                    <Text strong style={{ fontSize: '0.75rem', color: '#6c757d', display: 'block', marginBottom: 6 }}>
                      Vista Previa de Líneas ({totalLineas}):
                    </Text>
                    {doc.LINEAS && doc.LINEAS.length > 0 ? (
                      doc.LINEAS.map((l, lIdx) => (
                        <div
                          key={lIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.78rem',
                            padding: '3px 0',
                            borderBottom: lIdx < doc.LINEAS.length - 1 ? '1px dashed #e2e8f0' : 'none'
                          }}
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
