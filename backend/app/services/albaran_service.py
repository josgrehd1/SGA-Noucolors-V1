import copy
from flask import jsonify, session, render_template, current_app
from app.data.sap_repository import SapRepository
from app.services.stock_service import StockService
from app.utils.extensions import print_handler

class AlbaranService:
    """
    Servicio para listado, consulta, generación e IMPRESIÓN PDF de Albaranes de Entrega (DeliveryNotes).
    """

    @staticmethod
    def list_albaranes(page=1, per_page=20, filters=None, sort_by=None, sort_order=None):
        sap_filter = AlbaranService._build_albaranes_filter(filters or {})
        result = SapRepository.get_data(
            resource="DeliveryNotes",
            selection=["DocEntry", "DocNum", "DocDate", "DocumentStatus", "CardCode", "CardName", "DocTotal", "DocumentLines", "VatSum"],
            filter=sap_filter,
            orderby=sort_by if sort_by else "DocDate",
            order_direction=sort_order if sort_order else "desc",
            page=page,
            per_page=per_page
        )
        
        if result.get('status') != 'ok':
            raise Exception(f"SAP query failed: {result.get('message')}")
        
        documentos = result.get('data', [])
        total_count = result.get('count', len(documentos))
        total_pages = (total_count + per_page - 1) // per_page if per_page else 1
        
        return {
            'albaranes': documentos,
            'total_count': total_count,
            'total_pages': total_pages,
            'page': page
        }

    @staticmethod
    def _build_albaranes_filter(filters):
        sap_filter = {}
        if session.get('sap_employee_id'):
            sap_filter["U_BXPEmpID"] = session['sap_employee_id']

        if filters.get('doc'):
            sap_filter["DocNum"] = int(filters['doc'])

        if filters.get('cliente'):
            sap_filter["CardCode"] = str.upper(filters['cliente'])

        if filters.get('date_from') and filters.get('date_to'):
            sap_filter["DocDate__between"] = [filters['date_from'], filters['date_to']]
        
        return sap_filter

    @staticmethod
    def get_albaran_detalle(docentry):
        resultado = SapRepository.get_data("DeliveryNotes", id=int(docentry), expand=["BusinessPartner"])
        if resultado.get('status') != "ok" or not resultado.get('data'):
            resultado = SapRepository.get_data("DeliveryNotes", id=int(docentry))
            if resultado.get('status') != "ok" or not resultado.get('data'):
                raise ValueError(f"No se encontraron datos para el albarán #{docentry}")
            
            albaran = resultado['data'][0]
            card_code = albaran.get('CardCode')
            if card_code:
                bp_res = SapRepository.get_data("BusinessPartners", id=card_code)
                if bp_res.get('status') == 'ok' and bp_res.get('data'):
                    albaran['BusinessPartner'] = bp_res['data'][0]
            return albaran
        return resultado['data'][0]

    @staticmethod
    def generar_pdf_bytes(albaran):
        """
        Genera el buffer de bytes del PDF del albarán procesando el HTML/CSS con WeasyPrint.
        """
        try:
            from weasyprint import HTML
            html_string = render_template('documents/albaran_doc.jinja2', albaran=albaran, es_valorado=False)
            return HTML(string=html_string, base_url=current_app.root_path).write_pdf()
        except Exception as e:
            current_app.logger.error(f"Error generando PDF de Albarán: {e}")
            raise Exception(f"Error generando documento PDF de albarán: {str(e)}")

    @staticmethod
    def imprimir_albaran(docentry, copies=1):
        """
        Genera el PDF del albarán y lo envía al servicio de impresión (SumatraPDF / Impresora PDF por defecto).
        """
        albaran = AlbaranService.get_albaran_detalle(docentry)
        pdf_bytes = AlbaranService.generar_pdf_bytes(albaran)
        
        for _ in range(max(1, int(copies))):
            success, msg = print_handler.send_pdf_to_printer(pdf_bytes)
            if not success:
                return False, msg
        return True, "Albarán enviado a la impresora correctamente"

    @staticmethod
    def generar_albaran(resource_albaran, doc_original, lineas, mapping_fields):
        fld_bin_from = mapping_fields.get('bin_from')
        fld_bin_to = mapping_fields.get('bin_to')

        ubicaciones = list({d[clave] for d in lineas for clave in (fld_bin_from, fld_bin_to) if clave in d and d[clave]})
        mapping_ubi = StockService.get_id_ubicaciones(lista_ubicaciones=ubicaciones)

        lineas_agrupadas = {}
        for l in lineas:
            key = (l.get('U_PedidoEntry'), l.get('U_PedidoLine'), l.get('U_ItemCode'))
            if key not in lineas_agrupadas:
                lineas_agrupadas[key] = copy.deepcopy(l)
                lineas_agrupadas[key]['U_Quantity'] = float(l.get('U_Quantity', 0) or 0)
            else:
                lineas_agrupadas[key]['U_Quantity'] += float(l.get('U_Quantity', 0) or 0)

        lineas = list(lineas_agrupadas.values())
        albaran_payload = {}
        payload_lines = []

        doc_original_lines_map = {line['LineNum']: line for line in doc_original.get('DocumentLines', []) if 'LineNum' in line}

        for linea in lineas:
            pedido_line_num = int(linea.get('U_PedidoLine'))
            original_line = doc_original_lines_map.get(pedido_line_num, {})
            ctd_preparada = linea.get('U_Quantity')
            esta_semi = linea.get('U_Semi', 'N') == 'Y'
            bin_def = mapping_ubi.get(linea.get(fld_bin_to)) if esta_semi else mapping_ubi.get(linea.get(fld_bin_from), mapping_ubi.get(linea.get(fld_bin_to))) 
            
            bin_payload = []
            if bin_def:
                bin_payload = [{"BinAbsEntry": bin_def, "SerialAndBatchNumbersBaseLine": -1, "Quantity": ctd_preparada}]

            nueva_linea = {
                'ItemCode': original_line.get('ItemCode') or linea.get('U_ItemCode'),
                'Quantity': ctd_preparada,
                "BaseType": int(linea.get("U_ObjType", 17)),
                "BaseEntry": int(linea.get("U_PedidoEntry")),
                "BaseLine": pedido_line_num
            }
            if bin_payload:
                nueva_linea["DocumentLinesBinAllocations"] = bin_payload

            payload_lines.append(nueva_linea)

        albaran_payload['DocumentLines'] = payload_lines

        campos_necesarios = ["CardCode", "ShipToCode", "PayToCode", "SalesPersonCode", "Comments"]
        for clave, valor in doc_original.items():
            if clave.startswith('U_') or clave in campos_necesarios:
                if clave == "U_BXPEmpID":
                    albaran_payload[clave] = session.get('sap_employee_id', valor)
                else:
                    albaran_payload[clave] = copy.deepcopy(valor)

        res = SapRepository.post(resource=resource_albaran, payload=albaran_payload)

        if res.status_code == 201:
            for row in lineas:
                if 'DocEntry' in row:
                    SapRepository.update(resource="NC_SGAWEB_DOCS", id=row['DocEntry'], payload={"U_Estado": 'C'})
            return jsonify({"status": "ok", "message": "Albarán generado correctamente en SAP"})
        else:
            err_msg = SapRepository.parse_sap_error(res)
            return jsonify({"status": "error", "message": f"Error generando albarán en SAP: {err_msg}"}), res.status_code
