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
        nivel = str(session.get('sap_nivel') or '').strip().upper()

        # Supervisores (nivel 'S') pueden ver TODOS los albaranes finalizados por cualquier usuario.
        # Operarios y resto de usuarios (nivel != 'S') solo ven sus propios albaranes.
        if nivel != 'S':
            if emp_id := session.get('sap_employee_id'):
                sap_filter["DocumentsOwner"] = emp_id

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
        else:
            albaran = resultado['data'][0]

        albaran["UnifiedLines"] = AlbaranService._consolidar_lineas(albaran)
        AlbaranService._procesar_direccion_envio(albaran)
        return albaran

    @staticmethod
    def _consolidar_lineas(data):
        lineas = data.get("DocumentLines", [])
        if not lineas:
            return []

        lineas_agrupadas = {}
        for l in lineas:
            key = (l.get('ItemCode'), l.get('ItemDescription'), l.get('Price'))
            if key not in lineas_agrupadas:
                lineas_agrupadas[key] = copy.deepcopy(l)
                lineas_agrupadas[key]['Quantity'] = float(l.get('Quantity', 0) or 0)
            else:
                lineas_agrupadas[key]['Quantity'] += float(l.get('Quantity', 0) or 0)

        lines_list = list(lineas_agrupadas.values())
        AlbaranService._add_machine_data(lines_list)
        return lines_list

    @staticmethod
    def _add_machine_data(lines):
        for line in lines:
            item_code = line.get('ItemCode', '')
            if item_code and item_code.startswith('MAQ'):
                try:
                    res = SapRepository.get_data("Items", id=item_code, selection=["U_TipoMaquina", "U_Modelo"])
                    if res.get('status') == 'ok' and res.get('data'):
                        item_info = res['data'][0] if isinstance(res['data'], list) else res['data']
                        line['U_TipoMaquina'] = item_info.get('U_TipoMaquina', '')
                        line['U_Modelo'] = item_info.get('U_Modelo', '')
                except Exception:
                    pass

    @staticmethod
    def _procesar_direccion_envio(albaran):
        card_code = albaran.get('CardCode', '')
        ship_to_code = albaran.get('ShipToCode', '')
        contact_person_code = albaran.get('ContactPersonCode')
        doc_num = albaran.get('DocNum', '')
        series_id = albaran.get('Series')

        series_name = ""
        if series_id:
            try:
                series_res = SapRepository.get_data("Series", id=int(series_id))
                if series_res.get('status') == 'ok' and series_res.get('data'):
                    raw_s = series_res['data']
                    s_data = raw_s[0] if isinstance(raw_s, list) and len(raw_s) > 0 else raw_s
                    if isinstance(s_data, dict):
                        series_name = s_data.get('Name') or s_data.get('SeriesName') or ""
            except Exception:
                pass

        albaran['num_doc_completo'] = f"{series_name} - {doc_num}" if series_name else str(doc_num)

        bp = albaran.get('BusinessPartner') or {}
        bp_addresses = bp.get('BPAddresses', [])
        contact_employees = bp.get('ContactEmployees', [])

        if not bp_addresses or not contact_employees:
            if card_code:
                try:
                    bp_res = SapRepository.get_data("BusinessPartners", id=card_code)
                    if bp_res.get('status') == 'ok' and bp_res.get('data'):
                        bp = bp_res['data'][0]
                        bp_addresses = bp.get('BPAddresses', [])
                        contact_employees = bp.get('ContactEmployees', [])
                        albaran['BusinessPartner'] = bp
                except Exception:
                    pass

        ext = albaran.get('AddressExtension') or {}
        dir_envio_crd1 = next((a for a in bp_addresses if a.get('AddressName') == ship_to_code and (str(a.get('AddressType')).endswith('ShipTo') or a.get('AddressType') == 'S')), None)
        if not dir_envio_crd1:
            dir_envio_crd1 = next((a for a in bp_addresses if str(a.get('AddressType')).endswith('ShipTo') or a.get('AddressType') == 'S'), None)

        street = (dir_envio_crd1.get('Street') if dir_envio_crd1 else None) or ext.get('ShipToStreet')
        zipcode = (dir_envio_crd1.get('ZipCode') if dir_envio_crd1 else None) or ext.get('ShipToZipCode', '')
        city = (dir_envio_crd1.get('City') if dir_envio_crd1 else None) or ext.get('ShipToCity', '')
        raw_state = (dir_envio_crd1.get('State') if dir_envio_crd1 else None) or ext.get('ShipToCounty') or ext.get('ShipToState', '')
        country = (dir_envio_crd1.get('Country') if dir_envio_crd1 else None) or ext.get('ShipToCountry', 'ES')

        if street:
            parts = [street.strip().upper()]
            city_part = f"{zipcode} {city.strip().upper()}".strip()
            if city_part: parts.append(city_part)
            if raw_state: parts.append(str(raw_state).strip().upper())
            if country:
                c_name = "ESPAÑA" if str(country).strip().upper() in ['ES', 'ESPAÑA'] else str(country).strip().upper()
                parts.append(c_name)
            albaran['direccion_envio_str'] = " - ".join(parts)
        else:
            albaran['direccion_envio_str'] = albaran.get('Address2', '')

        street_no_crd1 = (dir_envio_crd1.get('StreetNo') if dir_envio_crd1 else '') or ''
        street_no_ext = (ext.get('ShipToStreetNo') or '')
        street_no = str(street_no_crd1 or street_no_ext or '').strip()

        contacto_obj = next((c for c in contact_employees if contact_person_code is not None and str(c.get('InternalCode')) == str(contact_person_code)), None)
        cn_name = contacto_obj.get('Name', '') if contacto_obj else (bp.get('ContactPerson', '') or '')
        cn_tel = (contacto_obj.get('Phone1') or contacto_obj.get('Tel1') or contacto_obj.get('MobilePhone', '')) if contacto_obj else (bp.get('Phone1', '') or '')

        albaran['contacto_final'] = street_no if len(street_no) >= 3 else cn_name

        building_crd1 = (dir_envio_crd1.get('BuildingFloorRoom') if dir_envio_crd1 else '') or ''
        building_ext = (ext.get('ShipToBuilding') or '')
        building = str(building_crd1 or building_ext or '').strip()

        albaran['telefono_final'] = building if len(building) >= 3 else cn_tel
        albaran['horario_final'] = (dir_envio_crd1.get('U_MAC_Horario') if dir_envio_crd1 else '') or ext.get('U_MAC_HorarioS', '') or ext.get('U_MAC_Horario', '')

        # Dirección de Factura
        dir_fact_crd1 = next((a for a in bp_addresses if (str(a.get('AddressType')).endswith('BillTo') or a.get('AddressType') == 'B') and a.get('AddressName') == 'Domicilio'), None)
        if not dir_fact_crd1:
            dir_fact_crd1 = next((a for a in bp_addresses if (str(a.get('AddressType')).endswith('BillTo') or a.get('AddressType') == 'B')), None)

        if dir_fact_crd1 and dir_fact_crd1.get('Street'):
            f_street = dir_fact_crd1.get('Street', '').strip().upper()
            f_zip = dir_fact_crd1.get('ZipCode', '').strip()
            f_city = dir_fact_crd1.get('City', '').strip().upper()
            f_raw_state = dir_fact_crd1.get('State', '').strip()
            f_country = dir_fact_crd1.get('Country', 'ES').strip()

            parts_f = [f_street]
            city_p = f"{f_zip} {f_city}".strip()
            if city_p: parts_f.append(city_p)
            if f_raw_state: parts_f.append(str(f_raw_state).strip().upper())
            if f_country:
                c_n = "ESPAÑA" if str(f_country).strip().upper() in ['ES', 'ESPAÑA'] else str(f_country).strip().upper()
                parts_f.append(c_n)
            albaran['dir_factura_str'] = " - ".join(parts_f)
        else:
            albaran['dir_factura_str'] = albaran.get('Address', '')

        # Bultos
        albaran['bultos'] = albaran.get('U_MAC_OBSVSTOCK') or albaran.get('NumberOfPackages') or albaran.get('U_BULTOS') or 1

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
            bin_code_candidate = linea.get(fld_bin_to) if esta_semi else (linea.get(fld_bin_from) or linea.get(fld_bin_to) or linea.get('U_BinFrom') or linea.get('U_BinTo'))
            bin_def = mapping_ubi.get(bin_code_candidate)

            if not bin_def:
                item_code = original_line.get('ItemCode') or linea.get('U_ItemCode')
                if item_code:
                    res_stock_ubi = SapRepository.get_data_from_view(
                        view_name="NC_STOCK_UBICACION_B1SLQuery",
                        filter={"ItemCode": item_code},
                        all_results=False
                    )
                    if res_stock_ubi.get('status') == 'ok' and res_stock_ubi.get('data'):
                        bin_code_found = res_stock_ubi['data'][0].get('BinCode')
                        if bin_code_found:
                            ubi_map_temp = StockService.get_id_ubicaciones([bin_code_found])
                            bin_def = ubi_map_temp.get(bin_code_found)

            bin_whs = None
            if bin_def:
                res_bin_info = SapRepository.get_data(
                    resource="BinLocations",
                    id=int(bin_def),
                    selection=["AbsEntry", "Warehouse", "BinCode"]
                )
                if res_bin_info.get('status') == 'ok' and res_bin_info.get('data'):
                    bin_whs = res_bin_info['data'][0].get('Warehouse')

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

            if bin_whs:
                nueva_linea['WarehouseCode'] = bin_whs

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

        # Inyectar trazabilidad de operario para Acceso Indirecto
        if session.get('sap_employee_id'):
            albaran_payload['DocumentsOwner'] = session.get('sap_employee_id')
            albaran_payload['U_BXPEmpID'] = session.get('sap_employee_id')
        if session.get('sap_salesperson'):
            albaran_payload['SalesPersonCode'] = session.get('sap_salesperson')

        user_name = session.get('sap_username') or session.get('sap_user') or 'Operario SGA'
        current_comments = str(albaran_payload.get('Comments') or '').strip()
        audit_tag = f"[Operario SGA: {user_name}]"
        if audit_tag not in current_comments:
            albaran_payload['Comments'] = f"{current_comments} {audit_tag}".strip()

        res = SapRepository.post(resource=resource_albaran, payload=albaran_payload)

        if res.status_code == 201:
            for row in lineas:
                if 'DocEntry' in row:
                    SapRepository.update(resource="NC_SGAWEB_DOCS", id=row['DocEntry'], payload={"U_Estado": 'C'})
            return jsonify({"status": "ok", "message": "Albarán generado correctamente en SAP"})
        else:
            err_msg = SapRepository.parse_sap_error(res)
            if "has already been closed" in str(err_msg).lower():
                for row in lineas:
                    if 'DocEntry' in row:
                        SapRepository.update(resource="NC_SGAWEB_DOCS", id=row['DocEntry'], payload={"U_Estado": 'C'})
                err_msg = "El pedido original ya se encuentra CERRADO o entregado en SAP. Las líneas de preparación en SGA se han actualizado."
            return jsonify({"status": "error", "message": f"Error generando albarán en SAP: {err_msg}"}), res.status_code
