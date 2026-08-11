import os
from flask import current_app, session
from app.data.sap_repository import SapRepository
from app.data.printer_repository import PrinterRepository
from app.utils.extensions import print_handler

class PrintService:
    """
    Servicio de Impresión ZPL Completo para Impresoras Zebra:
    - Etiquetas de Productos (prod_80x30.prn / prod_100x50.prn)
    - Etiquetas de Números de Serie/Lote (sn_80x30.prn / sn_100x50.prn)
    - Etiquetas de Ubicaciones/Estanterías (bin_80x30.prn / bin_100x50.prn)
    - Etiquetas de Bultos/Envíos (bultos_80x30.prn / bultos_100x50.prn)
    """

    @staticmethod
    def print_product(product_id, product_name, printer_id='', copies=1, serial_number=None):
        if not product_id:
            raise ValueError("Falta product_id en la petición")

        active_db = str(session.get('company_db', current_app.config.get('COMPANY_DB', ''))).upper()
        display_product_id = product_id

        # Lógica Kleantek
        if 'KLEANTEK' in active_db and str(product_id).startswith('2'):
            try:
                item_info = SapRepository.get_data("Items", id=product_id, selection=["SuppCatNum"])
                if item_info.get('status') == 'ok' and item_info.get('data'):
                    datos_item = item_info['data']
                    if isinstance(datos_item, list) and len(datos_item) > 0:
                        supp_cat_num = (datos_item[0].get('SuppCatNum') or '').strip()
                        if supp_cat_num:
                            display_product_id = f"{product_id} ({supp_cat_num})"
            except Exception as e:
                current_app.logger.warning(f"Error consultando SuppCatNum para {product_id}: {e}")

        # Determinar tamaño de plantilla ZPL
        print_size = print_handler.get_zebra_printer_size(printer_id)
        if not print_size:
            print_size = "80x30"

        print_size = str(print_size).lower()
        filename = f'prod_{print_size}.prn' if not serial_number else f'sn_{print_size}.prn'
        ruta_template = os.path.join(current_app.root_path, 'templates', 'zebra', filename)
        
        if not os.path.exists(ruta_template):
            # Fallback 80x30 / 100x50
            fallback_file = f'prod_80x30.prn' if not serial_number else f'sn_80x30.prn'
            ruta_template = os.path.join(current_app.root_path, 'templates', 'zebra', fallback_file)

        if not os.path.exists(ruta_template):
            raise FileNotFoundError(f"No se encontró la plantilla de impresión Zebra: {filename}")

        with open(ruta_template, 'r', encoding='utf-8') as file:
            template = file.read()

        template = template.replace("{OITM.ItemCode}", display_product_id)
        template = template.replace("{OITM.ItemName}", product_name or '')
        
        if serial_number:
            template = template.replace("{OSRN.DistNumber}", str(serial_number))

        template = template.replace("{COPIES}", str(max(1, int(copies))))

        success, msg = print_handler.send_zpl_to_printer(template, printer_ip=printer_id)
        if not success:
            raise Exception(msg)
        return True, "Etiqueta de producto enviada a la impresora Zebra correctamente"

    @staticmethod
    def print_bin(bin_code, printer_id='', copies=1):
        if not bin_code:
            raise ValueError("Falta el código de ubicación")

        info = SapRepository.get_data(
            resource="BinLocations", 
            filter={"BinCode": bin_code}, 
            selection=["BinCode", "Warehouse", "Sublevel1", "Sublevel2", "Sublevel3", "Sublevel4"]
        )

        datos_bin = {}
        if info.get('status') == 'ok' and info.get('data') and len(info['data']) > 0:
            datos_bin = info['data'][0]
        else:
            datos_bin = {"BinCode": bin_code, "Warehouse": "01"}

        print_size = print_handler.get_zebra_printer_size(printer_id) or "80x30"
        print_size = str(print_size).lower()
        filename = f'bin_{print_size}.prn'
        ruta_template = os.path.join(current_app.root_path, 'templates', 'zebra', filename)

        if not os.path.exists(ruta_template):
            ruta_template = os.path.join(current_app.root_path, 'templates', 'zebra', 'bin_80x30.prn')

        with open(ruta_template, 'r', encoding='utf-8') as file:
            template = file.read()

        template = template.replace("{OBIN.BinCode}", datos_bin.get('BinCode', ''))
        template = template.replace("{OBIN.WhsCode}", datos_bin.get('Warehouse', ''))
        template = template.replace("{OBIN.SL1Code}", datos_bin.get('Sublevel1', '') or '')
        template = template.replace("{OBIN.SL2Code}", datos_bin.get('Sublevel2', '') or '')
        template = template.replace("{OBIN.SL3Code}", datos_bin.get('Sublevel3', '') or '')
        template = template.replace("{OBIN.SL4Code}", datos_bin.get('Sublevel4', '') or '')
        template = template.replace("{COPIES}", str(max(1, int(copies))))

        success, msg = print_handler.send_zpl_to_printer(template, printer_ip=printer_id)
        if not success:
            raise Exception(msg)
        return True, "Etiqueta de ubicación enviada a la impresora Zebra correctamente"

    @staticmethod
    def print_bultos(entry_pedido, bultos=1, printer_id=''):
        if not entry_pedido:
            raise ValueError("Falta el identificador del pedido (entry_pedido)")

        bultos_num = max(1, int(bultos))
        info = SapRepository.get_data(
            resource="Orders",
            id=int(entry_pedido),
            selection=["CardName", "ShipToCode", "AddressExtension"]
        )

        if info.get('status') != 'ok' or not info.get('data'):
            raise Exception(f"No se encontró información del pedido #{entry_pedido} en SAP")

        # Actualizar el número de bultos en SAP (U_MAC_ObsVSTOCK)
        try:
            SapRepository.update(resource="Orders", id=int(entry_pedido), payload={"U_MAC_ObsVSTOCK": bultos_num})
        except Exception as e:
            current_app.logger.warning(f"No se pudo actualizar U_MAC_ObsVSTOCK en SAP: {e}")

        pedido_info = info['data'][0]
        cliente = pedido_info.get('CardName', '')
        clave_dir = pedido_info.get('ShipToCode', '')
        info_dir = pedido_info.get('AddressExtension', {}) or {}

        provincia = info_dir.get("ShipToState", "n.a.")
        zip_code = info_dir.get('ShipToZipCode', '')
        city = info_dir.get('ShipToCity', '')
        area = f"{zip_code} - {city} ({provincia})"
        direccion = info_dir.get("ShipToStreet", "")

        target_printer = printer_id or print_handler.get_default_ip()
        print_size = print_handler.get_zebra_printer_size(target_printer) or "100x50"
        print_size = str(print_size).lower()

        filename = f'bultos_{print_size}.prn'
        ruta_template = os.path.join(current_app.root_path, 'templates', 'zebra', filename)

        if not os.path.exists(ruta_template):
            ruta_template = os.path.join(current_app.root_path, 'templates', 'zebra', 'bultos_100x50.prn')

        # Imprimir secuencia de bultos (1 de N, 2 de N...)
        for bulto_actual in range(1, bultos_num + 1):
            with open(ruta_template, 'r', encoding='utf-8') as file:
                template = file.read()

            template = template.replace("{bulto_actual}", str(bulto_actual))
            template = template.replace("{bultos_totales}", str(bultos_num))
            template = template.replace("{cliente}", cliente)
            template = template.replace("{clave_direccion}", clave_dir)
            template = template.replace("{area}", area)
            template = template.replace("{direccion}", direccion)
            template = template.replace("{COPIES}", "1")

            success, msg = print_handler.send_zpl_to_printer(template, printer_ip=target_printer)
            if not success:
                raise Exception(f"Error imprimiendo bulto {bulto_actual}/{bultos_num}: {msg}")

        return True, f"Etiquetas de {bultos_num} bulto(s) enviadas correctamente a la impresora Zebra"

    @staticmethod
    def get_available_printers(is_zebra=True):
        return print_handler.get_printers_dict(isZebra=is_zebra)
