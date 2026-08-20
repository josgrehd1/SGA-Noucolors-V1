import React, { useState } from 'react';
import { Row, Col, Card, Tag, Button, Space, Typography, Empty, Spin, Tooltip, Modal } from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  ShopOutlined,
  CommentOutlined,
  InfoCircleOutlined,
  RightOutlined,
  UnorderedListOutlined,
  StopOutlined,
  CheckOutlined
} from '@ant-design/icons';

const { Text } = Typography;

export const DocumentList = ({ documents, loading, onOpenDetail, onDeactivateDocument, isInactiveView }) => {
  const [expandedDoc, setExpandedDoc] = useState(null);

  const handleToggleActiveConfirm = (doc) => {
    const isActivar = Boolean(isInactiveView || doc.U_Estado === 'I');
    const docNum = doc.DOCNUM || doc.DOCENTRY;

    Modal.confirm({
      title: isActivar ? '¿Confirmar activación de pedido?' : '¿Confirmar desactivación de pedido?',
      content: isActivar
        ? `¿Estás seguro de que deseas reactivar el pedido #${docNum}? Volverá a aparecer en la lista de pedidos activos.`
        : `¿Estás seguro de que deseas desactivar el pedido #${docNum}? Se moverá a la sección de pedidos inactivos.`,
      okText: isActivar ? 'Sí, Activar' : 'Sí, Desactivar',
      okType: isActivar ? 'primary' : 'danger',
      cancelText: 'Cancelar',
      okButtonProps: isActivar
        ? { style: { backgroundColor: '#198754', borderColor: '#198754', fontWeight: 700 } }
        : { danger: true, style: { fontWeight: 700 } },
      onOk: () => onDeactivateDocument && onDeactivateDocument(doc)
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 12, color: '#64748b', fontSize: '0.9rem' }}>
          Consultando documentos en SAP SQL Server...
        </div>
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
        const totalLineas = Array.isArray(doc.LINEAS) ? doc.LINEAS.length : 0;
        const gestionadas = Number(doc.CUENTA_PREPARADO) || 0;
        const disponibles = Number(doc.CUENTA_DISPONIBLE) || 0;

        // Detección de stock en PDTE / Semi en cualquier línea del pedido (puede ser de otro pedido)
        const hasLineInPdteOrSemi = (doc.LINEAS || []).some(line => {
          const rawUbis = typeof line.UBICACIONES === 'string' ? line.UBICACIONES : JSON.stringify(line.UBICACIONES || '');
          const hasPdte = rawUbis.toUpperCase().includes('PDTE');
          const binStd = String(line.BIN_STD || line.BinStd || line.U_BinCode || '').toUpperCase();
          const isBinStdPdte = binStd.includes('PDTE');
          const ctdPrep = Number(line.CTD_PREPARADA || 0);
          return hasPdte || isBinStdPdte || ctdPrep > 0;
        });

        const objTypeStr = String(doc.OBJTYPE || doc.ObjType || '17');
        const isSales = objTypeStr === '17';
        const isSalesReturn = objTypeStr === '234000031';
        const isPurchase = objTypeStr === '22';
        const isPurchaseReturn = objTypeStr === '234000032';
        const isTransfer = objTypeStr === '1250000001' || objTypeStr === '67';
        const isReturn = isSalesReturn || isPurchaseReturn;
        const isInbound = isPurchase || isSalesReturn;

        // Semi-prep PROPIO: NC_SGAWEB_DOCS tiene registros para ESTE pedido concreto (solo ventas o con avance previo)
        const isSemiPropio = (
          Boolean(doc.IS_SEMI_PREPARADO) ||
          (doc.SGA_PREPARADAS && doc.SGA_PREPARADAS.length > 0) ||
          (gestionadas > 0 && gestionadas < totalLineas)
        );

        // Stock en PDTE AJENO: el artículo está en zona PDTE pero fue semipreparado para otro pedido (solo ventas)
        const isSemiAjeno = isSales && !isSemiPropio && hasLineInPdteOrSemi;

        const isSemi = isSemiPropio || isSemiAjeno;

        const isPrep = !isSemi && (Boolean(doc.IS_COMPLETAMENTE_PREPARADO) || (totalLineas > 0 && gestionadas >= totalLineas));
        const isSinStk = isSales && totalLineas > 0 && disponibles === 0 && gestionadas === 0 && !isSemi;
        const isStkParcial = isSales && totalLineas > 0 && disponibles > 0 && disponibles < totalLineas && gestionadas === 0 && !isSemi;

        const canManage = !isSales || isSemi || gestionadas > 0 || disponibles > 0;
        const isInactive = Boolean(isInactiveView || doc.U_Estado === 'I');

        let stateKey = 'disponible';
        if (isSemiPropio) {
          stateKey = 'semi_preparado';
        } else if (isSemiAjeno) {
          stateKey = 'stock_pdte_ajeno';
        } else if (isPrep) {
          stateKey = 'preparado';
        } else if (isReturn) {
          stateKey = 'devolucion';
        } else if (isSinStk) {
          stateKey = 'sin_stock';
        } else if (isStkParcial) {
          stateKey = 'stock_parcial';
        } else {
          stateKey = 'disponible';
        }

        const THEMES = {
          devolucion: {
            borderTop: '#0d6efd', // Azul
            badgeBg: '#e7f1ff',
            badgeBorder: '#9ec5fe',
            badgeColor: '#0d6efd',
            kpiBg: '#e0edff',
            kpiBorder: '#bae0ff',
            kpiColor: '#0d6efd',
            label: isSalesReturn ? '📥 Devolución Venta' : '📤 Devolución Compra',
            labelColor: '#0d6efd',
            labelBg: '#e7f1ff'
          },
          preparado: {
            borderTop: '#00bcd4', // Turquesa
            badgeBg: '#e0f7fa',
            badgeBorder: '#80deea',
            badgeColor: '#00838f',
            kpiBg: '#e0f7fa',
            kpiBorder: '#80deea',
            kpiColor: '#00838f',
            label: isInbound ? '🟢 Recepcionado' : '🟢 Preparado',
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
            label: isTransfer ? '🔄 Solicitud Traslado' : '🔵 Disponible',
            labelColor: '#0d6efd',
            labelBg: '#e7f1ff'
          },
          stock_pdte_ajeno: {
            borderTop: '#7c3aed', // Violeta
            badgeBg: '#f5f3ff',
            badgeBorder: '#c4b5fd',
            badgeColor: '#6d28d9',
            kpiBg: '#f5f3ff',
            kpiBorder: '#c4b5fd',
            kpiColor: '#6d28d9',
            label: '🟣 En Zona Prep',
            labelColor: '#6d28d9',
            labelBg: '#f5f3ff',
            tooltip: 'Uno o más artículos de este pedido tienen stock en zona de preparación (01-PDTE). Puede estar reservado para otro pedido.'
          }
        };

        const theme = THEMES[stateKey];

        const formattedDate = doc.DOCDATE ? String(doc.DOCDATE).split('T')[0] : '-';
        const whscode = doc.LINEAS?.[0]?.WHSCODE || '01';
        const isExpanded = expandedDoc === doc.DOCENTRY;

        const fromWhs = doc.FROM_WHS || doc.FromWarehouse || doc.LINEAS?.[0]?.FROM_WHS || doc.LINEAS?.[0]?.FromWarehouse || '01';
        const toWhs = doc.TO_WHS || doc.ToWarehouse || doc.WHSCODE || doc.LINEAS?.[0]?.WHSCODE || doc.LINEAS?.[0]?.ToWarehouse || '13';
        const isInterWhs = isTransfer && fromWhs && toWhs && String(fromWhs).toUpperCase() !== String(toWhs).toUpperCase();
        const transferComments = doc.COMMENTS || doc.COMENTARIO || doc.Comments || doc.PRIMERA_LINEA_TEXTO || '';

        return (
          <Col xs={24} sm={12} md={8} lg={8} key={doc.DOCENTRY} style={{ display: 'flex' }}>
            <Card
              styles={{ body: { padding: '0 16px 16px 16px', height: '100%', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' } }}
              className="sga-doc-card-container"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
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

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                    <Tooltip
                      title={theme.tooltip || null}
                      placement="top"
                      color="#5b21b6"
                    >
                      <span
                        style={{
                          backgroundColor: theme.labelBg,
                          border: `1px solid ${theme.badgeBorder}`,
                          color: theme.labelColor,
                          fontWeight: 800,
                          fontSize: '0.74rem',
                          padding: '2px 6px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                          cursor: theme.tooltip ? 'help' : 'default'
                        }}
                      >
                        {theme.label}
                        {theme.tooltip && (
                          <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.7 }} />
                        )}
                      </span>
                    </Tooltip>
                  </div>

                  <Space size={6}>
                    <Tag style={{ borderRadius: 6, fontSize: '0.78rem', fontFamily: 'monospace', background: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <ShopOutlined style={{ marginRight: 3 }} /> {isTransfer ? `${fromWhs}➔${toWhs}` : whscode}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      <CalendarOutlined style={{ marginRight: 3 }} />
                      {formattedDate}
                    </Text>
                  </Space>
                </div>

                {/* 2. Fila del Cliente / Tipo de Traslado + Bloque KPI (G / D / T) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isTransfer ? (
                      <div>
                        <div style={{ marginBottom: 4 }}>
                          {isInterWhs ? (
                            <span style={{
                              backgroundColor: '#fff7ed',
                              border: '1px solid #fed7aa',
                              color: '#c2410c',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: '0.82rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              🔄 Traslado: Alm. #{fromWhs} ➔ Alm. #{toWhs}
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: '0.82rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              📦 Traslado Interno (Alm. #{fromWhs})
                            </span>
                          )}
                        </div>
                        {transferComments && (
                          <div style={{
                            fontSize: '0.78rem',
                            color: '#475569',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '4px 8px',
                            lineHeight: 1.3
                          }} className="text-truncate" title={transferComments}>
                            💬 <strong>{transferComments}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
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
                    )}
                  </div>

                  {/* Bloque KPI: G / D / T para todos los documentos, excepto Solicitudes de Traslado (Stock) que usan G / T */}
                  <div
                    style={{
                      backgroundColor: theme.kpiBg,
                      border: `1px solid ${theme.kpiBorder}`,
                      borderRadius: 8,
                      padding: '3px 8px',
                      textAlign: 'center',
                      minWidth: isTransfer ? 60 : 80,
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
                      {!isTransfer && (
                        <>
                          <span style={{ opacity: 0.4, padding: '0 2px' }}>/</span>
                          <span>{disponibles}</span>
                        </>
                      )}
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
                      {!isTransfer && <span style={{ flex: 1 }}>D</span>}
                      <span style={{ flex: 1 }}>T</span>
                    </div>
                  </div>
                </div>

                {/* 3. Línea de Texto Especial del Pedido (si existe y no es traslado) */}
                {doc.PRIMERA_LINEA_TEXTO && !isTransfer && (
                  <div
                    className="sga-doc-info-banner text-truncate"
                    title={doc.PRIMERA_LINEA_TEXTO}
                  >
                    <InfoCircleOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                    {doc.PRIMERA_LINEA_TEXTO}
                  </div>
                )}

                {/* 4. Comentarios del Pedido (si existen y no es traslado) */}
                {doc.COMMENTS && !isTransfer && (
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
                  {/* Botón Gest. - Solo si hay stock para gestionar o es semi/prep o es compra/traslado */}
                  {canManage && (
                    <Button
                      type="default"
                      onClick={() => onOpenDetail(doc)}
                      className="sga-doc-btn-gest"
                    >
                      Gest. <RightOutlined style={{ fontSize: '0.7rem' }} />
                    </Button>
                  )}

                  {/* Botón ≡ Det. */}
                  <Button
                    type="default"
                    onClick={() => toggleExpand(doc.DOCENTRY)}
                    className="sga-doc-btn-det"
                  >
                    <UnorderedListOutlined /> Det.
                  </Button>

                  {/* Botón Activar (Verde) / Desactivar (Rojo) - EXCLUSIVO de Pedidos de Venta */}
                  {isSales && (
                    isInactive ? (
                      <Button
                        type="default"
                        onClick={() => handleToggleActiveConfirm(doc)}
                        className="sga-doc-btn-act"
                      >
                        <CheckOutlined /> Activar
                      </Button>
                    ) : (
                      <Button
                        type="default"
                        danger
                        onClick={() => handleToggleActiveConfirm(doc)}
                        className="sga-doc-btn-deact"
                      >
                        Desact. <RightOutlined style={{ fontSize: '0.7rem' }} />
                      </Button>
                    )
                  )}
                </div>

                {/* Vista previa desplegable de líneas */}
                {isExpanded && (
                  <div className="sga-doc-preview-box">
                    <span className="sga-doc-preview-header">
                      Vista Previa de Líneas ({totalLineas}):
                    </span>
                    {doc.LINEAS && doc.LINEAS.length > 0 ? (
                      doc.LINEAS.map((l, lIdx) => (
                        <div key={lIdx} className="sga-doc-preview-row">
                          <div className="sga-doc-preview-text">
                            <strong>{l.ITEMCODE}</strong> - {l.ITEMNAME || 'Sin descripción'}
                          </div>
                          <div className="sga-doc-preview-meta">
                            <span className="sga-doc-preview-qty">
                              Ctd: {l.QUANTITY}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Sin detalle de líneas</span>
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
