import os
from flask import current_app

class AlbaranDocGenerator:
    """
    Generador modular de documentos y PDFs de Albaranes (NouColors A4).
    Mantiene la lógica de maquetación desacoplada de albaran_service.
    """

    @staticmethod
    def generate_html(albaran):
        app_root = current_app.root_path
        logo_file = os.path.join(app_root, 'static', 'images', 'logo.png')
        logo_url = f"file:///{logo_file.replace(os.sep, '/')}" if os.path.exists(logo_file) else ""

        cab = albaran.get('CabeceraCalculada') or albaran.get('DirEnvioCalculada') or {}
        pago = albaran.get('CondicionesPagoCalculadas') or {}
        lineas = albaran.get('UnifiedLines') or albaran.get('DocumentLines') or []

        card_code = albaran.get('CardCode') or cab.get('CardCode') or ''
        card_name = albaran.get('CardName') or cab.get('CardName') or ''
        cif = cab.get('LicTradNum') or albaran.get('FederalTaxID') or albaran.get('LicTradNum') or ''
        dir_fiscal = cab.get('DirFactura') or albaran.get('Address') or ''

        num_doc = cab.get('NumDocCompleto') or str(albaran.get('DocNum') or albaran.get('DocEntry') or '')
        raw_date = str(albaran.get('DocDate') or '').split('T')[0]
        date_parts = raw_date.split('-')
        fecha_doc = f"{date_parts[2]}/{date_parts[1]}/{date_parts[0]}" if len(date_parts) == 3 else raw_date

        ref_num = cab.get('NumAtCard') or albaran.get('NumAtCard') or albaran.get('NUMATCARD') or albaran.get('REF_ALBARAN') or ''
        bultos = cab.get('Bultos') or albaran.get('U_MAC_OBSVSTOCK') or albaran.get('NumberOfPackages') or '1'

        ship_to_code = cab.get('ShipToCode') or albaran.get('ShipToCode') or ''
        dir_envio = cab.get('DireccionEnvio') or albaran.get('Address2') or albaran.get('direccion_envio_str') or ''
        contacto = cab.get('Contacto') or ''
        telefono = cab.get('Telefono') or ''
        horario = cab.get('Horario') or ''

        forma_pago = pago.get('FormaPago') or albaran.get('FORMA_PAGO') or 'CONTADO'
        via_pago = pago.get('ViaPago') or albaran.get('VIA_PAGO') or '-'
        domiciliacion = pago.get('Domiciliacion') or albaran.get('DOMICILIACION') or '-'

        # Filas de artículos
        rows_html = []
        ship_upper = str(ship_to_code).strip().upper()
        is_generic = ship_upper in ['ENVIO', 'ENVÍO', 'SHIPTO', 'PRINCIPAL', 'DEFAULT', '0', '1', ''] or ship_upper.startswith('ENVIO')

        if ship_to_code and not is_generic:
            rows_html.append(f"""
            <tr style="background:#f8fafc;">
                <td colspan="2" style="padding:4px 8px; font-weight:bold; font-size:10px;">
                    <span style="min-width:40px; display:inline-block;">Info:</span> {ship_to_code}
                </td>
            </tr>
            """)

        for l in lineas:
            l_type = l.get('LineType') or ('dlt_Regular' if l.get('ItemCode') else 'dslt_Text')
            if l_type in ['dslt_Text', 'dlt_Text'] or not l.get('ItemCode'):
                txt = l.get('LineText') or l.get('ItemDescription') or l.get('FreeText') or ''
                rows_html.append(f"""
                <tr style="background:#f8fafc;">
                    <td colspan="2" style="padding:4px 8px; font-size:9.5px; font-weight:bold;">
                        <span style="min-width:40px; display:inline-block;">Info:</span> {txt}
                    </td>
                </tr>
                """)
            else:
                qty = float(l.get('Quantity') or 0)
                desc = l.get('ItemDescription') or 'Sin descripción'
                code = l.get('ItemCode') or ''
                extra = l.get('FreeText') or l.get('ItemDetails') or ''
                extra_html = f'<div style="color:#334155; font-size:9px; padding-left:6px; border-left:2px solid #cbd5e1; margin-top:1px;">{extra.strip()}</div>' if extra and extra.strip() != desc.strip() else ''
                rows_html.append(f"""
                <tr>
                    <td style="padding:4px 8px; vertical-align:middle; border-bottom:1px solid #f1f5f9;">
                        <div style="font-weight:bold; color:#1d2433; font-size:10.5px;">{desc}</div>
                        <div style="color:#64748b; font-size:9px;">Cod: {code}</div>
                        {extra_html}
                    </td>
                    <td style="text-align:center; font-weight:bold; width:60px; font-size:11px; vertical-align:middle; border-bottom:1px solid #f1f5f9;">{qty:g}</td>
                </tr>
                """)

        contact_info_html = ""
        if contacto:
            contact_info_html += f"<div><strong>Contacto: </strong><span style='color:#475569;'>{contacto}</span></div>"
        if telefono:
            contact_info_html += f"<div><strong>Teléfono: </strong><span style='color:#475569;'>{telefono}</span></div>"
        if horario:
            contact_info_html += f"<div><strong>Horario: </strong><span style='color:#475569;'>{horario}</span></div>"

        cif_html = f"<div><strong>CIF: </strong><span style='color:#475569;'>{cif}</span></div>" if cif else ""
        logo_html = f"<img src='{logo_url}' style='max-width:195px; height:auto;'>" if logo_url else ""

        return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Albarán de Entrega #{num_doc}</title>
    <style>
        @page {{
            size: A4 portrait;
            margin: 6mm 10mm 6mm 10mm;
        }}
        * {{
            box-sizing: border-box;
        }}
        html, body {{
            height: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11px;
            color: #1e293b;
            line-height: 1.4;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }}
        .page-container {{
            width: 100%;
            max-width: 210mm;
            min-height: 275mm;
            height: 100%;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        .header-table td {{
            vertical-align: top;
            padding: 0;
            border: none;
        }}
        .info-table {{
            margin-top: 2px;
            margin-bottom: 8px;
        }}
        .info-table td {{
            vertical-align: top;
            padding: 0;
            border: none;
            font-size: 10.5px;
            line-height: 1.4;
        }}
        .sec-title {{
            font-size: 10.5px;
            font-weight: bold;
            color: #1d2433;
            border-bottom: 2px solid #1d2433;
            padding-bottom: 2px;
            margin-bottom: 4px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
        }}
        .main-text {{
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 1px;
        }}
        .muted-text {{
            color: #475569;
        }}
        .table-items {{
            margin-top: 2px;
            margin-bottom: 8px;
        }}
        .table-items th {{
            background: #1d2433 !important;
            color: #ffffff !important;
            padding: 4px 8px;
            font-size: 9.5px;
            font-weight: bold;
            text-align: left;
            border: 1px solid #1d2433;
        }}
        .bottom-section {{
            margin-top: auto;
            padding-top: 6px;
            page-break-inside: avoid;
            break-inside: avoid;
        }}
        .important-box {{
            border-top: 1.5px solid #1d2433;
            padding-top: 3px;
            margin-bottom: 6px;
        }}
        .important-title {{
            font-weight: bold;
            font-size: 9px;
            color: #1d2433;
            margin-bottom: 1px;
            letter-spacing: 0.3px;
        }}
        .important-desc {{
            font-style: italic;
            margin: 0;
            font-size: 8px;
            color: #475569;
            text-align: justify;
            line-height: 1.3;
        }}
        .box-head {{
            background: #1d2433 !important;
            color: #ffffff !important;
            text-align: center;
            padding: 3px 5px;
            font-size: 9px;
            font-weight: bold;
            letter-spacing: 0.3px;
            text-transform: uppercase;
        }}
        .box-body {{
            border: 1px solid #1d2433;
            border-top: none;
            background: #ffffff;
            padding: 5px 8px;
            font-size: 9px;
        }}
        .legal-footer {{
            text-align: center;
            font-size: 7.5px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
            margin-top: 6px;
            line-height: 1.25;
        }}
        .page-number {{
            text-align: center;
            font-size: 8.5px;
            color: #64748b;
            margin-top: 2px;
            font-weight: 500;
        }}
    </style>
</head>
<body>
    <div class="page-container">
        <div>
            <!-- 1. Encabezado de Empresa y Logo -->
            <table class="header-table">
                <tr>
                    <td style="width: 50%;">{logo_html}</td>
                    <td style="width: 50%; text-align: right; font-size: 8.5px; color: #475569; line-height: 1.35;">
                        <strong>Comercial Nou Colors, S.L.</strong><br>
                        CIF: B12210662<br>
                        CTRA N-340A KM 970, Almazora (Castellón)<br>
                        www.noucolors.com | +34 964 342 980
                    </td>
                </tr>
            </table>

            <!-- 2. Bloque de 3 Columnas Superiores Alineadas -->
            <table class="info-table">
                <tr>
                    <td style="width: 40%; padding-right: 12px;">
                        <div class="sec-title">CLIENTE {card_code}</div>
                        <div class="main-text">{card_name}</div>
                        {cif_html}
                        <div><strong>Dir. Fiscal: </strong><span class="muted-text">{dir_fiscal}</span></div>
                    </td>
                    <td style="width: 20%; padding: 0 8px;">
                        <div class="sec-title">ALBARÁN CLIENTE</div>
                        <div><strong>Nº: {num_doc}</strong></div>
                        <div><strong>Fecha: </strong><span class="muted-text">{fecha_doc}</span></div>
                        <div><strong>Referencia: </strong><span class="muted-text">{ref_num}</span></div>
                        <div><strong>Bultos: </strong><span class="muted-text">{bultos}</span></div>
                    </td>
                    <td style="width: 40%; padding-left: 12px;">
                        <div class="sec-title">DIRECCIÓN ENVÍO</div>
                        <div class="main-text">{ship_to_code}</div>
                        <div class="muted-text" style="font-size: 10px;">{dir_envio}</div>
                        {contact_info_html}
                    </td>
                </tr>
            </table>

            <!-- 3. Tabla de Artículos -->
            <table class="table-items">
                <thead>
                    <tr>
                        <th style="text-align: left;">ARTÍCULO</th>
                        <th style="text-align: center; width: 60px;">CANT.</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(rows_html)}
                </tbody>
            </table>
        </div>

        <!-- 4. Pie de Página Fijado Abajo -->
        <div class="bottom-section">
            <div class="important-box">
                <div class="important-title">IMPORTANTE</div>
                <p class="important-desc">
                    Dispone de un plazo de 48 horas para verificar que el material recibido es correcto y conforme a su pedido; una vez transcurrido dicho periodo, no se admitirán reclamaciones.
                </p>
            </div>

            <table style="width: 100%; border: none;">
                <tr>
                    <td style="width: 35%; vertical-align: top; border: none; padding-right: 8px;">
                        <div class="box-head">CONFORMIDAD CLIENTE</div>
                        <div class="box-body" style="text-align: center; color: #94a3b8; font-weight: 600; min-height: 44px; letter-spacing: 1px;">
                            <div style="font-weight: bold; color: #1e293b; font-size: 9px; margin-bottom: 3px; line-height: 1.2;">{card_name}</div>
                            <div style="color: #94a3b8; font-size: 8.5px;">FECHA — FIRMA — SELLO</div>
                        </div>
                    </td>
                    <td style="width: 65%; vertical-align: top; border: none; padding-left: 8px;">
                        <div class="box-head">CONDICIONES DE PAGO</div>
                        <div class="box-body">
                            <div style="margin-bottom: 2px;"><strong>Forma de Pago:</strong> {forma_pago}</div>
                            <div style="margin-bottom: 2px;"><strong>Vía de Pago:</strong> {via_pago}</div>
                            <div><strong>Domiciliación:</strong> {domiciliacion}</div>
                        </div>
                    </td>
                </tr>
            </table>

            <div class="legal-footer">
                Comercial Nou-Colors, S.L. Inscrita en el Reg. Mercantil de Castellón el 29-1-92, T.510, L.77, Sec.Gral., F.86, H.CS-2090, Ins.1.R — CIF ESB12210662 — RPP ENV/2024/000052542
            </div>

            <div class="page-number">
                Página 1 / 1
            </div>
        </div>
    </div>
</body>
</html>"""

    @staticmethod
    def generate_pdf_bytes(albaran):
        from weasyprint import HTML
        app_root = current_app.root_path
        html_doc = AlbaranDocGenerator.generate_html(albaran)
        return HTML(string=html_doc, base_url=app_root).write_pdf()
