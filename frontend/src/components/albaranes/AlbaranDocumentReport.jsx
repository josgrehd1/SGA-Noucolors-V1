import React from 'react';
import logoImg from '../../assets/logo.png';
import '../../styles/albaran-print.css';

// Formateador de fecha DD/MM/YYYY
const formatDate = (dateVal) => {
  if (!dateVal) return '';
  try {
    const raw = String(dateVal).split('T')[0];
    const parts = raw.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return raw;
  } catch {
    return String(dateVal);
  }
};

// Formateador de moneda española (1.234,56€)
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0,00€';
  const n = Number(val);
  const formatted = n.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${formatted}€`;
};

// Formateador de número simple
const formatNum = (val, decimals = 2) => {
  if (val === null || val === undefined || isNaN(val)) return '0,00';
  return Number(val).toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const AlbaranDocumentReport = ({ albaran, pageNumber = 1, totalPages = 1 }) => {
  if (!albaran) return null;

  const isValorado = Boolean(albaran.IsValorado || albaran.is_valorado);
  const cab = albaran.CabeceraCalculada || albaran.DirEnvioCalculada || null;
  const pago = albaran.CondicionesPagoCalculadas || null;
  const desglose = albaran.DesgloseEconomico || {};

  // Determinar líneas consolidadas (regulares + notas de texto)
  const lineas = albaran.UnifiedLines || albaran.DocumentLines || [];

  // Datos de cabecera
  const cardCode = albaran.CardCode || (cab && cab.CardCode) || '';
  const cardName = albaran.CardName || (cab && cab.CardName) || '';
  const cif = (cab && cab.LicTradNum) || albaran.FederalTaxID || albaran.LicTradNum || '';
  const dirFiscal = (cab && cab.DirFactura) || albaran.Address || '';

  const numDoc = (cab && cab.NumDocCompleto) || String(albaran.DocNum || albaran.DocEntry || '');
  const fechaDoc = formatDate(albaran.DocDate);
  const refNum = (cab && cab.NumAtCard) || albaran.NumAtCard || albaran.NUMATCARD || albaran.REF_ALBARAN || '';
  const bultos = (cab && cab.Bultos) || albaran.U_MAC_OBSVSTOCK || albaran.U_MAC_ObsVSTOCK || albaran.NumberOfPackages || albaran.bultos || '1';

  const shipToCode = (cab && cab.ShipToCode) || albaran.ShipToCode || '';
  const dirEnvio = (cab && cab.DireccionEnvio) || albaran.Address2 || albaran.direccion_envio_str || '';
  const contacto = (cab && cab.Contacto) || '';
  const telefono = (cab && cab.Telefono) || '';
  const horario = (cab && cab.Horario) || '';

  // Verificar si el ShipToCode es genérico
  const shipUpper = String(shipToCode).trim().toUpperCase();
  const isGenericShip = ['ENVIO', 'ENVÍO', 'SHIPTO', 'PRINCIPAL', 'DEFAULT', '0', '1', '', 'DIRECCION DE ENVIO', 'DIRECCIÓN DE ENVÍO'].includes(shipUpper) ||
    shipUpper.startsWith('ENVIO') || shipUpper.startsWith('ENVÍO');

  // Condiciones de pago
  const formaPago = (pago && pago.FormaPago) || albaran.FORMA_PAGO || 'CONTADO';
  const viaPago = (pago && pago.ViaPago) || albaran.VIA_PAGO || '-';
  const domiciliacion = (pago && pago.Domiciliacion) || albaran.DOMICILIACION || '-';

  return (
    <div className="sga-albaran-sheet sga-printable-report">
      {/* 1. Encabezado de Empresa y Logo */}
      <table className="sga-alb-header-table">
        <tbody>
          <tr>
            <td style={{ width: '50%' }}>
              <img src={logoImg} alt="NouColors Logo" className="sga-alb-logo" />
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#000a38', marginTop: 2 }}>
                Soluciones Técnicas en limpieza
              </div>
            </td>
            <td style={{ width: '50%' }} className="sga-alb-company-info">
              <strong>Comercial Nou Colors, S.L.</strong><br />
              CIF: B12210662<br />
              CTRA N-340A KM 970, 12550 - Almazora (Castellón)<br />
              www.noucolors.com | +34 964 342 980
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Bloque de 3 Columnas Superiores Alineadas */}
      <table className="sga-alb-header-info-table">
        <tbody>
          <tr>
            {/* Columna 1: Cliente y Facturación (40%) */}
            <td style={{ width: '40%', paddingRight: '12px' }}>
              <div className="sga-alb-section-title">CLIENTE {cardCode}</div>
              <div className="sga-alb-main-text">{cardName}</div>
              {cif && (
                <div>
                  <strong>CIF: </strong><span className="sga-alb-muted-text">{cif}</span>
                </div>
              )}
              <div>
                <strong>Dir. Fiscal: </strong><span className="sga-alb-muted-text">{dirFiscal}</span>
              </div>
            </td>

            {/* Columna 2: Datos del Albarán (20%) */}
            <td style={{ width: '20%', padding: '0 8px' }}>
              <div className="sga-alb-section-title">ALBARÁN CLIENTE</div>
              <div>
                <strong>Nº: {numDoc}</strong>
              </div>
              <div>
                <strong>Fecha: </strong><span className="sga-alb-muted-text">{fechaDoc}</span>
              </div>
              <div>
                <strong>Referencia: </strong><span className="sga-alb-muted-text">{refNum}</span>
              </div>
              <div>
                <strong>Bultos: </strong><span className="sga-alb-muted-text">{bultos}</span>
              </div>
            </td>

            {/* Columna 3: Dirección de Entrega (40%) */}
            <td style={{ width: '40%', paddingLeft: '12px' }}>
              <div className="sga-alb-section-title">DIRECCIÓN ENVÍO</div>
              <div className="sga-alb-main-text">{shipToCode}</div>
              <div className="sga-alb-muted-text" style={{ fontSize: '9.5px' }}>{dirEnvio}</div>
              {contacto && (
                <div>
                  <strong>Contacto: </strong><span className="sga-alb-muted-text">{contacto}</span>
                </div>
              )}
              {telefono && (
                <div>
                  <strong>Teléfono: </strong><span className="sga-alb-muted-text">{telefono}</span>
                </div>
              )}
              {horario && (
                <div>
                  <strong>Horario: </strong><span className="sga-alb-muted-text">{horario}</span>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 3. Contenedor Central de Tabla de Artículos */}
      <div className="sga-alb-content-body">
        <table className="sga-alb-table">
          <thead>
            {isValorado ? (
              <tr style={{ background: '#000a38', color: '#ffffff' }}>
                <th style={{ textAlign: 'left', width: '14%', padding: '6px 8px', fontSize: '9.5px', fontWeight: 'bold' }}>Artículo</th>
                <th style={{ textAlign: 'left', width: '46%', padding: '6px 8px', fontSize: '9.5px', fontWeight: 'bold' }}>Descripción</th>
                <th style={{ textAlign: 'right', width: '12%', padding: '6px 12px 6px 8px', fontSize: '9.5px', fontWeight: 'bold' }}>Cantidad</th>
                <th style={{ textAlign: 'right', width: '13%', padding: '6px 12px 6px 8px', fontSize: '9.5px', fontWeight: 'bold' }}>Precio Neto</th>
                <th style={{ textAlign: 'right', width: '15%', padding: '6px 8px', fontSize: '9.5px', fontWeight: 'bold' }}>Importe</th>
              </tr>
            ) : (
              <tr style={{ background: '#000a38', color: '#ffffff' }}>
                <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '9.5px', fontWeight: 'bold' }}>ARTÍCULO</th>
                <th style={{ textAlign: 'center', width: '60px', padding: '5px 8px', fontSize: '9.5px', fontWeight: 'bold' }}>CANT.</th>
              </tr>
            )}
          </thead>
          <tbody>
            {/* Fila Informativa de Envío si aplica */}
            {shipToCode && !isGenericShip && (
              <tr className="sga-alb-info-row">
                <td colSpan={isValorado ? 5 : 2} style={{ padding: '4px 8px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#111' }}>
                    <span className="sga-alb-info-tag">Info:</span>
                    <span>{shipToCode}</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Líneas de Documento */}
            {lineas.map((line, idx) => {
              const lineType = line.LineType || (line.ItemCode ? 'dlt_Regular' : 'dslt_Text');
              const isTextLine = ['dslt_Text', 'dlt_Text'].includes(lineType) || !line.ItemCode;

              if (isTextLine) {
                const textoInfo = line.LineText || line.ItemDescription || line.FreeText || '';
                return (
                  <tr key={`text_${idx}`} className="sga-alb-info-row">
                    <td colSpan={isValorado ? 5 : 2} style={{ padding: '4px 8px' }}>
                      <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#222' }}>
                        <span className="sga-alb-info-tag">Info:</span>
                        <span>{textoInfo}</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              // Línea Regular de Artículo
              const qty = Number(line.Quantity || 0);
              const price = Number(line.Price || 0);
              const lineTotal = Number(line.LineTotal || (qty * price));
              const textoLinea = line.FreeText || line.ItemDetails || line.Text || '';
              const showExtraText = textoLinea && textoLinea.trim() && textoLinea.trim() !== String(line.ItemDescription || '').trim();

              if (isValorado) {
                return (
                  <tr key={`item_${line.ItemCode}_${idx}`} className="sga-alb-row-striped">
                    <td style={{ padding: '5px 8px', fontSize: '10px', color: '#1e293b', verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                      {line.ItemCode}
                    </td>
                    <td style={{ padding: '5px 8px', verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '10.5px' }}>{line.ItemDescription || 'Sin descripción'}</div>
                      {showExtraText && (
                        <div style={{ color: '#334155', fontSize: '9px', paddingLeft: 6, borderLeft: '2px solid #cbd5e1', marginTop: 1 }}>{textoLinea.trim()}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '10.5px', paddingRight: '12px', verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                      {formatNum(qty, 2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '10.5px', paddingRight: '12px', verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                      {formatNum(price, 2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '10.5px', paddingRight: '8px', verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                      {formatNum(lineTotal, 2)}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={`item_${line.ItemCode}_${idx}`} className="sga-alb-row-striped">
                  <td style={{ padding: '5px 8px', verticalAlign: 'middle', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 'bold', color: '#1d2433', fontSize: '10.5px' }}>
                      {line.ItemDescription || 'Sin descripción'}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '9px' }}>
                      Cod: {line.ItemCode}
                    </div>
                    {showExtraText && (
                      <div style={{ color: '#334155', fontSize: '9px', paddingLeft: 6, borderLeft: '2px solid #cbd5e1', marginTop: 1 }}>
                        {textoLinea.trim()}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', verticalAlign: 'middle', borderBottom: '1px solid #f1f5f9' }}>
                    {formatNum(qty, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Bloque Inferior de Pie de Página */}
      <div className="sga-alb-bottom-section" style={{ marginTop: 'auto', paddingTop: 4 }}>
        {/* Cuadro de Aviso IMPORTANTE */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 'bold', fontSize: '10.5px', color: '#000000', marginBottom: 3, letterSpacing: '0.3px' }}>
            IMPORTANTE
          </div>
          <p style={{ fontStyle: 'italic', margin: 0, fontSize: '9px', color: '#1e293b', lineHeight: 1.35 }}>
            Dispone de un plazo de 48 horas para verificar que el material recibido es correcto y conforme a su pedido;
            una vez transcurrido dicho periodo, no se admitirán reclamaciones.
          </p>
        </div>

        {isValorado ? (
          <>
            {/* 1. Fila de 3 Bloques con Badges Curvados */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
              {/* Bloque 1: Forma de Pago */}
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  background: '#000a38',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  borderRadius: '6px 18px 18px 6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  Forma de Pago
                </div>
                <div style={{ paddingLeft: 8, fontSize: '9.5px', color: '#000000', fontWeight: 500 }}>
                  {formaPago}
                </div>
              </div>

              {/* Bloque 2: Vía de Pago */}
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  background: '#000a38',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  borderRadius: '6px 18px 18px 6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  Via de Pago
                </div>
                <div style={{ paddingLeft: 8, fontSize: '9.5px', color: '#000000', fontWeight: 500 }}>
                  {viaPago}
                </div>
              </div>

              {/* Bloque 3: Domiciliacion */}
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  background: '#000a38',
                  color: '#ffffff',
                  padding: '6px 12px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  borderRadius: '6px 18px 18px 6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  Domiciliacion
                </div>
                <div style={{ paddingLeft: 8, fontSize: '9px', color: '#000000', fontWeight: 500 }}>
                  {domiciliacion}
                </div>
              </div>
            </div>

            {/* 2. Barra de Totales y Desglose de IVA */}
            <div style={{ marginBottom: 10, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                background: '#000a38',
                color: '#ffffff',
                textAlign: 'center',
                fontSize: '9.5px',
                fontWeight: 'bold',
                padding: '6px 0',
                borderRadius: '6px 6px 0 0'
              }}>
                <div style={{ width: '20%' }}>Importe</div>
                <div style={{ width: '20%' }}>Bonificación</div>
                <div style={{ width: '20%' }}>Base Imponible</div>
                <div style={{ width: '20%' }}>I.V.A. %</div>
                <div style={{ width: '20%' }}>Total</div>
              </div>
              <div style={{
                display: 'flex',
                background: '#717579',
                color: '#ffffff',
                textAlign: 'center',
                padding: '8px 0',
                fontWeight: 'bold',
                fontSize: '11px',
                borderRadius: '0 0 6px 6px'
              }}>
                <div style={{ width: '20%' }}>{formatCurrency(desglose.ImporteBruto)}</div>
                <div style={{ width: '20%' }}>{formatNum(desglose.Bonificacion, 2)}</div>
                <div style={{ width: '20%' }}>{formatCurrency(desglose.BaseImponible)}</div>
                <div style={{ width: '20%', display: 'flex', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: '10px' }}>{formatNum(desglose.VatPercent, 2)}%</span>
                  <span>{formatCurrency(desglose.VatSum)}</span>
                </div>
                <div style={{ width: '20%' }}>{formatCurrency(desglose.DocTotal)}</div>
              </div>
            </div>

            {/* 3. Caja de Conformidad Cliente (Ancho approx 44% a la izquierda) */}
            <div style={{ width: '44%', marginBottom: 4 }}>
              <div style={{
                background: '#000a38',
                color: '#ffffff',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '10px',
                padding: '6px 0',
                borderRadius: '6px 6px 0 0',
                border: '1.5px solid #000a38',
                borderBottom: 'none'
              }}>
                Conformidad Cliente
              </div>
              <div style={{
                border: '1.5px solid #000a38',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                height: 68,
                padding: 8,
                display: 'flex',
                alignItems: 'flex-end',
                background: '#ffffff'
              }}>
                <div style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#1e293b', letterSpacing: '0.3px' }}>
                  FECHA-FIRMA-SELLO
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Cajas Paralelas No Valorado */
          <div className="sga-alb-boxes-flex">
            <div className="sga-alb-signature-box">
              <div className="sga-alb-box-header">CONFORMIDAD CLIENTE</div>
              <div className="sga-alb-box-body sga-alb-signature-body">
                {cardName && (
                  <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '9px', marginBottom: '4px', textAlign: 'center', lineHeight: '1.2' }}>
                    {cardName}
                  </div>
                )}
                <div style={{ color: '#94a3b8', fontSize: '8.5px' }}>
                  FECHA — FIRMA — SELLO
                </div>
              </div>
            </div>

            <div className="sga-alb-payment-box">
              <div className="sga-alb-box-header">CONDICIONES DE PAGO</div>
              <div className="sga-alb-box-body">
                <div className="sga-alb-payment-line">
                  <strong>Forma de Pago:</strong> {formaPago}
                </div>
                <div className="sga-alb-payment-line">
                  <strong>Vía de Pago:</strong> {viaPago}
                </div>
                <div className="sga-alb-payment-line">
                  <strong>Domiciliación:</strong> {domiciliacion}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Pie Legal de Registro Mercantil */}
        <div className="sga-alb-legal-footer">
          Comercial Nou-Colors, S.L. Inscrita en el Reg. Mercantil de Castellón el 29-1-92, T.510, L.77, Sec.Gral.,
          F.86, H.CS-2090, Ins.1.R — CIF ESB12210662 — RPP ENV/2024/000052542
        </div>

        {/* 6. Numeración de Página */}
        <div className="sga-alb-page-number">
          Página {pageNumber} de {totalPages}
        </div>
      </div>
    </div>
  );
};

export default AlbaranDocumentReport;
