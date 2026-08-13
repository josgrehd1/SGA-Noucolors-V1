from app.data.sap_repository import SapRepository

class ProductService:
    """
    Servicio para consultas detalladas de Productos y Stock Comprometido.
    Integra Llamadas de Servicio, Pedidos de Venta, Solicitudes de Traslado (Origen ➔ Destino)
    y el desglose de stock comprometido por almacenes en SAP Business One.
    """

    @staticmethod
    def get_product_calls(itemcode):
        if not itemcode:
            return {"calls": [], "whs_committed": []}
        
        itemcode_clean = str(itemcode).strip()
        calls = []
        seen_docs = set()  # Almacena tuplas (DocEntry_str, ObjType_str)

        # ------------------------------------------------------------------
        # 1. Consulta Vista SQL de Necesidades (NC_SGA_NECESIDADES_B1SLQuery)
        # ------------------------------------------------------------------
        sc_cache = {}  # Cache de comentarios de llamadas por cid para evitar llamadas repetidas
        try:
            needs_res = SapRepository.get_data_from_view(
                view_name="NC_SGA_NECESIDADES_B1SLQuery",
                filter={"ITEMCODE": itemcode_clean},
                all_results=True
            )
            if needs_res.get("status") == "ok" and needs_res.get("data"):
                for d in needs_res.get("data", []):
                    llamada_id = d.get("LLAMADA")
                    existing_comment = (d.get("COMENTARIO") or "").strip()
                    comment = existing_comment

                    # Solo consultar SAP Service Layer si el comentario está vacío y hay ID de llamada
                    if not comment and llamada_id and str(llamada_id).isdigit() and int(llamada_id) > 0:
                        cid = int(llamada_id)
                        if cid in sc_cache:
                            comment = sc_cache[cid]
                        else:
                            # Consultar OSCL (ServiceCalls)
                            try:
                                sc_res = SapRepository.get_data(
                                    resource="ServiceCalls",
                                    id=cid,
                                    selection=["Description", "Subject", "Resolution"]
                                )
                                if sc_res.get("status") == "ok" and sc_res.get("data"):
                                    sc = sc_res.get("data")[0] if isinstance(sc_res.get("data"), list) else sc_res.get("data")
                                    comment = (sc.get("Description") or sc.get("Subject") or sc.get("Resolution") or "").strip()
                            except Exception:
                                pass

                            # Si no hay comentario en ServiceCalls, consultar OCLG (Activities)
                            if not comment:
                                try:
                                    act_res = SapRepository.get_data(
                                        resource="Activities",
                                        id=cid,
                                        selection=["Notes", "Details"]
                                    )
                                    if act_res.get("status") == "ok" and act_res.get("data"):
                                        act = act_res.get("data")[0] if isinstance(act_res.get("data"), list) else act_res.get("data")
                                        comment = (act.get("Notes") or act.get("Details") or "").strip()
                                except Exception:
                                    pass

                            sc_cache[cid] = comment

                    final_comment = comment if comment else "Sin comentarios registrados."
                    doc_entry = d.get("DOCENTRY")
                    obj_type = str(d.get("OBJTYPE", "LLAMADA")) if d.get("OBJTYPE") else "LLAMADA"
                    
                    item_data = {
                        "LLAMADA": llamada_id,
                        "DOCENTRY": doc_entry,
                        "DOCNUM": d.get("DOCNUM"),
                        "OBJTYPE": obj_type,
                        "TIPO": "Llamada" if (llamada_id and int(llamada_id) > 0) else "Necesidad",
                        "CARDNAME": d.get("CARDNAME") or d.get("CARDCODE") or "",
                        "QTY": d.get("QTY") or d.get("CANTIDAD") or d.get("QUANTITY") or 0,
                        "FROM_WHS": d.get("FROM_WHS") or d.get("WhsCode") or "",
                        "TO_WHS": d.get("TO_WHS") or "",
                        "ORIGEN_DESTINO": f"{d.get('FROM_WHS')} ➔ {d.get('TO_WHS')}" if d.get("FROM_WHS") and d.get("TO_WHS") else "",
                        "COMENTARIO": final_comment
                    }

                    if doc_entry and obj_type:
                        seen_docs.add((str(doc_entry), str(obj_type)))

                    calls.append(item_data)
        except Exception as ex:
            print(f"[ProductService] Error consultando NC_SGA_NECESIDADES_B1SLQuery: {ex}")

        # ------------------------------------------------------------------
        # 2. Consulta Vista SQL de Posiciones (NC_SGA_SOLICITUDES_POS_B1SLQuery)
        # ------------------------------------------------------------------
        try:
            pos_res = SapRepository.get_data_from_view(
                view_name="NC_SGA_SOLICITUDES_POS_B1SLQuery",
                filter={"ITEMCODE": itemcode_clean},
                all_results=True
            )
            if pos_res.get("status") == "ok" and pos_res.get("data"):
                for p in pos_res.get("data", []):
                    doc_entry = p.get("DOCENTRY")
                    obj_type = str(p.get("OBJTYPE", "")) if p.get("OBJTYPE") is not None else ""

                    if doc_entry and obj_type and (str(doc_entry), str(obj_type)) in seen_docs:
                        continue

                    from_whs = p.get("FROM_WHS") or p.get("FromWarehouse") or p.get("WhsCode") or "01"
                    to_whs = p.get("TO_WHS") or p.get("ToWarehouse") or "13"
                    doc_num = p.get("DOCNUM") or p.get("DocNum")
                    qty = float(p.get("QTY") or p.get("CANTIDAD") or p.get("QUANTITY") or 0)
                    
                    origen_destino = ""
                    if obj_type in ("1250000001", "1250000001.0", "OWTR"):
                        tipo_desc = "Solicitud de Traslado"
                        origen_destino = f"{from_whs} ➔ {to_whs}"
                        cardname = p.get("CARDNAME") or p.get("CardName") or f"Traslado Alm. {from_whs} ➔ Alm. {to_whs}"
                        comentario = p.get("COMENTARIO") or p.get("Comentario") or p.get("Comments") or "Solicitud de traslado de stock abierta en SAP"
                    elif obj_type in ("17", "ORDR"):
                        tipo_desc = "Pedido de Venta"
                        cardname = p.get("CARDNAME") or p.get("CardName") or ""
                        comentario = p.get("COMENTARIO") or p.get("Comentario") or p.get("Comments") or ""
                    else:
                        tipo_desc = f"Reserva (DocType {obj_type})" if obj_type else "Reserva Stock"
                        cardname = p.get("CARDNAME") or p.get("CardName") or ""
                        comentario = p.get("COMENTARIO") or p.get("Comentario") or p.get("Comments") or ""

                    item_call = {
                        "DOCENTRY": doc_entry,
                        "DOCNUM": doc_num,
                        "OBJTYPE": obj_type,
                        "TIPO": tipo_desc,
                        "QTY": qty,
                        "CARDNAME": cardname,
                        "FROM_WHS": from_whs,
                        "TO_WHS": to_whs,
                        "ORIGEN_DESTINO": origen_destino,
                        "COMENTARIO": comentario or (f"Traslado: {origen_destino}" if origen_destino else "Sin comentario")
                    }

                    if doc_entry and obj_type:
                        seen_docs.add((str(doc_entry), str(obj_type)))

                    calls.append(item_call)
        except Exception as ex:
            print(f"[ProductService] Error consultando NC_SGA_SOLICITUDES_POS_B1SLQuery: {ex}")

        # ------------------------------------------------------------------
        # 3. Rescate Directo de Solicitudes de Traslado (InventoryTransferRequests)
        # ------------------------------------------------------------------
        has_traslado = any(str(x.get("OBJTYPE")) in ("1250000001", "1250000001.0", "OWTR") for x in calls)
        if not has_traslado:
            try:
                itr_res = SapRepository.get_data(
                    resource="InventoryTransferRequests",
                    filter={"DocumentStatus": "bost_Open"},
                    selection=["DocEntry", "DocNum", "DocDate", "FromWarehouse", "ToWarehouse", "Comments", "StockTransferLines"],
                    orderby="DocEntry desc",
                    per_page=20
                )
                if itr_res.get("status") == "ok" and itr_res.get("data"):
                    for doc in itr_res["data"]:
                        de = str(doc.get("DocEntry"))
                        if (de, "1250000001") in seen_docs:
                            continue

                        lines = doc.get("StockTransferLines") or doc.get("Lines") or []
                        for line in lines:
                            line_item = str(line.get("ItemCode", "")).strip()
                            line_status = str(line.get("LineStatus", ""))
                            if line_item == itemcode_clean and line_status != "bost_Closed":
                                qty = float(line.get("RemainingOpenQuantity") or line.get("Quantity") or 0)
                                if qty > 0:
                                    from_w = doc.get("FromWarehouse") or line.get("FromWarehouse") or "01"
                                    to_w = doc.get("ToWarehouse") or line.get("ToWarehouse") or "13"
                                    origen_dest = f"{from_w} ➔ {to_w}"
                                    card_n = doc.get("CardName") or f"Traslado Alm. {from_w} ➔ Alm. {to_w}"
                                    comm = doc.get("Comments") or "Solicitud de traslado de stock abierta en SAP"

                                    calls.append({
                                        "DOCENTRY": doc.get("DocEntry"),
                                        "DOCNUM": doc.get("DocNum"),
                                        "OBJTYPE": "1250000001",
                                        "TIPO": "Solicitud de Traslado",
                                        "QTY": qty,
                                        "CARDNAME": card_n,
                                        "FROM_WHS": from_w,
                                        "TO_WHS": to_w,
                                        "ORIGEN_DESTINO": origen_dest,
                                        "COMENTARIO": comm
                                    })
                                    seen_docs.add((de, "1250000001"))
                                    break
            except Exception as ex:
                print(f"[ProductService] Error consultando InventoryTransferRequests: {ex}")

        # ------------------------------------------------------------------
        # 4. Desglose de Almacenes con Stock Comprometido (Items / OITW)
        # ------------------------------------------------------------------
        whs_committed = []
        try:
            item_res = SapRepository.get_data(
                resource="Items",
                filter={"ItemCode": itemcode_clean},
                selection=["ItemWarehouseInfoCollection"]
            )
            if item_res.get("status") == "ok" and item_res.get("data"):
                items_list = item_res.get("data")
                item_info = items_list[0] if isinstance(items_list, list) and len(items_list) > 0 else items_list
                whs_collection = item_info.get("ItemWarehouseInfoCollection", [])
                for w in whs_collection:
                    committed = float(w.get("Committed", 0) or 0)
                    if committed > 0:
                        whs_committed.append({
                            "WarehouseCode": w.get("WarehouseCode"),
                            "Committed": committed,
                            "InStock": float(w.get("InStock", 0) or 0),
                            "Ordered": float(w.get("Ordered", 0) or 0)
                        })
        except Exception as ex:
            print(f"[ProductService] Error consultando desglose de almacenes: {ex}")

        return {
            "calls": calls,
            "whs_committed": whs_committed
        }
