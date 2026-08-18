from app.data.sap_repository import SapRepository
from flask import current_app, Blueprint, jsonify, request, session, make_response
from app.services.auth_service import AuthService
from app.services.stock_service import StockService
from app.services.docs_service import DocsService
from app.services.albaran_service import AlbaranService
from app.services.print_service import PrintService
from app.services.search_service import SearchService
from app.utils.decorators import sap_login_required

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.before_request
def track_active_company_db():
    try:
        user_db = session.get('company_db')
        if user_db:
            from app.services.sap_sync_monitor import SapSyncMonitor
            SapSyncMonitor.register_active_db(user_db)
    except Exception:
        pass

# ==============================================================================
# 1. RUTAS DE AUTENTICACIÓN (/api/auth)
# ==============================================================================

@api_bp.route('/auth/login', methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    company_db = data.get('company_db')

    if not username or not password or not company_db:
        return jsonify({'status': 'error', 'message': 'Faltan credenciales de usuario, contraseña o selección de base de datos'}), 400

    success, msg = AuthService.login(username=username, password=password, company_db=company_db)
    if success:
        user_data = AuthService.get_current_user() or {
            'username': username,
            'company_db': company_db,
            'printer': session.get('impresora', '')
        }
        return jsonify({
            'status': 'ok',
            'message': msg,
            'user': user_data
        })
    else:
        return jsonify({'status': 'error', 'message': msg}), 401

@api_bp.route('/auth/logout', methods=["POST"])
def logout():
    AuthService.logout()
    return jsonify({'status': 'ok', 'message': 'Sesión cerrada correctamente'})

@api_bp.route('/auth/session', methods=["GET"])
def check_session():
    user_data = AuthService.get_current_user()
    if user_data:
        return jsonify({
            'authenticated': True,
            'user': user_data
        })
    return jsonify({'authenticated': False}), 200

# ==============================================================================
# 2. RUTAS DE STOCK Y UBICACIONES (/api/stock)
# ==============================================================================

@api_bp.route('/stock', methods=["GET"])
@sap_login_required
def get_stock():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    filters = {
        'itemcode': request.args.get('itemcode', ''),
        'itemname': request.args.get('itemname', ''),
        'ubicacion': request.args.get('ubicacion', ''),
        'tipo': request.args.get('tipo', ''),
        'con_stock': request.args.get('con_stock', '') == 'true'
    }
    res = StockService.get_stock(page=page, per_page=per_page, filters=filters)
    return jsonify({'status': 'ok', **res})

@api_bp.route('/stock/<path:itemcode>/necesidades', methods=["GET"])
@sap_login_required
def get_stock_necesidades(itemcode):
    res = StockService.get_necesidades(itemcode)
    return jsonify(res)

@api_bp.route('/product-calls/<itemcode>', methods=["GET"])
@sap_login_required
def product_calls(itemcode):
    try:
        from app.services.product_service import ProductService
        res_data = ProductService.get_product_calls(itemcode)
        return jsonify({
            "status": "ok",
            "calls": res_data.get("calls", []),
            "whs_committed": res_data.get("whs_committed", [])
        })
    except Exception as e:
        return jsonify({"status": "ok", "calls": [], "whs_committed": []})

@api_bp.route('/stock/<path:itemcode>/movimientos', methods=["GET"])
@sap_login_required
def get_stock_movimientos(itemcode):
    res = StockService.get_movimientos(itemcode)
    return jsonify(res)

# ==============================================================================
# 3. RUTAS DE DOCUMENTOS Y OPERACIONES (/api/docs)
# ==============================================================================

@api_bp.route('/docs/<objtype>', methods=["GET"])
@sap_login_required
def get_documentos(objtype):
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    filters = {
        'docnum': request.args.get('docnum', ''),
        'cliente': request.args.get('cliente', ''),
        'tipo_venta': request.args.get('tipo_venta', '')
    }
    ver_inactivos = request.args.get('ver_inactivos', 'false').lower() == 'true'
    res = DocsService.get_documentos(objtype=objtype, page=page, per_page=per_page, filters=filters, ver_inactivos=ver_inactivos)
    return jsonify({'status': 'ok', **res})

@api_bp.route('/docs/detalle', methods=["GET"])
@sap_login_required
def get_detalle_documento():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    filters = {
        'docentry': request.args.get('docentry', ''),
        'objtype': request.args.get('objtype', ''),
        'itemcode': request.args.get('itemcode', '')
    }
    res = DocsService.get_detalle_documento(page=page, per_page=per_page, filters=filters)
    return jsonify({'status': 'ok', **res})

@api_bp.route('/semipreparar-stock/<int:docentry>', methods=["POST"])
@sap_login_required
def semipreparar_stock(docentry):
    data = request.get_json(silent=True) or {}
    target_bin = data.get('target_bin') or data.get('targetBin')
    lineas_prep = data.get('lineas') or data.get('PreparedLines')
    return DocsService.semipreparar_stock(docentry=docentry, target_bin=target_bin, lineas_prep=lineas_prep)

@api_bp.route('/docs/preparadas/<int:docentry>', methods=["GET"])
@sap_login_required
def get_lineas_preparadas(docentry):
    lineas = DocsService.get_lineas_preparadas(docentry)
    return jsonify({'status': 'ok', 'lineas': lineas, 'count': len(lineas)})

@api_bp.route('/docs/preparadas/batch', methods=["POST"])
@sap_login_required
def get_lineas_preparadas_batch():
    data = request.get_json(silent=True) or {}
    docentries = data.get('docentries', [])
    docnums = data.get('docnums', [])
    all_entries = list({str(x).strip() for x in (docentries + docnums) if x is not None and str(x).strip()})
    
    prep_by_doc = {}
    if all_entries:
        try:
            # Hacer una ÚNICA consulta OData en lugar de un bucle for
            res = SapRepository.get_data(
                resource="NC_SGAWEB_DOCS",
                selection=["DocEntry", "U_PedidoEntry", "U_PedidoLine", "U_ItemCode", "U_Quantity", "U_BinFrom", "U_ObjType", "U_Estado", "U_Semi"],
                filter={"U_PedidoEntry__in": all_entries, "U_Estado": "O"},
                all_results=True,
                inline_count=False
            )
            if res.get('status') == 'ok' and res.get('data'):
                for line in res['data']:
                    entry_str = str(line.get('U_PedidoEntry') or '').strip()
                    if entry_str:
                        if entry_str not in prep_by_doc:
                            prep_by_doc[entry_str] = []
                        prep_by_doc[entry_str].append(line)
        except Exception as e:
            print(f"Error en batch preparadas: {e}")
            pass
            
    return jsonify({'status': 'ok', 'preparadas_por_doc': prep_by_doc})

@api_bp.route('/docs/preparadas/abiertas', methods=["GET"])
@sap_login_required
def get_todas_preparadas_abiertas():
    res = SapRepository.get_data(
        resource="NC_SGAWEB_DOCS",
        filter={"U_Estado": "O"},
        selection=["DocEntry", "U_PedidoEntry", "U_PedidoLine", "U_ItemCode", "U_Quantity", "U_Semi", "U_Estado"],
        all_results=True
    )
    lineas = res.get('data', []) if res.get('status') == 'ok' else []
    return jsonify({'status': 'ok', 'lineas': lineas, 'count': len(lineas)})

@api_bp.route('/finalizar-preparacion/<objtype>/<int:docentry>', methods=["POST"])
@sap_login_required
def finalizar_preparacion(objtype, docentry):
    parcial = request.args.get('parcial', 'false').lower() == 'true'
    return DocsService.finalizar_preparacion(objtype=objtype, docentry=docentry, parcial=parcial)

@api_bp.route('/docs/change-default-bin', methods=["POST"])
@sap_login_required
def change_default_bin():
    data = request.get_json() or {}
    whscode = data.get('whscode')
    itemcode = data.get('itemcode')
    new_bin = data.get('new_bin')

    success, msg = DocsService.change_default_bin(whscode=whscode, itemcode=itemcode, new_bin=new_bin)
    return jsonify({'status': 'ok', 'message': msg})

@api_bp.route('/docs/inventario', methods=["POST"])
@sap_login_required
def post_inventario():
    payload = request.get_json()
    username = session.get('sap_username') or session.get('sap_user') or 'Desconocido'
    res = DocsService.post_inventario(payload, username)
    return jsonify({'status': 'ok', 'data': res})

@api_bp.route('/docs/traslado', methods=["POST"])
@sap_login_required
def post_traslado():
    payload = request.get_json()
    res = DocsService.trasladar_stock(payload)
    return jsonify({'status': 'ok', 'data': res})

# ==============================================================================
# 3.1 VALIDACIONES DE ESCANEO Y OPERACIONES DE PREPARACIÓN
# ==============================================================================

@api_bp.route('/ubicacion-existe/<ubicacion>', methods=["GET"])
@sap_login_required
def existe_ubicacion(ubicacion):
    itemcode = request.args.get('itemcode', '')
    qty = request.args.get('qty', request.args.get('min_qty', 0), type=float)
    info = StockService.ubicacion_existe(ubicacion, itemcode=itemcode, min_qty=qty)
    return jsonify(info)

@api_bp.route('/producto-existe', methods=["GET"])
@sap_login_required
def existe_producto():
    prod_search = request.args.get('prod-search', '')
    prod_expect = request.args.get('prod-expect', '')
    info = StockService.producto_existe(prod_search, prod_expect)
    return jsonify(info)

@api_bp.route('/serie-existe', methods=["GET"])
@sap_login_required
def existe_serie():
    itemcode = request.args.get('itemcode', '')
    serie = request.args.get('serie', '')
    bin_code = request.args.get('bin', '')
    info = StockService.serie_existe(itemcode, serie, ubicacion=bin_code)
    return jsonify({"existe": info})

@api_bp.route('/get-product-stock-info/<producto>', methods=["GET"])
@sap_login_required
def get_stock_info_prod(producto):
    info = StockService.get_stock_info_producto(producto)
    return jsonify({"success": True, "datos": info})

@api_bp.route('/get-bin-stock-info/<ubicacion>', methods=["GET"])
@sap_login_required
def get_stock_info_ubi(ubicacion):
    info = StockService.get_stock_info_ubicacion(ubicacion)
    return jsonify({"datos": info})

@api_bp.route('/get-available-stock/<productos>', methods=["GET"])
@sap_login_required
def get_available_stock(productos):
    prod_list = [p.strip() for p in productos.split(',') if p.strip()]
    info = StockService.get_stock_disponible(prod_list)
    return jsonify({"Stock": info})

@api_bp.route('/get-product-price/<item_id>', methods=["GET"])
@sap_login_required
def get_product_price(item_id):
    info = StockService.get_product_price(item_id)
    return jsonify({"Price": info})

@api_bp.route('/item-manage-serial', methods=["GET"])
@sap_login_required
def item_manage_serial():
    item_code = request.args.get('itemcode', '').strip()
    if not item_code:
        return jsonify({'serial': False, 'batch': False})
    result = StockService.get_manage_serial_numbers(item_code)
    return jsonify(result)

@api_bp.route('/confirmar-mov-stock', methods=["POST"])
@sap_login_required
def confirmar_mov_stock():
    data = request.get_json() or {}
    try:
        success, msg = DocsService.confirmar_mov_stock(data)
        return jsonify({"status": "ok", "message": msg})
    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400

@api_bp.route('/borrar-preparacion-stock', methods=["POST"])
@sap_login_required
def borrar_prep_stock():
    data = request.get_json() or {}
    success, msg = DocsService.borrar_preparacion_stock(data)
    return jsonify({"status": "ok", "message": msg})

@api_bp.route('/activar-pedido', methods=["POST"])
@sap_login_required
def activar_pedido():
    data = request.get_json() or {}
    docentry = data.get('docentry')
    success, msg = DocsService.activar_pedido(docentry)
    return jsonify({"status": "ok", "message": msg})

@api_bp.route('/desactivar-pedido', methods=["POST"])
@sap_login_required
def desactivar_pedido():
    data = request.get_json() or {}
    docentry = data.get('docentry')
    success, msg = DocsService.desactivar_pedido(docentry)
    return jsonify({"status": "ok", "message": msg})

# ==============================================================================
# 4. RUTAS DE ALBARANES E IMPRESIÓN PDF (/api/albaranes)
# ==============================================================================

@api_bp.route('/albaranes', methods=["GET"])
@sap_login_required
def list_albaranes():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    filters = {
        'doc': request.args.get('doc', ''),
        'cliente': request.args.get('cliente', ''),
        'date_from': request.args.get('date_from', ''),
        'date_to': request.args.get('date_to', '')
    }
    res = AlbaranService.list_albaranes(page=page, per_page=per_page, filters=filters)
    return jsonify({'status': 'ok', **res})

@api_bp.route('/albaranes/<int:docentry>', methods=["GET"])
@sap_login_required
def get_albaran_detalle(docentry):
    albaran = AlbaranService.get_albaran_detalle(docentry)
    return jsonify({'status': 'ok', 'albaran': albaran})

@api_bp.route('/albaranes/<int:docentry>/pdf', methods=["GET"])
@sap_login_required
def get_albaran_pdf(docentry):
    albaran = AlbaranService.get_albaran_detalle(docentry)
    pdf_bytes = AlbaranService.generar_pdf_bytes(albaran)
    response = make_response(pdf_bytes)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'inline; filename="Albaran_{docentry}.pdf"'
    return response

@api_bp.route('/albaranes/<int:docentry>/imprimir', methods=["POST"])
@sap_login_required
def imprimir_albaran_pdf(docentry):
    data = request.get_json(silent=True) or {}
    copies = int(data.get('copies', 1))
    success, msg = AlbaranService.imprimir_albaran(docentry, copies=copies)
    if success:
        return jsonify({'status': 'ok', 'message': msg})
    else:
        return jsonify({'status': 'error', 'message': msg}), 400

# ==============================================================================
# 5. RUTAS DE IMPRESIÓN ZPL Y ZEBRA (/api/print)
# ==============================================================================

@api_bp.route('/print/printers', methods=["GET"])
@sap_login_required
def get_printers():
    printers = PrintService.get_available_printers()
    return jsonify({'status': 'ok', 'impresoras': printers})

@api_bp.route('/print/product', methods=["POST"])
@api_bp.route('/print/articulo', methods=["POST"])
@sap_login_required
def print_product_label():
    data = request.get_json() or {}
    product_id = data.get('product_id') or data.get('itemcode')
    product_name = data.get('product_name') or data.get('itemname')
    printer_id = data.get('printer_id')
    copies = data.get('copies', 1)
    serial_number = data.get('serial_number')

    success, msg = PrintService.print_product(
        product_id=product_id,
        product_name=product_name,
        printer_id=printer_id,
        copies=copies,
        serial_number=serial_number
    )
    return jsonify({'status': 'ok', 'message': msg})

@api_bp.route('/print/bin', methods=["POST"])
@api_bp.route('/print/ubicacion', methods=["POST"])
@sap_login_required
def print_bin_label():
    data = request.get_json() or {}
    bin_code = data.get('bin') or data.get('bincode')
    printer_id = data.get('printer_id')
    copies = data.get('copies', 1)

    success, msg = PrintService.print_bin(
        bin_code=bin_code,
        printer_id=printer_id,
        copies=copies
    )
    return jsonify({'status': 'ok', 'message': msg})

@api_bp.route('/print/bultos', methods=["POST"])
@sap_login_required
def print_bultos_label():
    data = request.get_json() or {}
    entry_pedido = data.get('entryPedido') or data.get('docentry')
    bultos = data.get('numBultos', 1)
    printer_id = data.get('printer_id', '')

    success, msg = PrintService.print_bultos(
        entry_pedido=entry_pedido,
        bultos=bultos,
        printer_id=printer_id
    )
    return jsonify({'status': 'ok', 'message': msg})

# ==============================================================================
# 6. RUTAS DE BÚSQUEDA Y AUTOCOMPLETADO (/api/search)
# ==============================================================================

@api_bp.route('/search/bins', methods=["GET"])
@sap_login_required
def search_bins():
    term = request.args.get('term', '')
    bins = SearchService.search_bins(term)
    return jsonify({'status': 'ok', 'results': bins})

@api_bp.route('/search/items', methods=["GET"])
@sap_login_required
def search_items():
    term = request.args.get('term', '')
    items = SearchService.search_items(term)
    return jsonify({'status': 'ok', 'results': items})

@api_bp.route('/search/customers', methods=["GET"])
@sap_login_required
def search_customers():
    term = request.args.get('term', '')
    customers = SearchService.search_customers(term)
    return jsonify({'status': 'ok', 'results': customers})

@api_bp.route('/search/docnums', methods=["GET"])
@sap_login_required
def search_docnums():
    term = request.args.get('term', '')
    objtype = request.args.get('objtype', '17')
    ver_inactivos = request.args.get('ver_inactivos', 'false').lower() == 'true'
    docnums = SearchService.search_docnums(term, objtype=objtype, ver_inactivos=ver_inactivos)
    return jsonify({'status': 'ok', 'results': docnums})
