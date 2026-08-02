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
            cabecera['CUENTA_PREPARADO'] = sum(1 for linea in lineas_filtradas if float(linea.get('CTD_PREPARADA', 0) or 0) > 0)

        total_count = result.get('count', 0)
        total_pages = (total_count + per_page - 1) // per_page if per_page else 1
        
        return {
            'pedidos': cabeceras,
            'total_count': total_count,
            'total_pages': total_pages,
            'page': page
        }

    @staticmethod
    def _build_docs_filter(filters, objtype, ver_inactivos=False):
        sap_filter = {"OBJTYPE": objtype}
        if objtype == "17" and not ver_inactivos:
            sap_filter["U_NC_INC_PRDMX"] = "Y"
        
        if ver_inactivos:
            sap_filter["U_NC_INC_PRDMX"] = "N"

        if filters.get('docnum'):
            sap_filter["DOCNUM"] = int(filters['docnum'])

        if filters.get('cliente'):
            sap_filter["CARDCODE"] = filters['cliente']

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
            page=page,
            per_page=per_page
        )

        if result.get('status') != 'ok':
            raise Exception(f"Error consultando detalle: {result.get('message')}")

        return {
            'lineas': result.get('data', []),
            'total_count': result.get('count', 0)
        }

    @staticmethod
    def semipreparar_stock(docentry, target_bin=None, lineas_prep=None):
        res_cab = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_CAB_B1SLQuery",
            filter={"DOCENTRY": int(docentry)}
        )
        if res_cab.get('status') != 'ok' or not res_cab.get('data'):
            return jsonify({"status": "error", "message": f"No se encontró la cabecera del pedido #{docentry}"}), 404

        cabecera = res_cab['data'][0]
        obj_type = str(cabecera.get('OBJTYPE', 17))
        res_pos = SapRepository.get_data_from_view(
            view_name="NC_SGA_SOLICITUDES_POS_B1SLQuery",
            filter={"DOCENTRY": int(docentry), "OBJTYPE": obj_type},
            all_results=True
        )

        if res_pos.get('status') != 'ok' or not res_pos.get('data'):
            return jsonify({"status": "error", "message": f"No se encontraron líneas para semi-preparar en el pedido #{docentry}"}), 404

        lineas = res_pos['data']

        if lineas_prep and isinstance(lineas_prep, list):
            qty_by_item = {x['itemcode']: float(x.get('quantity', 0)) for x in lineas_prep if 'itemcode' in x}
            lineas = [l for l in lineas if qty_by_item.get(l.get('ITEMCODE'), 0) > 0]
            for l in lineas:
                item_code = l.get('ITEMCODE')
                if item_code in qty_by_item:
                    l['QUANTITY'] = qty_by_item[item_code]

        mapping_fields = {
            '17': {'bin_from': 'BIN_STD', 'bin_to': 'BIN_SEMI'},
            '1250000001': {'bin_from': 'BIN_SEMI', 'bin_to': 'BIN_STD'},
            '22': {'bin_from': 'BIN_STD', 'bin_to': 'BIN_SEMI'}
        }.get(obj_type, {'bin_from': 'BIN_STD', 'bin_to': 'BIN_SEMI'})

        if target_bin:
            for l in lineas:
                l['BIN_SEMI'] = target_bin

        doc_original = SapRepository.get_data(resource="Orders", id=int(docentry))
        if doc_original.get('status') != 'ok' or not doc_original.get('data'):
            return jsonify({"status": "error", "message": f"No se pudo consultar el pedido #{docentry} en SAP"}), 404

        doc_original_data = doc_original['data'][0]
        response = DocsService._ejecutar_traslado_lineas(lineas, mapping_fields, doc_original_data, obj_type, is_linked=True)

        # Transmitir evento WebSocket a todos los clientes conectados
        notify_sap_update(event_type="semipreparar", details={"docentry": docentry, "objtype": obj_type, "target_bin": target_bin})
        return response

    @staticmethod
    def finalizar_preparacion(objtype, docentry):
        res = DocsService.semipreparar_stock(docentry)
        notify_sap_update(event_type="finalizar", details={"docentry": int(docentry), "objtype": str(objtype)})
        return res

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
            if abs_from:
                bin_allocations.append({
                    "BinAbsEntry": abs_from,
                    "Quantity": float(lin.get(fld_qty, 0)),
                    "BinActionType": "batFromWarehouse",
                    "SerialAndBatchNumbersBaseLine": 0 if lin.get('dist_number') else -1
                })
            if abs_to:
                bin_allocations.append({
                    "BinAbsEntry": abs_to,
                    "Quantity": float(lin.get(fld_qty, 0)),
                    "BinActionType": "batToWarehouse",
                    "SerialAndBatchNumbersBaseLine": 0 if lin.get('dist_number') else -1
                })

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
            return jsonify({"status": "error", "message": f"Error en SAP Service Layer: {err_msg}"}), res.status_code
