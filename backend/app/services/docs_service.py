from collections import defaultdict
import json
import copy
from flask import jsonify, session
from app.data.sap_repository import SapRepository
from app.services.stock_service import StockService
from app.utils.extensions import notify_sap_update

class DocsService:
    """
    Servicio de Gestión de Documentos (Pedidos de Venta, Solicitudes de Traslado, Compras).
    Incluye la lógica para "Semi Preparar" stock, recuentos de inventario y traslados con notificaciones WebSocket en tiempo real.
    """

    @staticmethod
    def get_documentos(objtype, page=1, per_page=20, filters=None, ver_inactivos=False):
        sap_filter = DocsService._build_docs_filter(filters or {}, objtype=objtype, ver_inactivos=ver_inactivos)
        
        result = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
            orderby="DOCDATE",
            order_direction="desc",
            filter=sap_filter,
            page=page,
            per_page=per_page
        )
        
        if result.get('status') == 'ok' and result.get('count', 0) == 0:
            return {'pedidos': []}
        
        docentries = [x['DOCENTRY'] for x in result.get('data', [])]
        lineas = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_POS_B1SLQuery",
            filter={"DOCENTRY__in": docentries, "OBJTYPE": objtype},
            all_results=True
        )

        if result.get('status') != 'ok' or lineas.get('status') != 'ok':
            raise Exception(f"SAP query failed: {result.get('message')}")
        
        cabeceras = result.get('data', [])
        lineas_data = lineas.get('data', [])
        lineas_por_docentry = defaultdict(list)

        for linea in lineas_data:
            lineas_por_docentry[linea["DOCENTRY"]].append(linea)

        for cabecera in cabeceras:
            lineas_filtradas = lineas_por_docentry.get(cabecera["DOCENTRY"], [])
            cabecera["LINEAS"] = lineas_filtradas
            cabecera['CUENTA_DISPONIBLE'] = sum(1 for linea in lineas_filtradas if str(linea.get('STOCK_OK', '')).upper() == 'OK')
            
            fully_prep = 0
            part_prep = 0
            for linea in lineas_filtradas:
                q_req = float(linea.get('QUANTITY') or linea.get('Quantity') or 0)
                q_prep = float(linea.get('CTD_PREPARADA') or 0)
                if q_req > 0 and q_prep >= q_req:
                    fully_prep += 1
                elif q_prep > 0:
                    part_prep += 1

            cabecera['CUENTA_PREPARADO'] = fully_prep
            if part_prep > 0 or (fully_prep > 0 and fully_prep < len(lineas_filtradas)):
                cabecera['IS_SEMI_PREPARADO'] = True
            elif fully_prep == len(lineas_filtradas) and len(lineas_filtradas) > 0 and part_prep == 0:
                cabecera['IS_COMPLETAMENTE_PREPARADO'] = True

        if docentries and str(objtype) in ["17", "22", "15", "1250000001"]:
            try:
                resource_map = {
                    "17": "Orders",
                    "22": "PurchaseOrders",
                    "15": "DeliveryNotes",
                    "1250000001": "InventoryTransferRequests"
                }
                res_name = resource_map.get(str(objtype), "Orders")
                doc_res = SapRepository.get_data(
                    resource=res_name,
                    filter={"DocEntry__in": docentries},
                    all_results=True
                )
                if doc_res.get('status') == 'ok' and doc_res.get('data'):
                    text_lines_by_doc = {}
                    lines_by_doc = {}
                    for doc_item in doc_res['data']:
                        de = doc_item.get("DocEntry")
                        t_list = DocsService._extract_texto_lineas_doc(doc_item)
                        if t_list:
                            text_lines_by_doc[de] = t_list
                        lines_by_doc[de] = doc_item.get("DocumentLines", [])

                    for cabecera in cabeceras:
                        de = cabecera.get("DOCENTRY")
                        if de in text_lines_by_doc and text_lines_by_doc[de]:
                            cabecera["TEXTO_LINEAS"] = text_lines_by_doc[de]
                            cabecera["PRIMERA_LINEA_TEXTO"] = text_lines_by_doc[de][0]
                        
                        # Fallback de líneas si la vista POS vino vacía
                        if not cabecera.get("LINEAS") and de in lines_by_doc:
                            raw_lines = lines_by_doc[de]
                            cabecera["LINEAS"] = raw_lines
                            if not cabecera.get('CUENTA_DISPONIBLE'):
                                cabecera['CUENTA_DISPONIBLE'] = len(raw_lines)
            except Exception as ex:
                pass

        # Consultar estado de preparación en @NC_SGAWEB_DOCS (todas las líneas abiertas 'O')
        try:
            res_sga_docs = SapRepository.get_data(
                resource="NC_SGAWEB_DOCS",
                filter={"U_Estado": "O"},
                selection=["DocEntry", "U_PedidoEntry", "U_PedidoLine", "U_ItemCode", "U_Quantity", "U_Semi", "U_Estado"],
                all_results=True
            )
            if res_sga_docs.get('status') == 'ok' and res_sga_docs.get('data'):
                prep_by_entry = defaultdict(list)
                for r in res_sga_docs['data']:
                    pe_str = str(r.get('U_PedidoEntry') or '').strip()
                    if pe_str:
                        prep_by_entry[pe_str].append(r)
                        pe_clean = pe_str.lstrip('0')
                        if pe_clean and pe_clean != pe_str:
                            prep_by_entry[pe_clean].append(r)

                for cabecera in cabeceras:
                    de_str = str(cabecera.get("DOCENTRY") or '').strip()
                    dn_str = str(cabecera.get("DOCNUM") or '').strip()
                    
                    raw_lines = prep_by_entry.get(de_str, []) + prep_by_entry.get(dn_str, [])
                    seen_ids = set()
                    sga_lines = []
                    for line in raw_lines:
                        l_id = line.get('DocEntry')
                        if l_id and l_id not in seen_ids:
                            seen_ids.add(l_id)
                            sga_lines.append(line)
                        elif not l_id:
                            sga_lines.append(line)

                    if sga_lines:
                        has_semi = any(str(r.get('U_Semi', '')).upper() == 'Y' for r in sga_lines)
                        
                        # Agrupar cantidades preparadas por línea y artículo
                        prep_qty_by_line = defaultdict(float)
                        for r in sga_lines:
                            line_key = (r.get('U_PedidoLine'), str(r.get('U_ItemCode', '')).strip().upper())
                            prep_qty_by_line[line_key] += float(r.get('U_Quantity', 0) or 0)

                        order_lines = cabecera.get("LINEAS", [])
                        total_lines_count = len(order_lines)
                        fully_prep_count = 0
                        partially_prep_count = 0

                        for l in order_lines:
                            l_num = l.get('LineNum') or l.get('LINENUM') or l.get('LINE_NUM')
                            l_item = str(l.get('ItemCode') or l.get('ITEMCODE') or '').strip().upper()
                            req_q = float(l.get('Quantity') or l.get('QUANTITY') or 0)
                            
                            prep_q = prep_qty_by_line.get((l_num, l_item), 0)
                            if prep_q <= 0:
                                prep_q = sum(v for k, v in prep_qty_by_line.items() if k[1] == l_item)

                            if req_q > 0 and prep_q >= req_q:
                                fully_prep_count += 1
                            elif prep_q > 0:
                                partially_prep_count += 1

                        total_prep_qty = sum(prep_qty_by_line.values())
                        if has_semi or partially_prep_count > 0 or (fully_prep_count > 0 and fully_prep_count < total_lines_count) or (fully_prep_count == 0 and total_prep_qty > 0):
                            cabecera['IS_SEMI_PREPARADO'] = True
                            cabecera['IS_COMPLETAMENTE_PREPARADO'] = False
                        elif fully_prep_count == total_lines_count and total_lines_count > 0 and partially_prep_count == 0:
                            cabecera['IS_COMPLETAMENTE_PREPARADO'] = True
                            cabecera['IS_SEMI_PREPARADO'] = False

                        cabecera['CUENTA_PREPARADO'] = fully_prep_count
        except Exception:
            pass

        total_count = result.get('count', 0)
        total_pages = (total_count + per_page - 1) // per_page if per_page else 1
        
        return {
            'pedidos': cabeceras,
            'total_count': total_count,
            'total_pages': total_pages,
            'page': page
        }

    @staticmethod
    def _extract_texto_lineas_doc(doc_item):
        textos = []

        # 1. Líneas especiales de texto (DocumentSpecialLines / RDR10)
        for sp in doc_item.get("DocumentSpecialLines", []):
            txt = (sp.get("LineText") or sp.get("FreeText") or "").strip()
            if txt and txt not in textos:
                textos.append(txt)

        # 2. Líneas de detalle de texto (DocumentLines / RDR1)
        for dl in doc_item.get("DocumentLines", []):
            if dl.get("LineType") in ["dlt_Text", "dslt_Text"] or not dl.get("ItemCode"):
                txt = (dl.get("LineText") or dl.get("FreeText") or dl.get("Text") or dl.get("ItemDescription") or "").strip()
                if txt and txt not in textos:
                    textos.append(txt)

        # 3. Dirección de envío si no es genérica
        if not textos:
            ship_to = (doc_item.get("ShipToCode") or "").strip()
            if ship_to and ship_to.upper() not in ["ENVIO", "ENVÍO", "SHIPTO", "PRINCIPAL", "DEFAULT", "0", "1", ""]:
                textos.append(ship_to)

        return textos

    @staticmethod
    def _build_docs_filter(filters, objtype, ver_inactivos=False):
        sap_filter = {"OBJTYPE": str(objtype)}
        if str(objtype) == "17" and not ver_inactivos:
            sap_filter["U_NC_INC_PRDMX"] = "Y"
        
        if ver_inactivos:
            sap_filter["U_NC_INC_PRDMX"] = "N"

        if filters.get('docnum'):
            val = str(filters['docnum']).replace('#', '').strip()
            if val.isdigit():
                sap_filter["DOCNUM"] = int(val)

        if filters.get('cliente'):
            c_val = str(filters['cliente']).strip()
            if ' - ' in c_val:
                code_part = c_val.split(' - ')[0].strip()
                sap_filter["CARDCODE"] = code_part
            else:
                sap_filter["CARDNAME__contains"] = c_val

        if filters.get('tipo_venta'):
            sap_filter["TIPOVENTA"] = filters['tipo_venta']

        return sap_filter

    @staticmethod
    def get_detalle_documento(page=1, per_page=20, filters=None):
        sap_filter = {}
        if filters.get('docentry'):
            sap_filter["DOCENTRY"] = int(filters['docentry'])
        if filters.get('objtype'):
            sap_filter["OBJTYPE"] = str(filters['objtype'])
        if filters.get('itemcode'):
            sap_filter["ITEMCODE__contains"] = str(filters['itemcode'])

        result = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_POS_B1SLQuery",
            filter=sap_filter,
            all_results=True
        )

        data = result.get('data', []) if result.get('status') == 'ok' else []
        if not data and filters.get('docentry'):
            try:
                sap_filter_dn = {"DOCNUM": int(filters['docentry'])}
                if filters.get('objtype'):
                    sap_filter_dn["OBJTYPE"] = str(filters['objtype'])
                result_dn = SapRepository.get_data_from_view(
                    view_name="NC_SGA_SOLICITUDES_POS_B1SLQuery",
                    filter=sap_filter_dn,
                    all_results=True
                )
                if result_dn.get('status') == 'ok' and result_dn.get('data'):
                    data = result_dn['data']
            except Exception:
                pass
        for row in data:
            if row.get('UBICACIONES'):
                if isinstance(row['UBICACIONES'], str):
                    try:
                        row['UBICACIONES'] = json.loads(row['UBICACIONES'])
                    except Exception:
                        row['UBICACIONES'] = []
            else:
                row['UBICACIONES'] = []

        # Si el documento es un Pedido de Compra (OBJTYPE == '22'), adjuntar las necesidades/solicitudes de stock
        objtype_filter = str(filters.get('objtype', '')) if filters else ''
        first_objtype = str(data[0].get('OBJTYPE', '')) if data and data[0].get('OBJTYPE') else ''
        if objtype_filter == '22' or first_objtype == '22':
            from app.services.product_service import ProductService
            unique_items = {str(row.get('ITEMCODE')).strip() for row in data if row.get('ITEMCODE')}
            calls_map = {}
            for item in unique_items:
                try:
                    res_calls = ProductService.get_product_calls(item)
                    calls_map[item] = res_calls.get("calls", [])
                except Exception as ex:
                    print(f"[DocsService] Error al obtener necesidades para item {item}: {ex}")
                    calls_map[item] = []
            for row in data:
                item_code = str(row.get('ITEMCODE', '')).strip()
                row['NECESIDADES'] = calls_map.get(item_code, [])

        return {
            'info': data,
            'lineas': data,
            'total_count': len(data)
        }

    @staticmethod
    def semipreparar_stock(docentry, target_bin=None, lineas_prep=None):
        res_cab = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
            filter={"DOCENTRY": int(docentry)}
        )
        if not (res_cab.get('status') == 'ok' and res_cab.get('data')):
            res_cab = SapRepository.get_data_from_view(
                view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
                filter={"DOCNUM": int(docentry)}
            )

        if not (res_cab.get('status') == 'ok' and res_cab.get('data')):
            # Comprobar si el pedido existe pero ya está cerrado
            doc_chk = SapRepository.get_data(resource="Orders", id=int(docentry))
            if doc_chk.get('status') == 'ok' and doc_chk.get('data'):
                if doc_chk['data'][0].get('DocumentStatus') == 'bost_Close':
                    return jsonify({"status": "error", "message": f"El pedido #{docentry} ya se encuentra CERRADO o entregado en SAP. No se puede semi-preparar."}), 400
            return jsonify({"status": "error", "message": f"No se encontró el pedido abierto #{docentry} en SAP"}), 404

        cabecera = res_cab['data'][0]
        actual_docentry = cabecera.get('DOCENTRY', docentry)
        obj_type = str(cabecera.get('OBJTYPE', 17))
        res_pos = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_POS_B1SLQuery",
            filter={"DOCENTRY": int(actual_docentry), "OBJTYPE": obj_type},
            all_results=True
        )

        if res_pos.get('status') != 'ok' or not res_pos.get('data'):
            return jsonify({"status": "error", "message": f"No se encontraron líneas para semi-preparar en el pedido #{actual_docentry}"}), 404

        lineas = res_pos['data']

        if lineas_prep and isinstance(lineas_prep, list):
            qty_by_item = {str(x['itemcode']).strip().upper(): float(x.get('quantity', 0)) for x in lineas_prep if 'itemcode' in x}
            lineas = [l for l in lineas if qty_by_item.get(str(l.get('ITEMCODE')).strip().upper(), 0) > 0]
            for l in lineas:
                item_code = str(l.get('ITEMCODE')).strip().upper()
                if item_code in qty_by_item:
                    # CTD_PREPARADA es el campo que lee _ejecutar_traslado_lineas
                    l['CTD_PREPARADA'] = qty_by_item[item_code]

        # Asegurar que cada línea tenga una ubicación de origen válida con existencias
        for l in lineas:
            ubis = l.get('UBICACIONES')
            if ubis:
                if isinstance(ubis, str):
                    try:
                        ubis = json.loads(ubis)
                    except Exception:
                        ubis = []
                if isinstance(ubis, list) and len(ubis) > 0:
                    ubi_con_stock = next((u for u in ubis if float(u.get('onhandqty', 0) or u.get('BINQTY', 0) or 0) > 0), ubis[0])
                    b_code = ubi_con_stock.get('bincode') or ubi_con_stock.get('BinCode')
                    if b_code:
                        l['BIN_STD'] = b_code

        mapping_fields = {
            '17': {'bin_from': 'BIN_STD', 'bin_to': 'BIN_SEMI'},
            '1250000001': {'bin_from': 'BIN_SEMI', 'bin_to': 'BIN_STD'},
            '22': {'bin_from': 'BIN_STD', 'bin_to': 'BIN_SEMI'}
        }.get(obj_type, {'bin_from': 'BIN_STD', 'bin_to': 'BIN_SEMI'})

        dest_bin = str(target_bin or '01-PDTE').strip().toUpperCase() if hasattr(target_bin, 'toUpperCase') else str(target_bin or '01-PDTE').strip().upper()
        for l in lineas:
            l['BIN_SEMI'] = dest_bin

        doc_original = SapRepository.get_data(resource="Orders", id=int(actual_docentry))
        if doc_original.get('status') != 'ok' or not doc_original.get('data'):
            return jsonify({"status": "error", "message": f"No se pudo consultar el pedido #{actual_docentry} en SAP"}), 404

        doc_original_data = doc_original['data'][0]
        response = DocsService._ejecutar_traslado_lineas(lineas, mapping_fields, doc_original_data, obj_type, is_linked=False)

        # Si el traslado de stock en SAP tuvo éxito, registrar las líneas semipreparadas en NC_SGAWEB_DOCS (Estado 'O')
        res_data = response[0].get_json() if isinstance(response, tuple) else response.get_json()
        if res_data and res_data.get('status') == 'ok':
            for index, l in enumerate(lineas):
                ctd = float(l.get('CTD_PREPARADA', 0) or l.get('QUANTITY', 0) or 0)
                if ctd > 0:
                    line_num = l.get('LINENUM') if l.get('LINENUM') is not None else (l.get('LINE_NUM') if l.get('LINE_NUM') is not None else index)
                    ubi_destino = target_bin or l.get('BIN_SEMI') or l.get('BIN_STD')
                    try:
                        DocsService.confirmar_mov_stock({
                            'U_PedidoEntry': int(docentry),
                            'U_PedidoLine': int(line_num),
                            'U_ItemCode': l.get('ITEMCODE'),
                            'U_Quantity': ctd,
                            'U_BinFrom': ubi_destino,
                            'U_ObjType': str(obj_type),
                            'U_Estado': 'O'
                        })
                    except Exception:
                        pass

        # Transmitir evento WebSocket a todos los clientes conectados
        notify_sap_update(event_type="semipreparar", details={"docentry": docentry, "objtype": obj_type, "target_bin": target_bin})
        return response

    @staticmethod
    def get_lineas_preparadas(docentry):
        """
        Devuelve las líneas de preparación confirmadas en NC_SGAWEB_DOCS para un pedido dado.
        Agrupa por línea de pedido (U_PedidoLine) y suma las cantidades confirmadas.
        """
        entries_to_check = set()
        try:
            entries_to_check.add(int(docentry))
        except (ValueError, TypeError):
            pass

        try:
            # Buscar en la vista de cabeceras para resolver tanto DocEntry como DocNum
            cab_res = SapRepository.get_data_from_view(
                view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
                filter={"DOCENTRY": int(docentry)}
            )
            if not (cab_res.get('status') == 'ok' and cab_res.get('data')):
                cab_res = SapRepository.get_data_from_view(
                    view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
                    filter={"DOCNUM": int(docentry)}
                )

            if cab_res.get('status') == 'ok' and cab_res.get('data'):
                for cab in cab_res['data']:
                    if cab.get('DOCENTRY') is not None:
                        try:
                            entries_to_check.add(int(cab['DOCENTRY']))
                        except Exception:
                            pass
                    if cab.get('DOCNUM') is not None:
                        try:
                            entries_to_check.add(int(cab['DOCNUM']))
                        except Exception:
                            pass
        except Exception:
            pass

        lineas = []
        # Campos estrictamente válidos en la tabla @NC_SGAWEB_DOCS de SAP
        VALID_SELECTION = [
            "DocEntry", "U_PedidoEntry", "U_PedidoLine", "U_ItemCode",
            "U_Quantity", "U_BinFrom", "U_BinTo", "U_ObjType", "U_Estado", "U_Semi"
        ]
        for val in entries_to_check:
            try:
                res = SapRepository.get_data(
                    resource="NC_SGAWEB_DOCS",
                    selection=VALID_SELECTION,
                    filter={"U_PedidoEntry": int(val), "U_Estado": "O"},
                    all_results=True
                )
                if res.get('status') == 'ok' and res.get('data'):
                    lineas.extend(res['data'])
            except Exception:
                pass

        if not lineas:
            return []

        # Preservar cada tramo de ubicación para soporte multi-ubicación
        agrupadas = {}
        for l in lineas:
            b_from = str(l.get('U_BinFrom') or '').strip()
            key = (l.get('U_PedidoLine'), str(l.get('U_ItemCode') or '').strip().upper(), b_from)
            if key not in agrupadas:
                agrupadas[key] = copy.deepcopy(l)
                agrupadas[key]['U_Quantity'] = float(l.get('U_Quantity') or 0)
            else:
                agrupadas[key]['U_Quantity'] += float(l.get('U_Quantity') or 0)

        return list(agrupadas.values())

    @staticmethod
    def finalizar_preparacion(objtype, docentry, parcial=False):
        """
        Finaliza la preparación de un pedido generando el Albarán de Entrega (DeliveryNotes) en SAP.
        - parcial=True: genera albarán SOLO con las líneas confirmadas en NC_SGAWEB_DOCS
        - parcial=False: genera albarán con las líneas confirmadas en NC_SGAWEB_DOCS o con todas las del pedido si no hay confirmadas
        """
        from app.services.albaran_service import AlbaranService

        # Obtener el pedido original de SAP para campos de cabecera y líneas
        doc_original = SapRepository.get_data(resource="Orders", id=int(docentry))
        if doc_original.get('status') != 'ok' or not doc_original.get('data'):
            return jsonify({"status": "error", "message": f"No se pudo consultar el pedido #{docentry} en SAP"}), 404

        doc_original_data = doc_original['data'][0]

        if doc_original_data.get('DocumentStatus') == 'bost_Close' or doc_original_data.get('Cancelled') == 'tYES':
            lineas_preparadas = DocsService.get_lineas_preparadas(docentry)
            for row in lineas_preparadas:
                if 'DocEntry' in row:
                    SapRepository.update(resource="NC_SGAWEB_DOCS", id=row['DocEntry'], payload={"U_Estado": 'C'})
            notify_sap_update(event_type="finalizar", details={"docentry": int(docentry), "objtype": str(objtype)})
            return jsonify({"status": "error", "message": f"El pedido #{docentry} ya está CERRADO o entregado en SAP. El estado en SGA se ha actualizado."}), 400

        lineas_preparadas = DocsService.get_lineas_preparadas(docentry)

        if parcial:
            if not lineas_preparadas:
                return jsonify({"status": "error",
                                "message": "No hay líneas confirmadas para este pedido. Confirma al menos una línea antes de finalizar parcialmente."}), 400
            lineas_a_procesar = lineas_preparadas
        else:
            # Si no es parcial, usamos las líneas preparadas si existen, o todas las del pedido si aún no se escaneó ninguna
            if lineas_preparadas:
                lineas_a_procesar = lineas_preparadas
            else:
                lineas_a_procesar = []
                for line in doc_original_data.get('DocumentLines', []):
                    lineas_a_procesar.append({
                        'U_PedidoEntry': int(docentry),
                        'U_PedidoLine': line.get('LineNum', 0),
                        'U_ItemCode': line.get('ItemCode'),
                        'U_Quantity': float(line.get('Quantity', 0) or 0),
                        'U_ObjType': str(objtype)
                    })

        mapping_fields = {'bin_from': 'U_BinFrom', 'bin_to': 'U_BinFrom'}

        res_albaran = AlbaranService.generar_albaran(
            resource_albaran="DeliveryNotes",
            doc_original=doc_original_data,
            lineas=lineas_a_procesar,
            mapping_fields=mapping_fields
        )

        res_data = res_albaran[0].get_json() if isinstance(res_albaran, tuple) else res_albaran.get_json()
        if res_data and res_data.get('status') == 'ok':
            # Cerrar las líneas confirmadas en NC_SGAWEB_DOCS
            for row in lineas_preparadas:
                if 'DocEntry' in row:
                    try:
                        SapRepository.update(resource="NC_SGAWEB_DOCS", id=row['DocEntry'], payload={"U_Estado": 'C'})
                    except Exception:
                        pass

        notify_sap_update(event_type="finalizar", details={"docentry": int(docentry), "objtype": str(objtype), "parcial": parcial})
        return res_albaran

    @staticmethod
    def activar_pedido(docentry):
        if not docentry:
            raise ValueError("Falta el docentry para poder activar el pedido")
        res = SapRepository.update(resource="Orders", id=int(docentry), payload={"U_NC_INC_PRDMX": 'Y'})
        if res.status_code == 204:
            notify_sap_update(event_type="order_status", details={"docentry": docentry, "active": True})
            return True, "Pedido activado correctamente"
        else:
            err_msg = SapRepository.parse_sap_error(res)
            raise Exception(f"No se pudo activar el pedido: {err_msg}")

    @staticmethod
    def desactivar_pedido(docentry):
        if not docentry:
            raise ValueError("Falta el docentry para poder desactivar el pedido")
        res = SapRepository.update(resource="Orders", id=int(docentry), payload={"U_NC_INC_PRDMX": 'N'})
        if res.status_code == 204:
            notify_sap_update(event_type="order_status", details={"docentry": docentry, "active": False})
            return True, "Pedido desactivado correctamente"
        else:
            err_msg = SapRepository.parse_sap_error(res)
            raise Exception(f"No se pudo desactivar el pedido: {err_msg}")

    @staticmethod
    def confirmar_mov_stock(data):
        # Campos válidos en @NC_SGAWEB_DOCS (verificado contra SAP)
        CAMPOS_VALIDOS = {
            'U_ItemCode', 'U_BinFrom', 'U_BinTo', 'U_WhsCode',
            'U_Llamada', 'U_PedidoEntry', 'U_PedidoLine',
            'U_Estado', 'U_Quantity', 'U_ObjType', 'U_Traslado',
            'U_DistNumber'
        }

        qty = float(data.get('U_Quantity', 0) or 0)
        if qty <= 0:
            raise ValueError("Por favor, introduce una cantidad válida mayor que cero.")

        bin_from = data.get('U_BinFrom')
        item_code = data.get('U_ItemCode')
        pedido_entry = data.get('U_PedidoEntry')
        pedido_line = data.get('U_PedidoLine')

        if bin_from and item_code:
            check_ubi = StockService.ubicacion_existe(bin_from, itemcode=item_code, min_qty=qty)
            if not check_ubi.get('existe', True):
                raise ValueError(f"La ubicación {bin_from} no existe en SAP.")

            if not check_ubi.get('stock_suficiente', False):
                # Si la ubicación seleccionada sola no llega a la cantidad total (ej. 01-PDTE tiene 6 y se piden 12),
                # comprobar si la suma total de existencias en el almacén cubre la cantidad pedida.
                res_whs = SapRepository.get_data_from_view(
                    view_name="NC_STOCK_UBICACION_B1SLQuery",
                    filter={"ItemCode": item_code, "WhsCode": data.get('U_WhsCode', '01')},
                    all_results=True
                )
                total_whs = sum(float(x.get('BINQTY', 0) or 0) for x in res_whs.get('data', []))
                if total_whs < qty:
                    disp = check_ubi.get('stock_disponible', 0)
                    disp_fmt = int(disp) if isinstance(disp, float) and disp.is_integer() else disp
                    raise ValueError(f"Stock total insuficiente para {item_code} en almacén (Disponible en {bin_from}: {disp_fmt} u., Total Almacén: {int(total_whs)} u.).")

        bin_allocs = data.get('U_BinAllocations')
        if bin_allocs and isinstance(bin_allocs, list) and len(bin_allocs) > 0:
            # 1. Limpiar registros previos abiertos para esta línea de pedido
            if pedido_entry is not None and pedido_line is not None:
                try:
                    DocsService.borrar_preparacion_stock({
                        "U_PedidoEntry": int(pedido_entry),
                        "U_PedidoLine": int(pedido_line),
                        "U_Estado": "O"
                    })
                except Exception:
                    pass

            # 2. Insertar cada tramo de ubicación explícitamente seleccionado por el operario
            for alloc in bin_allocs:
                sub_qty = float(alloc.get('quantity', 0) or 0)
                sub_bin = str(alloc.get('bincode', '')).strip()
                if sub_qty > 0 and sub_bin:
                    sub_payload = {k: v for k, v in data.items() if k in CAMPOS_VALIDOS}
                    sub_payload['U_Estado'] = 'O'
                    sub_payload['U_BinFrom'] = sub_bin[:20]
                    sub_payload['U_Quantity'] = sub_qty
                    SapRepository.post(resource="NC_SGAWEB_DOCS", payload=sub_payload)

            return True, f"Reparto multi-ubicación registrado ({len(bin_allocs)} ubicaciones asignadas)"

        payload = {k: v for k, v in data.items() if k in CAMPOS_VALIDOS}
        payload['U_Estado'] = payload.get('U_Estado', 'O')
        if payload.get('U_BinFrom'):
            payload['U_BinFrom'] = str(payload['U_BinFrom'])[:20]
        if payload.get('U_BinTo'):
            payload['U_BinTo'] = str(payload['U_BinTo'])[:20]

        # Buscar si ya existe un registro abierto en NC_SGAWEB_DOCS para esta misma línea de pedido
        if pedido_entry is not None and pedido_line is not None:
            filter_existing = {
                "U_PedidoEntry": int(pedido_entry),
                "U_PedidoLine": int(pedido_line),
                "U_Estado": "O"
            }
            existing_res = SapRepository.get_data(resource="NC_SGAWEB_DOCS", selection=["DocEntry"], filter=filter_existing)
            if not (existing_res.get('status') == 'ok' and existing_res.get('data')):
                filter_existing["U_PedidoEntry"] = str(pedido_entry)
                existing_res = SapRepository.get_data(resource="NC_SGAWEB_DOCS", selection=["DocEntry"], filter=filter_existing)

            if existing_res.get('status') == 'ok' and existing_res.get('data'):
                # Actualizar (UPSERT) la línea existente en lugar de insertar duplicados
                doc_entry_to_update = existing_res['data'][0]['DocEntry']
                res = SapRepository.update(resource="NC_SGAWEB_DOCS", id=doc_entry_to_update, payload=payload)
                if res.status_code in (200, 204):
                    return True, "Línea de preparación actualizada correctamente"
                else:
                    err_msg = SapRepository.parse_sap_error(res)
                    raise Exception(f"Error actualizando línea en NC_SGAWEB_DOCS: {err_msg}")

        # Si no existía línea abierta previa, crearla
        res = SapRepository.post(resource="NC_SGAWEB_DOCS", payload=payload)
        if res.status_code == 201:
            return True, "Línea de preparación registrada correctamente"
        else:
            err_msg = SapRepository.parse_sap_error(res)
            raise Exception(f"Error registrando movimiento en NC_SGAWEB_DOCS: {err_msg}")

    @staticmethod
    def borrar_preparacion_stock(filter_payload):
        docentries = SapRepository.get_data(resource="NC_SGAWEB_DOCS", selection=["DocEntry"], filter=filter_payload)
        if docentries.get('status') != 'ok':
            raise Exception(docentries.get('message', 'Error buscando líneas a borrar'))

        rows = docentries.get('data', [])
        for row in rows:
            if 'DocEntry' in row:
                SapRepository.update(resource="NC_SGAWEB_DOCS", id=row['DocEntry'], payload={"U_Estado": 'C'})

        return True, f"Canceladas {len(rows)} línea(s) de preparación"

    @staticmethod
    def change_default_bin(whscode, itemcode, new_bin):
        if not new_bin or not itemcode:
            raise ValueError("Falta el código de ubicación o el código del artículo")

        res_bin = SapRepository.get_data(
            resource="BinLocations",
            filter={"BinCode": new_bin, "Warehouse": whscode},
            selection=["AbsEntry"]
        )

        if res_bin.get('status') != 'ok' or not res_bin.get('data'):
            raise ValueError(f"La ubicación {new_bin} no existe en el almacén {whscode}")

        bin_num = res_bin['data'][0].get('AbsEntry')
        res_upd = SapRepository.update(
            resource="Items",
            id=itemcode,
            payload={"ItemWarehouseInfoCollection": [{"WarehouseCode": whscode, "DefaultBin": bin_num}]}
        )

        if res_upd.status_code != 204:
            err_msg = SapRepository.parse_sap_error(res_upd)
            raise Exception(f"No se pudo actualizar la ubicación por defecto en SAP: {err_msg}")

        notify_sap_update(event_type="stock", details={"itemcode": itemcode, "new_bin": new_bin})
        return True, f"Ubicación por defecto actualizada a {new_bin} para {itemcode} en almacén {whscode}"

    @staticmethod
    def post_inventario(payload):
        bin_code = payload.get('BinCode')
        item_code = payload.get('ItemCode')
        count_qty = float(payload.get('CountQty', 0))

        if not bin_code or not item_code:
            raise ValueError("Falta BinCode o ItemCode en la solicitud de inventario")

        res_bin = SapRepository.get_data(resource="BinLocations", filter={"BinCode": bin_code}, selection=["AbsEntry"])
        if res_bin.get('status') != 'ok' or not res_bin.get('data'):
            raise ValueError(f"No existe la ubicación {bin_code} en SAP")

        bin_abs = res_bin['data'][0].get('AbsEntry')
        counting_payload = {
            "InventoryCountingLines": [{
                "ItemCode": item_code,
                "CountedQuantity": count_qty,
                "BinAllocations": [{
                    "BinAbsEntry": bin_abs,
                    "CountedQuantity": count_qty
                }]
            }]
        }

        res = SapRepository.post(resource="InventoryCountings", payload=counting_payload)
        if res.status_code == 201:
            notify_sap_update(event_type="inventory", details={"itemcode": item_code, "bincode": bin_code, "qty": count_qty})
            return {"status": "ok", "message": "Recuento de inventario registrado correctamente en SAP"}
        else:
            err_msg = SapRepository.parse_sap_error(res)
            raise Exception(f"Error registrando recuento en SAP: {err_msg}")

    @staticmethod
    def trasladar_stock(payload):
        bin_from = payload.get('BinFrom')
        bin_to = payload.get('BinTo')
        item_code = payload.get('ItemCode')
        quantity = float(payload.get('Quantity', 1))

        if not bin_from or not bin_to or not item_code:
            raise ValueError("Faltan datos obligatorios para el traslado de stock")

        mapping_ubi = StockService.get_id_ubicaciones([bin_from, bin_to])
        abs_from = mapping_ubi.get(bin_from)
        abs_to = mapping_ubi.get(bin_to)

        if not abs_from:
            raise ValueError(f"No existe la ubicación de origen {bin_from}")
        if not abs_to:
            raise ValueError(f"No existe la ubicación de destino {bin_to}")

        res_bin_from = SapRepository.get_data(resource="BinLocations", id=abs_from, selection=["Warehouse"])
        res_bin_to = SapRepository.get_data(resource="BinLocations", id=abs_to, selection=["Warehouse"])

        whs_from = res_bin_from['data'][0].get('Warehouse') if res_bin_from.get('data') else '01'
        whs_to = res_bin_to['data'][0].get('Warehouse') if res_bin_to.get('data') else '01'

        transfer_payload = {
            "FromWarehouse": whs_from,
            "ToWarehouse": whs_to,
            "StockTransferLines": [{
                "ItemCode": item_code,
                "Quantity": quantity,
                "FromWarehouseCode": whs_from,
                "WarehouseCode": whs_to,
                "StockTransferLinesBinAllocations": [
                    {
                        "BinAbsEntry": abs_from,
                        "Quantity": quantity,
                        "BinActionType": "batFromWarehouse"
                    },
                    {
                        "BinAbsEntry": abs_to,
                        "Quantity": quantity,
                        "BinActionType": "batToWarehouse"
                    }
                ]
            }]
        }

        res = SapRepository.post(resource="StockTransfers", payload=transfer_payload)
        if res.status_code == 201:
            notify_sap_update(event_type="transfer", details={"itemcode": item_code, "bin_from": bin_from, "bin_to": bin_to, "qty": quantity})
            return {"status": "ok", "message": "Traslado directo registrado correctamente en SAP"}
        else:
            err_msg = SapRepository.parse_sap_error(res)
            raise Exception(f"Error en traslado directo en SAP: {err_msg}")

    @staticmethod
    def _ejecutar_traslado_lineas(lineas, mapping_fields, doc_original, obj_type, is_linked=False):
        def to_int_or_none(val):
            try:
                return int(val)
            except (ValueError, TypeError):
                return None

        fld_bin_from = mapping_fields.get('bin_from')
        fld_bin_to = mapping_fields.get('bin_to')
        fld_qty = 'CTD_PREPARADA'
        fld_prod = 'ITEMCODE'

        ubicaciones = list({d[clave] for d in lineas for clave in (fld_bin_from, fld_bin_to) if clave in d and d[clave]})
        mapping_ubi = StockService.get_id_ubicaciones(lista_ubicaciones=ubicaciones)

        lineas_validas = [lin for lin in lineas if float(lin.get(fld_qty, 0) or 0) > 0]
        if not lineas_validas:
            return jsonify({"status": "error", "message": "No hay líneas con cantidad preparada mayor a 0"}), 400

        res_bin = SapRepository.get_data(resource="BinLocations", id=mapping_ubi.get(lineas_validas[0].get(fld_bin_from)), selection=["Warehouse"])
        from_whs = res_bin['data'][0].get('Warehouse') if res_bin.get('data') else '01'

        res_bin_to = SapRepository.get_data(resource="BinLocations", id=mapping_ubi.get(lineas_validas[0].get(fld_bin_to)), selection=["Warehouse"])
        to_whs = res_bin_to['data'][0].get('Warehouse') if res_bin_to.get('data') else '01'

        transfer_lines = []
        for lin in lineas_validas:
            abs_from = mapping_ubi.get(lin.get(fld_bin_from))
            abs_to = mapping_ubi.get(lin.get(fld_bin_to))

            bin_allocations = []
            if abs_from and abs_to and abs_from == abs_to:
                # Si la ubicación origen y destino son idénticas, no se envía asignación doble
                pass
            else:
                if abs_from:
                    alloc_from = {
                        "BinAbsEntry": abs_from,
                        "Quantity": float(lin.get(fld_qty, 0)),
                        "BinActionType": "batFromWarehouse"
                    }
                    if lin.get('dist_number'):
                        alloc_from["SerialAndBatchNumbersBaseLine"] = 0
                    bin_allocations.append(alloc_from)
                if abs_to:
                    alloc_to = {
                        "BinAbsEntry": abs_to,
                        "Quantity": float(lin.get(fld_qty, 0)),
                        "BinActionType": "batToWarehouse"
                    }
                    if lin.get('dist_number'):
                        alloc_to["SerialAndBatchNumbersBaseLine"] = 0
                    bin_allocations.append(alloc_to)

            line_entry = {
                "ItemCode": lin.get(fld_prod),
                "Quantity": float(lin.get(fld_qty, 0)),
                "FromWarehouseCode": from_whs,
                "WarehouseCode": to_whs,
                "StockTransferLinesBinAllocations": bin_allocations
            }

            if obj_type == "1250000001":
                line_entry["BaseType"] = 1250000001
                line_entry["BaseEntry"] = to_int_or_none(lin.get("U_PedidoEntry"))
                line_entry["BaseLine"] = to_int_or_none(lin.get("U_PedidoLine"))

            if val := lin.get('dist_number', ''):
                line_entry["SerialNumbers"] = [{"InternalSerialNumber": val, "Quantity": float(lin.get(fld_qty, 1))}]

            transfer_lines.append(line_entry)

        transfer_payload = {"StockTransferLines": transfer_lines}
        res = SapRepository.post(resource="StockTransfers", payload=transfer_payload)

        if res.status_code == 201:
            if is_linked:
                for row in lineas:
                    if 'DocEntry' in row:
                        SapRepository.update(resource="NC_SGAWEB_DOCS", id=row['DocEntry'], payload={"U_Estado": 'C'})
            
            return jsonify({"status": "ok", "message": "Traslado de stock completado con éxito"})
        else:
            err_msg = SapRepository.parse_sap_error(res)
            if "1470000340" in str(err_msg) or "allocated quantity exceeds available quantity" in str(err_msg):
                err_msg = f"Stock insuficiente en la ubicación de origen. La cantidad a semi-preparar supera las unidades disponibles físicamente en esa ubicación en SAP."
            return jsonify({"status": "error", "message": f"Error en SAP Service Layer: {err_msg}"}), res.status_code

