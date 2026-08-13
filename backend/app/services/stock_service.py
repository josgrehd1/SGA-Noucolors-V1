from app.data.sap_repository import SapRepository
from app.utils.general_dict import SAP_TIPO_MOVIMIENTO_MAP

class StockService:
    """
    Servicio de Gestión de Stock de Productos, Ubicaciones e Historial de Movimientos.
    """

    @staticmethod
    def get_stock(page=1, per_page=20, filters=None):
        filters = filters or {}
        sap_filter = {"Valid": "tYES", "InventoryItem": "tYES", "SalesItem": "tYES"}
        total_override = None

        # 1. Filtro por ubicación / almacén (Evita error OData URL len > 2048 con paginación previa)
        if filters.get('ubicacion'):
            ubicacion_str = str.upper(filters['ubicacion'].strip())
            all_found_codes = set()

            # Intento A: Buscar en vista analítica de existencias por ubicación (BinCode)
            ub_info_bin = SapRepository.get_data_from_view(
                view_name="NC_STOCK_UBICACION_B1SLQuery", 
                filter={"BinCode__contains": ubicacion_str}, 
                all_results=True
            )
            if ub_info_bin.get('status') == 'ok' and ub_info_bin.get('data'):
                for x in ub_info_bin.get('data', []):
                    if x.get('ItemCode'):
                        all_found_codes.add(x.get('ItemCode'))

            # Intento B: Buscar en Items por ItemWarehouseInfoCollection (Almacenes generales de SAP)
            try:
                raw_filter = f"ItemWarehouseInfoCollection/any(w: contains(w/WarehouseCode, '{ubicacion_str}'))"
                items_whs = SapRepository.get_data(
                    resource="Items",
                    selection=["ItemCode"],
                    filter={"raw": raw_filter},
                    all_results=True
                )
                if items_whs.get('status') == 'ok' and items_whs.get('data'):
                    for x in items_whs.get('data', []):
                        if x.get('ItemCode'):
                            all_found_codes.add(x.get('ItemCode'))
            except Exception:
                pass

            all_item_codes = sorted(list(all_found_codes))

            if all_item_codes:
                if filters.get('itemcode'):
                    code_sub = str.upper(filters['itemcode'].strip())
                    all_item_codes = [c for c in all_item_codes if code_sub in c]

                total_override = len(all_item_codes)
                
                # Extraemos solo los códigos de la página actual
                start_idx = (page - 1) * per_page
                end_idx = start_idx + per_page
                page_item_codes = all_item_codes[start_idx:end_idx]

                if page_item_codes:
                    sap_filter["ItemCode__in"] = page_item_codes
                else:
                    sap_filter["ItemCode"] = "__NO_MATCHING_ITEM__"
            else:
                sap_filter["ItemCode"] = "__NO_MATCHING_ITEM__"

        if filters.get('itemcode') and not filters.get('ubicacion'):
            sap_filter["ItemCode__contains"] = str.upper(filters['itemcode'].strip())
        
        if filters.get('itemname'):
            sap_filter["ItemName__contains"] = str.upper(filters['itemname'].strip())

        if filters.get('tipo'):
            sap_filter["ItemsGroupCode"] = int(filters['tipo'])

        if filters.get('con_stock'):
            sap_filter["QuantityOnStock__greater"] = 0

        # Paginación OData
        sl_page = 1 if filters.get('ubicacion') else page
        sl_per_page = per_page

        result = SapRepository.get_data(
            resource="Items",
            selection=[
                "ItemCode", 
                "ItemName", 
                "ItemsGroupCode", 
                "ItemWarehouseInfoCollection", 
                "QuantityOnStock",
                "QuantityOrderedByCustomers",
                "QuantityOrderedFromVendors"
            ],
            orderby="ItemName",
            order_direction="asc",
            filter=sap_filter,
            page=sl_page,
            per_page=sl_per_page
        )

        if result.get('status') != 'ok':
            raise Exception(f"SAP query failed: {result.get('message', 'Error desconocido')}")

        items_data = result.get('data', [])
        productos = [f["ItemCode"] for f in items_data if f.get("ItemCode")]

        # Consultar ubicaciones en lotes pequeños (chunking de 20)
        ubicaciones_data = []
        if productos:
            chunk_size = 20
            for i in range(0, len(productos), chunk_size):
                chunk = productos[i:i + chunk_size]
                adic_info = SapRepository.get_data_from_view(
                    view_name="NC_STOCK_UBICACION_B1SLQuery", 
                    filter={"ItemCode__in": chunk}, 
                    all_results=True
                )
                if adic_info.get('status') == 'ok' and adic_info.get('data'):
                    ubicaciones_data.extend(adic_info.get('data', []))

        # Asignar y agrupar ubicaciones
        for data in items_data:
            raw_ubis = [x for x in ubicaciones_data if x.get('ItemCode') == data.get('ItemCode')]
            ubi_map = {}
            for u in raw_ubis:
                bincode = str(u.get('BinCode') or '').strip()
                distnum = str(u.get('DistNumber') or '').strip()
                whscode = str(u.get('WhsCode') or u.get('Warehouse') or '').strip()
                key = (bincode, distnum, whscode)

                try:
                    snqty = float(u.get('SNQTY') or 0)
                except (ValueError, TypeError):
                    snqty = 0.0

                try:
                    binqty = float(u.get('BINQTY') or 0)
                except (ValueError, TypeError):
                    binqty = 0.0

                if key not in ubi_map:
                    ubi_entry = dict(u)
                    ubi_entry['SNQTY'] = snqty
                    ubi_entry['BINQTY'] = binqty
                    ubi_map[key] = ubi_entry
                else:
                    ubi_map[key]['SNQTY'] += snqty
                    ubi_map[key]['BINQTY'] += binqty

            unique_ubis = list(ubi_map.values())
            data['Ubicaciones'] = sorted(unique_ubis, key=lambda x: str(x.get('BinCode', '')))
            data['ItemsGroupCode'] = data.get('ItemGroups', {}).get('GroupName', '')

            # CÁLCULO DE TOTALES DE NECESIDADES (ATP Y COMPRAS)
            whs_coll = data.get('ItemWarehouseInfoCollection', []) or []
            stock_top = data.get('QuantityOnStock')
            committed_top = data.get('QuantityOrderedByCustomers')
            ordered_top = data.get('QuantityOrderedFromVendors')

            total_stock = float(stock_top) if stock_top is not None else sum(float(w.get('InStock') or 0) for w in whs_coll)
            total_committed = float(committed_top) if committed_top is not None else sum(float(w.get('Committed') or 0) for w in whs_coll)
            total_ordered = float(ordered_top) if ordered_top is not None else sum(float(w.get('Ordered') or 0) for w in whs_coll)

            atp_neto = total_stock - total_committed + total_ordered
            necesidad_compra = (total_committed - (total_stock + total_ordered)) if (total_stock + total_ordered) < total_committed else 0.0

            data['TotalInStock'] = total_stock
            data['TotalCommitted'] = total_committed
            data['TotalOrdered'] = total_ordered
            data['ATPNeto'] = atp_neto
            data['NecesidadCompra'] = necesidad_compra

        total_count = total_override if total_override is not None else result.get('count', len(items_data))
        total_pages = (total_count + per_page - 1) // per_page if per_page else 1

        return {
            'productos': items_data,
            'total_count': total_count,
            'total_pages': total_pages,
            'page': page
        }

    @staticmethod
    def ubicacion_existe(ubicacion, itemcode=None, min_qty=0):
        if not ubicacion:
            return {
                "existe": False,
                "stock_suficiente": False,
                "stock_disponible": 0,
                "message": "La ubicación no puede estar vacía"
            }
        
        info = SapRepository.get_data(resource="BinLocations", selection=["BinCode"], filter={"BinCode": ubicacion})
        datos = info.get('data', []) if info and info.get('status') == 'ok' else []
        existe = bool(datos)

        if not existe:
            return {
                "existe": False,
                "stock_suficiente": False,
                "stock_disponible": 0,
                "message": f"La ubicación {ubicacion} no existe"
            }

        stock_disponible = None
        stock_suficiente = True
        mensaje = "Ubicación válida"

        if itemcode:
            info_stock = SapRepository.get_data_from_view(
                view_name="NC_STOCK_UBICACION_B1SLQuery",
                filter={"BinCode": ubicacion, "ItemCode": itemcode},
                all_results=True
            )
            datos_stock = info_stock.get('data', []) if info_stock and info_stock.get('status') == 'ok' else []
            stock_disponible = sum(float(x.get('BINQTY', 0) or 0) for x in datos_stock) if datos_stock else 0.0

            min_qty_val = float(min_qty or 0)
            if min_qty_val > 0:
                stock_suficiente = stock_disponible >= min_qty_val
            else:
                stock_suficiente = stock_disponible > 0

            if not stock_suficiente:
                cant_fmt = int(stock_disponible) if stock_disponible.is_integer() else stock_disponible
                mensaje = f"Stock insuficiente en {ubicacion} (Disponible: {cant_fmt} u.)"

        return {
            "existe": True,
            "stock_suficiente": stock_suficiente,
            "stock_disponible": stock_disponible,
            "message": mensaje
        }

    @staticmethod
    def producto_existe(producto, producto_esperado=None):
        if not producto:
            return {"existe": False, "productos": []}
        
        sl_filter = {"multipleExact": {"ItemCode": producto, "BarCode": producto, "U_Tipoproducto": producto}}
        if producto_esperado:
            sl_filter['ItemCode'] = producto_esperado

        info = SapRepository.get_data(resource="Items", selection=["ItemCode", "ItemName"], filter=sl_filter)
        datos = info.get('data', []) if info and info.get('status') == 'ok' else []
        return {"existe": bool(datos), "productos": datos}

    @staticmethod
    def serie_existe(producto, serie, ubicacion=None):
        if not producto or not serie:
            return False
        
        sap_filter = {
            "ItemCode": str(producto).strip(), 
            "DistNumber": str(serie).strip()
        }
        if ubicacion:
            sap_filter["BinCode"] = str(ubicacion).strip()

        info = SapRepository.get_data_from_view(view_name="NC_STOCK_UBICACION_B1SLQuery", filter=sap_filter, all_results=True)
        if info.get('status') == 'ok' and info.get('data'):
            return True

        fallback_info = SapRepository.get_data(
            resource="SerialNumberDetails", 
            selection=["ItemCode"], 
            filter={"ItemCode": str(producto).strip(), "InternalSerialNumber": str(serie).strip()}
        )
        if fallback_info.get('status') == 'ok' and fallback_info.get('data'):
            return True

        return False

    @staticmethod
    def get_manage_serial_numbers(item_code):
        """
        Devuelve 'tYES' si el artículo tiene gestión por números de serie,
        'tYES' para lotes (ManageBatchNumbers), o 'tNO' si no tiene gestión especial.
        """
        if not item_code:
            return {'serial': False, 'batch': False}
        info = SapRepository.get_data(
            resource="Items",
            selection=["ItemCode", "ManageSerialNumbers", "ManageBatchNumbers"],
            filter={"ItemCode": str(item_code).strip()}
        )
        if info.get('status') == 'ok' and info.get('data'):
            item = info['data'][0]
            return {
                'serial': item.get('ManageSerialNumbers') == 'tYES',
                'batch': item.get('ManageBatchNumbers') == 'tYES'
            }
        return {'serial': False, 'batch': False}

    @staticmethod
    def get_stock_info_producto(producto):
        if not producto:
            return []
        info = SapRepository.get_data_from_view(view_name="NC_STOCK_UBICACION_B1SLQuery", filter={"ItemCode": producto}, all_results=True)
        return info.get('data', []) if info and info.get('status') == 'ok' else []

    @staticmethod
    def get_stock_info_ubicacion(ubicacion):
        if not ubicacion:
            return []
        info = SapRepository.get_data_from_view(view_name="NC_STOCK_UBICACION_B1SLQuery", filter={"BinCode": ubicacion}, all_results=True, orderby="ItemCode", order_direction="asc")
        return info.get('data', []) if info and info.get('status') == 'ok' else []

    @staticmethod
    def get_stock_etiquetas(page=1, per_page=20, filters=None):
        filters = filters or {}
        sap_filter = {}
        if filters.get('itemcode'):
            sap_filter["ItemCode__contains"] = str.upper(filters['itemcode'].strip())
        if filters.get('bin'):
            sap_filter["BinCode__contains"] = str.upper(filters['bin'].strip())
        
        result = SapRepository.get_data_from_view(view_name="NC_STOCK_UBICACION_B1SLQuery", filter=sap_filter, all_results=True)
        if result.get('status') != 'ok':
            raise Exception(f"SAP query failed: {result.get('message')}")
        
        total_count = result.get('count', len(result.get('data', [])))
        total_pages = (total_count + per_page - 1) // per_page if per_page else 1
        
        return {
            'stock': result.get('data', []),
            'total_count': total_count,
            'total_pages': total_pages,
            'page': page
        }

    @staticmethod
    def get_product_price(item_id):
        info = SapRepository.get_data(resource="Items", selection=["ItemPrices"], filter={"ItemCode": item_id})
        if not item_id or not info or 'data' not in info:
            return 0
        datos = info.get('data', [])
        if isinstance(datos, list) and len(datos) > 0:
            tarifas = datos[0].get("ItemPrices", [])
            for t in tarifas:
                if t.get("PriceList") == 28:
                    return t.get('Price', 0)
        return 0

    @staticmethod
    def get_stock_disponible(productos):
        if not productos:
            return {}
        info = SapRepository.get_data(resource="Items", selection=["ItemCode", "ItemWarehouseInfoCollection"], filter={"ItemCode__in": productos})
        if not info or 'data' not in info:
            return {}
        datos = info.get('data', [])
        stock_info = {}
        if isinstance(datos, list):
            for x in datos:
                almacenes = x.get("ItemWarehouseInfoCollection", [])
                almacenes_validos = [a for a in almacenes if a.get("InStock") is not None and a.get("Committed") is not None]
                if almacenes_validos:
                    disponible = sum([alm['InStock'] - alm["Committed"] for alm in almacenes_validos])
                    stock_info[x.get("ItemCode")] = disponible
        return stock_info

    @staticmethod
    def get_id_ubicaciones(lista_ubicaciones):
        if not lista_ubicaciones:
            return {}
        clean_list = list(set([str(u).strip() for u in lista_ubicaciones if u]))
        if not clean_list:
            return {}
        info = SapRepository.get_data(
            resource="BinLocations", 
            selection=["AbsEntry", "BinCode"], 
            filter={"BinCode__in": clean_list}, 
            all_results=True
        )
        mapping = {}
        if info.get('status') == 'ok':
            for x in info.get('data', []):
                code = x['BinCode']
                abs_id = x['AbsEntry']
                mapping[code] = abs_id
                if len(code) > 20:
                    mapping[code[:20]] = abs_id
        return mapping

    @staticmethod
    def get_necesidades(itemcode):
        if not itemcode:
            return {"status": "ok", "data": [], "whs_committed": []}
        
        try:
            from app.services.product_service import ProductService
            res = ProductService.get_product_calls(itemcode)
            return {
                "status": "ok",
                "data": res.get("calls", []),
                "calls": res.get("calls", []),
                "whs_committed": res.get("whs_committed", [])
            }
        except Exception as ex:
            print(f"[StockService] Error obteniendo necesidades para {itemcode}: {ex}")
            return {"status": "error", "message": str(ex), "data": [], "whs_committed": []}

    @staticmethod
    def get_movimientos(itemcode):
        if not itemcode:
            return {"status": "ok", "summary": {}, "movements": []}

        itemcode_clean = str(itemcode).strip()
        res = SapRepository.get_data_from_view(
            view_name="NC_SGA_STOCK_MOVIMIENTOS_B1SLQuery",
            filter={"ItemCode": itemcode_clean},
            all_results=True
        )

        raw_data = res.get("data", []) if res and res.get("status") == "ok" else []
        tipo_map = SAP_TIPO_MOVIMIENTO_MAP

        movements = []
        traslados_dict = {}

        for x in raw_data:
            trans_type = x.get("TransType")

            if trans_type == 67:
                doc_entry = x.get("DocEntry") or x.get("TransNum")
                line_num = x.get("DocLineNum", 0)
                key = (doc_entry, line_num)

                if key not in traslados_dict:
                    traslados_dict[key] = []
                traslados_dict[key].append(x)
                continue

            whs = x.get("Warehouse") or ""
            bincode = x.get("BinCode") or ""
            card_name = x.get("CardName") or x.get("CardCode") or ""
            comments = x.get("Comments") or ""
            qty = float(x.get("QTY") or 0)

            tipo_tuple = tipo_map.get(trans_type)
            if tipo_tuple:
                tipo_nombre, cat = tipo_tuple
            else:
                tipo_nombre = f"Doc. {trans_type}" if trans_type else "Movimiento"
                cat = "compra" if qty > 0 else "venta"

            if bincode:
                origen_destino = f"Alm. {whs} ({bincode})"
            elif card_name:
                if qty > 0:
                    origen_destino = f"{card_name} ➔ Alm. {whs}"
                else:
                    origen_destino = f"Alm. {whs} ➔ {card_name}"
            elif whs:
                origen_destino = f"Alm. {whs}"
            else:
                origen_destino = "-"

            series_name = x.get("SeriesName") or ""
            doc_entry = x.get("DocEntry") or ""
            num_doc_str = f"{series_name} #{doc_entry}".strip() if series_name or doc_entry else ""
            comentario_fmt = comments if comments else (f"Doc {num_doc_str}" if num_doc_str else "-")
            fecha_str = str(x.get("CreateDate") or "")[:10]

            movements.append({
                "fecha": fecha_str,
                "tipo": tipo_nombre,
                "categoria": cat,
                "origen_destino": origen_destino,
                "cantidad": qty,
                "comentario": comentario_fmt
            })

        for (doc_entry, line_num), items in traslados_dict.items():
            neg_item = next((i for i in items if float(i.get("QTY") or 0) < 0), None)
            pos_item = next((i for i in items if float(i.get("QTY") or 0) > 0), None)
            sample_item = items[0]

            whs_from = (neg_item.get("Warehouse") or "") if neg_item else ""
            bin_from = (neg_item.get("BinCode") or "") if neg_item else ""
            whs_to = (pos_item.get("Warehouse") or "") if pos_item else ""
            bin_to = (pos_item.get("BinCode") or "") if pos_item else ""

            str_from = f"Alm. {whs_from}" + (f" ({bin_from})" if bin_from else "") if whs_from else "Origen"
            str_to = f"Alm. {whs_to}" + (f" ({bin_to})" if bin_to else "") if whs_to else "Destino"
            origen_destino = f"{str_from} ➔ {str_to}"

            qty_abs = abs(float((pos_item or neg_item or sample_item).get("QTY") or 0))
            comments = sample_item.get("Comments") or ""
            series_name = sample_item.get("SeriesName") or ""
            num_doc_str = f"{series_name} #{doc_entry}".strip() if series_name or doc_entry else ""
            comentario_fmt = comments if comments else (f"Traslado {num_doc_str}" if num_doc_str else "Traslado de almacén")
            fecha_str = str(sample_item.get("CreateDate") or "")[:10]

            movements.append({
                "fecha": fecha_str,
                "tipo": "Traslado Almacén",
                "categoria": "traslado",
                "origen_destino": origen_destino,
                "cantidad": qty_abs,
                "comentario": comentario_fmt
            })

        movements.sort(key=lambda m: str(m.get("fecha", "")), reverse=True)

        ultima_compra = next((m for m in movements if m.get("categoria") == "compra"), None)
        ultima_venta = next((m for m in movements if m.get("categoria") == "venta"), None)
        ultimo_traslado = next((m for m in movements if m.get("categoria") == "traslado"), None)

        summary = {
            "ultima_compra": f"{ultima_compra['fecha']}" if ultima_compra else "Sin registros",
            "ultima_salida": f"{ultima_venta['fecha']}" if ultima_venta else "Sin registros",
            "ultimo_traslado": f"{ultimo_traslado['fecha']} ({ultimo_traslado['origen_destino']})" if ultimo_traslado else "Sin registros",
            "total_movimientos": len(movements)
        }

        return {
            "status": "ok",
            "summary": summary,
            "movements": movements[:20]
        }
