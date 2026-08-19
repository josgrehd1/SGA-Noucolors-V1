import copy
import os
from flask import jsonify, session, current_app
from app.data.sap_repository import SapRepository
from app.services.stock_service import StockService
from app.utils.extensions import print_handler, sl_handler
from app.utils.sap_series_mapper import SapSeriesMapper

class AlbaranService:
    """
    Servicio para listado, consulta, generación e IMPRESIÓN PDF de Albaranes de Entrega (DeliveryNotes).
    Reproduce con total fidelidad el formato, cálculos y estructura del SGA original.
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
    def get_albaran_detalle(docentry, master_session=None):
        """
        Obtiene y procesa un albarán completo con todas sus cabeceras, líneas especiales,
        direcciones de envío/fiscal formateadas y condiciones de pago calculadas (igual que SGA original).
        """
        m_session = master_session or sl_handler.ensure_master_session()

        resultado = SapRepository.get_data("DeliveryNotes", id=int(docentry), expand=["BusinessPartner"], master_session=m_session)
        
        if resultado.get('status') != "ok" or not resultado.get('data'):
            # Fallback en 2 pasos si la primera consulta no devuelve datos
            resultado = SapRepository.get_data("DeliveryNotes", id=int(docentry), master_session=m_session)
            if resultado.get('status') != "ok" or not resultado.get('data'):
                err_detail = resultado.get('message', 'No se obtuvieron datos de SAP')
                raise ValueError(f"No se encontraron datos para el albarán #{docentry}. ({err_detail})")
                
            albaran = resultado['data'][0]
            card_code = albaran.get('CardCode')
            if card_code:
                bp_res = SapRepository.get_data("BusinessPartners", id=card_code, master_session=m_session)
                if bp_res.get('status') == 'ok' and bp_res.get('data'):
                    albaran['BusinessPartner'] = bp_res['data'][0]
        else:
            albaran = resultado['data'][0]

        albaran["UnifiedLines"] = AlbaranService._consolidar_lineas(albaran)
        AlbaranService._add_machine_data(albaran["UnifiedLines"], master_session=m_session)
        AlbaranService._procesar_direccion_envio(albaran, master_session=m_session)

        return albaran

    @staticmethod
    def _consolidar_lineas(data):
        """
        Consolida líneas normales (DocumentLines) y líneas especiales/texto (DocumentSpecialLines)
        ordenándolas por LineNum y asegurando LineType para la plantilla PDF del albarán.
        """
        unified = {}
        # 1. Procesamos las líneas normales
        for line in data.get("DocumentLines", []):
            num = line.get("LineNum", 0)
            if num not in unified:
                unified[num] = []
            line_copy = copy.deepcopy(line)
            if "LineType" not in line_copy or not line_copy.get("LineType"):
                line_copy["LineType"] = "dlt_Regular"
            unified[num].append(line_copy)

        # 2. Procesamos las líneas especiales (textos, subtotales)
        for special in data.get("DocumentSpecialLines", []):
            num = special.get("AfterLineNumber", 0)
            if num not in unified:
                unified[num] = []
            special_copy = copy.deepcopy(special)
            if "LineType" not in special_copy or not special_copy.get("LineType"):
                special_copy["LineType"] = "dslt_Text"
            unified[num].append(special_copy)

        # 3. Aplanamos el diccionario resultante en una sola lista ordenada
        final_list = []
        for num in sorted(unified.keys()):
            final_list.extend(unified[num])

        return final_list

    @staticmethod
    def _add_machine_data(lines, master_session=None):
        """
        Enriquece las líneas de máquinas (MAQ) con metadatos técnicos y stock.
        """
        if not lines:
            return lines

        maq_codes = [x.get('ItemCode') for x in lines if x.get('ItemCode') and str(x.get('ItemCode')).startswith('MAQ')]
        if not maq_codes:
            return lines

        try:
            items_info = SapRepository.get_data(
                resource="Items", 
                selection=[
                    "ItemCode", 
                    "U_TipoMaquina",
                    "U_Modelo",
                    "U_MAC_Descripcion", 
                    "U_MAC_FichaOnline", 
                    "U_MAC_Video", 
                    "U_MAC_Catalogo", 
                    "U_MAC_Img"
                ],
                filter={"ItemCode__in": list(set(maq_codes))},
                master_session=master_session,
                all_results=True,
                inline_count=False
            )
            
            stock_disponible = StockService.get_stock_disponible(maq_codes)
            
            mapa_meta = {x['ItemCode']: x for x in items_info.get('data', []) if 'ItemCode' in x}
            for row in lines:
                codigo = row.get('ItemCode')
                if codigo in mapa_meta:
                    extras = mapa_meta[codigo]
                    datos_a_fusionar = {k: v for k, v in extras.items() if k != 'ItemCode'}
                    row.update(datos_a_fusionar)

                if codigo in stock_disponible:
                    row['Stock'] = stock_disponible.get(codigo, 0)
        except Exception:
            pass

        return lines

    @staticmethod
    def _procesar_direccion_envio(albaran, master_session=None):
        """
        Construye la cabecera calculada y las direcciones de envío y facturación
        exactamente igual que el SGA original.
        """
        card_code = albaran.get('CardCode', '')
        ship_to_code = albaran.get('ShipToCode', '')
        contact_person_code = albaran.get('ContactPersonCode')
        doc_num = albaran.get('DocNum', '')
        series_id = albaran.get('Series')

        series_name = ""
        if series_id:
            try:
                s_info = SapSeriesMapper.get_series_info_by_id(series_id)
                series_name = s_info.get('Name') or ""
                if not series_name:
                    series_res = SapRepository.get_data("Series", id=int(series_id), master_session=master_session)
                    if series_res.get('status') == 'ok' and series_res.get('data'):
                        raw_s = series_res['data']
                        s_data = raw_s[0] if isinstance(raw_s, list) and len(raw_s) > 0 else raw_s
                        if isinstance(s_data, dict):
                            series_name = s_data.get('Name') or s_data.get('SeriesName') or ""
            except Exception:
                pass

        num_doc_completo = f"{series_name} - {doc_num}" if series_name else str(doc_num)

        # Buscar BusinessPartner completo con BPAddresses y ContactEmployees
        bp = albaran.get('BusinessPartner') or {}
        bp_addresses = bp.get('BPAddresses', [])
        contact_employees = bp.get('ContactEmployees', [])

        if not bp_addresses or not contact_employees:
            if card_code:
                try:
                    bp_res = SapRepository.get_data("BusinessPartners", id=card_code, master_session=master_session)
                    if bp_res.get('status') == 'ok' and bp_res.get('data'):
                        bp = bp_res['data'][0]
                        bp_addresses = bp.get('BPAddresses', [])
                        contact_employees = bp.get('ContactEmployees', [])
                        albaran['BusinessPartner'] = bp
                except Exception:
                    pass

        lic_trad_num = albaran.get('FederalTaxID') or bp.get('FederalTaxID') or albaran.get('LicTradNum') or bp.get('LicTradNum', '')
        ext = albaran.get('AddressExtension') or {}

        # 1. Obtener Provincias / Regiones de SAP
        regiones = []
        try:
            res_reg = SapRepository.get_data("States", all_results=True, master_session=master_session, inline_count=False)
            if res_reg.get('status') == 'ok':
                regiones = res_reg.get('data', [])
        except Exception:
            pass

        # 2. Buscar la dirección de envío específica en CRD1 (BPAddresses)
        dir_envio_crd1 = next((a for a in bp_addresses if a.get('AddressName') == ship_to_code and (str(a.get('AddressType')).endswith('ShipTo') or a.get('AddressType') == 'S')), None)
        if not dir_envio_crd1:
            dir_envio_crd1 = next((a for a in bp_addresses if str(a.get('AddressType')).endswith('ShipTo') or a.get('AddressType') == 'S'), None)

        street = (dir_envio_crd1.get('Street') if dir_envio_crd1 else None) or ext.get('ShipToStreet')
        zipcode = (dir_envio_crd1.get('ZipCode') if dir_envio_crd1 else None) or ext.get('ShipToZipCode', '')
        city = (dir_envio_crd1.get('City') if dir_envio_crd1 else None) or ext.get('ShipToCity', '')
        raw_state = (dir_envio_crd1.get('State') if dir_envio_crd1 else None) or ext.get('ShipToCounty') or ext.get('ShipToState', '')
        country = (dir_envio_crd1.get('Country') if dir_envio_crd1 else None) or ext.get('ShipToCountry', 'ES')

        state_obj = next((e for e in regiones if e.get('Code') == raw_state and e.get('Country') == country), None)
        state_name = state_obj.get('Name') if state_obj else raw_state

        if street:
            parts = [street.strip().upper()]
            city_part = f"{zipcode} {city.strip().upper()}".strip()
            if city_part: parts.append(city_part)
            if state_name: parts.append(str(state_name).strip().upper())
            if country:
                c_name = "ESPAÑA" if str(country).strip().upper() in ['ES', 'ESPAÑA'] else str(country).strip().upper()
                parts.append(c_name)
            direccion_envio_str = " - ".join(parts)
        else:
            direccion_envio_str = albaran.get('Address2', '')

        # Contacto: CRD1.StreetNo / AddressExtension.ShipToStreetNo (>= 3 chars) > OCPR (CN.name por CNTCTCODE)
        street_no_crd1 = (dir_envio_crd1.get('StreetNo') if dir_envio_crd1 else '') or ''
        street_no_ext = (ext.get('ShipToStreetNo') or '')
        street_no = str(street_no_crd1 or street_no_ext or '').strip()

        contacto_obj = next((c for c in contact_employees if contact_person_code is not None and str(c.get('InternalCode')) == str(contact_person_code)), None)
        cn_name = contacto_obj.get('Name', '') if contacto_obj else (bp.get('ContactPerson', '') or '')
        cn_tel = (contacto_obj.get('Phone1') or contacto_obj.get('Tel1') or contacto_obj.get('MobilePhone', '')) if contacto_obj else (bp.get('Phone1', '') or '')

        contacto_final = street_no if len(street_no) >= 3 else cn_name

        # Teléfono: CRD1.BuildingFloorRoom / AddressExtension.ShipToBuilding (>= 3 chars) > OCPR (CN.Tel1)
        building_crd1 = (dir_envio_crd1.get('BuildingFloorRoom') if dir_envio_crd1 else '') or ''
        building_ext = (ext.get('ShipToBuilding') or '')
        building = str(building_crd1 or building_ext or '').strip()

        telefono_final = building if len(building) >= 3 else cn_tel

        # Horario: CRD1.U_MAC_Horario > AddressExtension.U_MAC_HorarioS
        horario_final = (dir_envio_crd1.get('U_MAC_Horario') if dir_envio_crd1 else '') or ext.get('U_MAC_HorarioS', '') or ext.get('U_MAC_Horario', '')

        # 3. DIRECCIÓN FISCAL (CRD1 AdresType = 'B' y Address = 'Domicilio')
        dir_fact_crd1 = next((a for a in bp_addresses if (str(a.get('AddressType')).endswith('BillTo') or a.get('AddressType') == 'B') and a.get('AddressName') == 'Domicilio'), None)
        if not dir_fact_crd1:
            dir_fact_crd1 = next((a for a in bp_addresses if (str(a.get('AddressType')).endswith('BillTo') or a.get('AddressType') == 'B')), None)

        if dir_fact_crd1 and dir_fact_crd1.get('Street'):
            f_street = dir_fact_crd1.get('Street', '').strip().upper()
            f_zip = dir_fact_crd1.get('ZipCode', '').strip()
            f_city = dir_fact_crd1.get('City', '').strip().upper()
            f_raw_state = dir_fact_crd1.get('State', '').strip()
            f_country = dir_fact_crd1.get('Country', 'ES').strip()

            f_state_obj = next((e for e in regiones if e.get('Code') == f_raw_state and e.get('Country') == f_country), None)
            f_state_name = f_state_obj.get('Name') if f_state_obj else f_raw_state

            parts_f = [f_street]
            city_p = f"{f_zip} {f_city}".strip()
            if city_p: parts_f.append(city_p)
            if f_state_name: parts_f.append(str(f_state_name).strip().upper())
            if f_country:
                c_n = "ESPAÑA" if str(f_country).strip().upper() in ['ES', 'ESPAÑA'] else str(f_country).strip().upper()
                parts_f.append(c_n)
            dir_factura_str = " - ".join(parts_f)
        else:
            dir_factura_str = albaran.get('Address', '')

        # Bultos desde U_MAC_OBSVSTOCK / U_MAC_ObsVSTOCK / NumberOfPackages / U_BULTOS (por defecto 1)
        raw_bultos = None
        for key in ['U_MAC_OBSVSTOCK', 'U_MAC_ObsVSTOCK', 'NumberOfPackages', 'U_BULTOS', 'U_MAC_Bultos']:
            val = albaran.get(key)
            if val is not None and str(val).strip() not in ['', '0']:
                raw_bultos = val
                break

        if raw_bultos is None:
            for k, v in albaran.items():
                if k.upper() in ['U_MAC_OBSVSTOCK', 'NUMBEROFPACKAGES', 'U_BULTOS', 'U_MAC_BULTOS'] and v is not None:
                    if str(v).strip() not in ['', '0']:
                        raw_bultos = v
                        break

        bultos_val = "1"
        if raw_bultos is not None and str(raw_bultos).strip():
            try:
                b_num = float(str(raw_bultos).strip())
                bultos_val = str(int(b_num)) if b_num.is_integer() else str(b_num)
            except ValueError:
                bultos_val = str(raw_bultos).strip()

        albaran['CabeceraCalculada'] = {
            'CardCode': card_code,
            'CardName': albaran.get('CardName', ''),
            'LicTradNum': lic_trad_num,
            'DirFactura': dir_factura_str,
            'NumDocCompleto': num_doc_completo,
            'NumAtCard': albaran.get('NumAtCard') or albaran.get('NUMATCARD') or albaran.get('REF_ALBARAN') or '',
            'ShipToCode': ship_to_code,
            'DireccionEnvio': direccion_envio_str,
            'Contacto': contacto_final,
            'Telefono': telefono_final,
            'Horario': horario_final,
            'Bultos': bultos_val
        }
        albaran['DirEnvioCalculada'] = albaran['CabeceraCalculada']
        AlbaranService._procesar_condiciones_pago(albaran, bp, master_session=master_session)

    @staticmethod
    def _procesar_condiciones_pago(albaran, bp, master_session=None):
        """
        Calcula las condiciones de pago (Forma de Pago, Vía de Pago, Domiciliación IBAN)
        consultando SAP Service Layer.
        """
        # 1. Forma de Pago + Días Fijos
        group_num = albaran.get('PaymentGroupCode') or albaran.get('PayTermsGrpCode') or bp.get('PayTermsGrpCode')
        forma_pago_str = ""
        if group_num is not None:
            try:
                res_p = SapRepository.get_data("PaymentTermsTypes", id=int(group_num), master_session=master_session)
                if res_p.get('status') == 'ok' and res_p.get('data'):
                    raw_p = res_p['data']
                    p_data = raw_p[0] if isinstance(raw_p, list) and len(raw_p) > 0 else raw_p
                    if isinstance(p_data, dict):
                        forma_pago_str = p_data.get('PaymentTermsGroupName') or p_data.get('GroupDescription') or ""
            except Exception:
                pass
        
        dias_fijos_list = []
        bp_payment_dates = bp.get('BPPaymentDates', [])
        for d in bp_payment_dates:
            p_date = d.get('PaymentTermsDate')
            if p_date:
                dias_fijos_list.append(str(p_date))
        
        if dias_fijos_list:
            dias_str = "Días Fijos: " + ", ".join(dias_fijos_list)
            forma_pago_str = f"{forma_pago_str} - {dias_str}" if forma_pago_str else dias_str

        # 2. Vía de Pago
        pay_meth = albaran.get('PaymentMethodCode') or albaran.get('PeymentMethodCode') or bp.get('PeymentMethodCode') or bp.get('PaymentMethodCode')
        via_pago_str = ""
        if pay_meth:
            try:
                res_m = SapRepository.get_data("WizardPaymentMethods", id=str(pay_meth), master_session=master_session)
                if res_m.get('status') == 'ok' and res_m.get('data'):
                    raw_m = res_m['data']
                    m_data = raw_m[0] if isinstance(raw_m, list) and len(raw_m) > 0 else raw_m
                    if isinstance(m_data, dict):
                        via_pago_str = m_data.get('Description') or m_data.get('PaymentMethodName') or str(pay_meth)
            except Exception:
                via_pago_str = str(pay_meth)

        # 3. Domiciliación IBAN
        iban_str = bp.get('HouseBankIBAN') or bp.get('IBAN') or bp.get('DFLIBAN') or ""
        if not iban_str and bp.get('DefaultBankCode') and bp.get('DefaultAccount'):
            bank = bp.get('DefaultBankCode', '')
            branch = bp.get('DefaultBranch', '')
            account = bp.get('DefaultAccount', '')
            iban_str = f"{bank} {branch} {account}"

        if iban_str and not iban_str.upper().startswith("IBAN"):
            iban_str = f"IBAN: {iban_str}"

        albaran['CondicionesPagoCalculadas'] = {
            'FormaPago': forma_pago_str or "CONTADO",
            'ViaPago': via_pago_str or "-",
            'Domiciliacion': iban_str or "-"
        }

    @staticmethod
    def generar_albaran(resource_albaran, doc_original, lineas, mapping_fields):
        """
        Genera un Albarán de Entrega (DeliveryNotes) en SAP a partir de las líneas confirmadas en NC_SGAWEB_DOCS.
        Gestiona el mapeo de ubicaciones bin, reparto de stock y series de documento.
        """
        fld_bin_from = mapping_fields.get('bin_from')
        fld_bin_to = mapping_fields.get('bin_to')

        ubicaciones = list({d[clave] for d in lineas for clave in (fld_bin_from, fld_bin_to) if clave in d and d[clave]})
        mapping_ubi = StockService.get_id_ubicaciones(lista_ubicaciones=ubicaciones)

        doc_original_lines_map = {line['LineNum']: line for line in doc_original.get('DocumentLines', []) if 'LineNum' in line}

        lineas_agrupadas = {}
        for idx, l in enumerate(lineas):
            qty = float(l.get('U_Quantity', 0) or 0)
            if qty <= 0:
                continue

            p_line = int(l.get('U_PedidoLine', idx))
            item_code_val = l.get('U_ItemCode')
            if p_line not in doc_original_lines_map and item_code_val:
                orig = next((line for line in doc_original.get('DocumentLines', []) if line.get('ItemCode') == item_code_val and line.get('LineStatus') != 'bost_Close'), None)
                if orig and 'LineNum' in orig:
                    p_line = int(orig['LineNum'])

            l['U_PedidoLine'] = p_line
            key = (l.get('U_PedidoEntry'), p_line, item_code_val)
            if key not in lineas_agrupadas:
                lineas_agrupadas[key] = copy.deepcopy(l)
                lineas_agrupadas[key]['U_Quantity'] = qty
                lineas_agrupadas[key]['_allocations'] = [copy.deepcopy(l)]
            else:
                lineas_agrupadas[key]['U_Quantity'] += qty
                lineas_agrupadas[key]['_allocations'].append(copy.deepcopy(l))

        lineas = list(lineas_agrupadas.values())
        albaran_payload = {}
        payload_lines = []

        for idx, linea in enumerate(lineas):
            pedido_line_num = int(linea.get('U_PedidoLine', idx))
            item_code_val = linea.get('U_ItemCode')
            original_line = doc_original_lines_map.get(pedido_line_num, {})

            ctd_preparada = float(linea.get('U_Quantity', 0) or 0)
            if ctd_preparada <= 0:
                continue

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
            dist_num = linea.get('dist_number') or linea.get('U_DistNumber') or linea.get('serial_number') or linea.get('batch_number')

            allocations_list = linea.get('_allocations', [linea])
            if len(allocations_list) > 1:
                for alloc_entry in allocations_list:
                    a_bin_code = alloc_entry.get('U_BinFrom') or alloc_entry.get('U_BinTo')
                    a_qty = float(alloc_entry.get('U_Quantity', 0) or 0)
                    a_abs = mapping_ubi.get(a_bin_code)
                    if a_abs and a_qty > 0:
                        alloc_item = {
                            "BinAbsEntry": int(a_abs),
                            "Quantity": a_qty,
                            "BaseLineNumber": len(payload_lines)
                        }
                        if dist_num:
                            alloc_item["SerialAndBatchNumbersBaseLine"] = 0
                        bin_payload.append(alloc_item)
            elif bin_def and ctd_preparada > 0:
                res_stock_all = SapRepository.get_data_from_view(
                    view_name="NC_STOCK_UBICACION_B1SLQuery",
                    filter={"ItemCode": item_code_val, "WhsCode": bin_whs or '01'},
                    all_results=True
                )
                stock_by_bin = {}
                if res_stock_all.get('status') == 'ok' and res_stock_all.get('data'):
                    for row_st in res_stock_all['data']:
                        b_abs = row_st.get('BinAbs')
                        b_qty = float(row_st.get('BINQTY', 0) or 0)
                        if b_abs and b_qty > 0:
                            stock_by_bin[int(b_abs)] = stock_by_bin.get(int(b_abs), 0) + b_qty

                qty_needed = float(ctd_preparada)
                primary_abs = int(bin_def)
                primary_available = stock_by_bin.get(primary_abs, 0)

                if primary_available >= qty_needed or not stock_by_bin:
                    alloc = {
                        "BinAbsEntry": primary_abs,
                        "Quantity": qty_needed,
                        "BaseLineNumber": len(payload_lines)
                    }
                    if dist_num:
                        alloc["SerialAndBatchNumbersBaseLine"] = 0
                    bin_payload = [alloc]
                else:
                    allocated_so_far = 0.0
                    if primary_available > 0:
                        alloc = {
                            "BinAbsEntry": primary_abs,
                            "Quantity": primary_available,
                            "BaseLineNumber": len(payload_lines)
                        }
                        if dist_num:
                            alloc["SerialAndBatchNumbersBaseLine"] = 0
                        bin_payload.append(alloc)
                        allocated_so_far += primary_available

                    rem_needed = qty_needed - allocated_so_far
                    for other_abs, other_qty in stock_by_bin.items():
                        if other_abs == primary_abs or other_qty <= 0:
                            continue
                        take_qty = min(rem_needed, other_qty)
                        if take_qty > 0:
                            alloc_extra = {
                                "BinAbsEntry": other_abs,
                                "Quantity": take_qty,
                                "BaseLineNumber": len(payload_lines)
                            }
                            if dist_num:
                                alloc_extra["SerialAndBatchNumbersBaseLine"] = 0
                            bin_payload.append(alloc_extra)
                            rem_needed -= take_qty
                            if rem_needed <= 0:
                                break

                    if not bin_payload:
                        bin_payload = [{
                            "BinAbsEntry": primary_abs,
                            "Quantity": qty_needed,
                            "BaseLineNumber": len(payload_lines)
                        }]

            nueva_linea = {
                'ItemCode': original_line.get('ItemCode') or linea.get('U_ItemCode'),
                'Quantity': float(ctd_preparada),
                "BaseType": int(linea.get("U_ObjType", 17)),
                "BaseEntry": int(linea.get("U_PedidoEntry")),
                "BaseLine": pedido_line_num
            }

            if bin_whs:
                nueva_linea['WarehouseCode'] = bin_whs

            if bin_payload:
                nueva_linea['DocumentLinesBinAllocations'] = bin_payload

            if dist_num:
                nueva_linea["SerialNumbers"] = [{
                    "InternalSerialNumber": str(dist_num).strip(),
                    "Quantity": 1
                }]

            payload_lines.append(nueva_linea)

        albaran_payload['DocumentLines'] = payload_lines

        campos_necesarios = ["CardCode", "ShipToCode", "PayToCode", "SalesPersonCode", "Comments"]
        for clave, valor in doc_original.items():
            if clave.startswith('U_') or clave in campos_necesarios:
                if clave == "U_BXPEmpID":
                    albaran_payload[clave] = session.get('sap_employee_id', valor)
                else:
                    albaran_payload[clave] = copy.deepcopy(valor)

        res_series = SapSeriesMapper.resolve_series_by_user_or_order(doc_original, dst_obj_type=15)
        if res_series and res_series.get('dst_series_id'):
            albaran_payload['Series'] = int(res_series['dst_series_id'])
        else:
            albaran_payload.pop('Series', None)

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

    @staticmethod
    def generar_pdf_bytes(albaran):
        """
        Genera el buffer de bytes del PDF del albarán procesando HTML/CSS con WeasyPrint de forma modular.
        """
        try:
            from app.document_generators import AlbaranDocGenerator
            return AlbaranDocGenerator.generate_pdf_bytes(albaran)
        except Exception as e:
            current_app.logger.error(f"Error generando PDF de Albarán: {e}")
            raise Exception(f"Error generando documento PDF de albarán: {str(e)}")

    @staticmethod
    def imprimir_albaran(docentry, copies=1):
        """
        Genera el PDF del albarán y lo envía a imprimir a la impresora PDF configurada.
        """
        try:
            albaran = AlbaranService.get_albaran_detalle(docentry)
            pdf_bytes = AlbaranService.generar_pdf_bytes(albaran)

            for _ in range(max(1, copies)):
                success, msg = print_handler.send_pdf_to_printer(pdf_bytes)
                if not success:
                    return False, f"Fallo al enviar a impresora PDF: {msg}"

            return True, f"Albarán #{docentry} enviado a imprimir ({copies} copia/s)."
        except Exception as e:
            return False, f"Error imprimiendo albarán #{docentry}: {str(e)}"
