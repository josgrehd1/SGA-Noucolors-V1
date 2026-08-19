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

// Formateador de moneda (1.234,56 €)
const formatCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0,00';
  return Number(val).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const AlbaranDocumentReport = ({ albaran, esValorado = false, pageNumber = 1, totalPages = 1 }) => {
  if (!albaran) return null;

  const cab = albaran.CabeceraCalculada || albaran.DirEnvioCalculada || null;
  const pago = albaran.CondicionesPagoCalculadas || null;

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
            </td>
            <td style={{ width: '50%' }} className="sga-alb-company-info">
              <strong>Comercial Nou Colors, S.L.</strong><br />
              CIF: B12210662<br />
              CTRA N-340A KM 970, Almazora (Castellón)<br />
              www.noucolors.com | +34 964 342 980
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. Bloque de 3 Columnas Perfectamente Alineadas en Tabla */}
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
              <div className="sga-alb-muted-text" style={{ fontSize: '10px' }}>{dirEnvio}</div>
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
            <tr>
              <th style={{ textAlign: 'left' }}>ARTÍCULO</th>
              <th style={{ textAlign: 'center', width: '60px' }}>CANT.</th>
              {esValorado && (
                <>
                  <th style={{ textAlign: 'right', width: '70px' }}>PRECIO</th>
                  <th style={{ textAlign: 'center', width: '50px' }}>DTO</th>
                  <th style={{ textAlign: 'right', width: '75px' }}>IMPORTE</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Fila Informativa de Envío si aplica */}
            {shipToCode && !isGenericShip && (
              <tr className="sga-alb-info-row">
                <td colSpan={esValorado ? 5 : 2} style={{ padding: '4px 8px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#111' }}>
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
              const isSubtotal = lineType === 'dslt_Subtotal';

              if (isTextLine) {
                const textoInfo = line.LineText || line.ItemDescription || line.FreeText || '';
                return (
                  <tr key={`text_${idx}`} className="sga-alb-info-row">
                    <td colSpan={esValorado ? 5 : 2} style={{ padding: '4px 8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#222' }}>
                        <span className="sga-alb-info-tag">Info:</span>
                        <span>{textoInfo}</span>
                      </div>
                    </td>
                  </tr>
                );
              }

              if (isSubtotal) {
                return (
                  <tr key={`subtotal_${idx}`}>
                    <td colSpan={esValorado ? 4 : 1} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {line.LineText || 'Subtotal'}
                    </td>
                    {esValorado && (
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--nou-blue)' }}>
                        {formatCurrency(line.Subtotal)} €
                      </td>
                    )}
                  </tr>
                );
              }

              // Línea Regular de Artículo
              const qty = Number(line.Quantity || 0);
              const lineTotal = Number(line.LineTotal || 0);
              const unitPrice = qty > 0 ? lineTotal / qty : 0;
              const textoLinea = line.FreeText || line.ItemDetails || line.Text || '';
              const showExtraText = textoLinea && textoLinea.trim() && textoLinea.trim() !== String(line.ItemDescription || '').trim();

              return (
                <tr key={`item_${line.ItemCode}_${idx}`} className="sga-alb-row-striped">
                  <td style={{ padding: '4px 8px' }}>
                    <div className="sga-alb-item-title">
                      {line.ItemDescription || 'Sin descripción'}
                    </div>
                    <div className="sga-alb-item-code">
                      Cod: {line.ItemCode}
                    </div>
                    {showExtraText && (
                      <div className="sga-alb-item-notes">
                        {textoLinea.trim()}
                      </div>
                    )}
                  </td>

                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                    {qty}
                  </td>

                  {esValorado && (
                    <>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(unitPrice)} €</td>
                      <td style={{ textAlign: 'center' }}>0%</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--nou-blue)' }}>
                        {formatCurrency(lineTotal)} €
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Bloque Inferior de Pie de Página (Fijado siempre al fondo del A4) */}
      <div className="sga-alb-bottom-section">
        {/* Cuadro de Aviso IMPORTANTE */}
        <div className="sga-alb-important-box">
          <div className="sga-alb-important-title">IMPORTANTE</div>
          <p className="sga-alb-important-desc">
            Dispone de un plazo de 48 horas para verificar que el material recibido es correcto y conforme a su pedido;
            una vez transcurrido dicho periodo, no se admitirán reclamaciones.
          </p>
        </div>

        {/* Cajas Paralelas: Conformidad Cliente + Condiciones de Pago */}
        <div className="sga-alb-boxes-flex">
          {/* Caja 1: Conformidad de Firma (35% de ancho) con Nombre de Cliente */}
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

          {/* Caja 2: Condiciones de Pago (65% de ancho) */}
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

        {/* 5. Pie Legal de Registro Mercantil */}
        <div className="sga-alb-legal-footer">
          Comercial Nou-Colors, S.L. Inscrita en el Reg. Mercantil de Castellón el 29-1-92, T.510, L.77, Sec.Gral.,
          F.86, H.CS-2090, Ins.1.R — CIF ESB12210662 — RPP ENV/2024/000052542
        </div>

        {/* 6. Numeración de Página */}
        <div className="sga-alb-page-number">
          Página {pageNumber} / {totalPages}
        </div>
      </div>
    </div>
  );
};

export default AlbaranDocumentReport;
