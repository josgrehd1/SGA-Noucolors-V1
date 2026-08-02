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
                "ItemGroups",
                "QuantityOnStock",
                "QuantityOrderedByCustomers",
                "QuantityOrderedFromVendors"
            ],
            expand=["ItemGroups"],
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

        total_count = total_override if total_override is not None else result.get('count', len(items_data))
        total_pages = (total_count + per_page - 1) // per_page if per_page else 1

        return {
            'productos': items_data,
            'total_count': total_count,
            'total_pages': total_pages,
            'page': page
        }

    @staticmethod
    def get_id_ubicaciones(lista_ubicaciones):
        if not lista_ubicaciones:
            return {}
        info = SapRepository.get_data(
            resource="BinLocations", 
            selection=["AbsEntry", "BinCode"], 
            filter={"BinCode__in": list(set(lista_ubicaciones))}, 
            all_results=True
        )
        if info.get('status') == 'ok':
            return {x['BinCode']: x['AbsEntry'] for x in info.get('data', [])}
        return {}

    @staticmethod
    def get_necesidades(itemcode):
        if not itemcode:
            return {"status": "ok", "data": []}
        
        needs_result = SapRepository.get_data_from_view(
            view_name="NC_SGA_NECESIDADES_B1SLQuery",
            filter={"ITEMCODE": str(itemcode).strip()},
            all_results=True
        )
        if needs_result.get('status') == 'ok':
            data = needs_result.get('data', [])
            for d in data:
                llamada_id = d.get("LLAMADA")
                comment = ""
                if llamada_id and (str(llamada_id).isdigit() and int(llamada_id) > 0):
                    cid = int(llamada_id)
                    try:
                        sc_res = SapRepository.get_data(resource="ServiceCalls", id=cid, selection=["Description", "Subject", "Resolution"])
                        if sc_res.get("status") == "ok" and sc_res.get("data"):
                            sc = sc_res.get("data")[0] if isinstance(sc_res.get("data"), list) else sc_res.get("data")
                            comment = (sc.get("Description") or sc.get("Subject") or sc.get("Resolution") or "").strip()
                    except Exception:
                        pass

                    if not comment:
                        try:
                            act_res = SapRepository.get_data(resource="Activities", id=cid, selection=["Notes", "Details"])
                            if act_res.get("status") == "ok" and act_res.get("data"):
                                act = act_res.get("data")[0] if isinstance(act_res.get("data"), list) else act_res.get("data")
                                comment = (act.get("Notes") or act.get("Details") or "").strip()
                        except Exception:
                            pass

                final_comment = comment if comment else "Sin comentarios registrados."
                d["COMENTARIO"] = final_comment
            return {"status": "ok", "data": data}
        return {"status": "error", "message": needs_result.get('message', 'Error cargando necesidades')}

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
