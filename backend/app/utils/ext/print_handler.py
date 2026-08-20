import json
import os
import socket
import subprocess
import tempfile
from flask import flash, session, current_app
import binaries

class PrintHandler:
    def __init__(self):
        printers = self.get_printers()
        self.printer_ips = {name: ip for name, ip in printers.items()}

    def is_printing_disabled_for_test(self):
        try:
            from flask import session, request, has_request_context
            if not has_request_context():
                return False

            company = str(session.get('company_db') or session.get('sap_company_db') or '').upper()
            if 'TEST' in company:
                header_val = request.headers.get('X-Test-Print-Enabled')
                if header_val is not None:
                    return header_val.lower() not in ('true', '1', 'yes')
                return not session.get('test_print_enabled', False)
        except Exception:
            pass
        return False

    def send_zpl_to_printer(self, zpl_data, printer_ip='', port=9100):
        if self.is_printing_disabled_for_test():
            return True, "Impresión simulada/omitida (Entorno TEST con impresión desactivada)"

        try:
            if not printer_ip:
                printer_ip = self.get_default_ip()
                
            if not printer_ip:
                return False, "Error: No se ha configurado una IP de impresora Zebra válida."

            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(4.0)
                s.connect((printer_ip, port))
                s.sendall(zpl_data.encode('utf-8'))
            return True, f"Etiqueta ZPL enviada correctamente por IP a {printer_ip}."
        except socket.timeout:
            return False, f"Error: Tiempo de espera agotado con la impresora Zebra ({printer_ip}:{port})."
        except Exception as e:
            return False, f"Error de conexión con la impresora Zebra ({printer_ip}:{port}): {str(e)}"

    def send_pdf_via_socket(self, pdf_bytes, printer_ip='', port=9100):
        if self.is_printing_disabled_for_test():
            return True, "Impresión PDF simulada/omitida (Entorno TEST con impresión desactivada)"

        try:
            if not printer_ip:
                printer_ip = self.get_default_pdf_ip()

            if not printer_ip:
                return False, "Error: No se ha configurado una IP de impresora de albaranes válida."

            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(6.0)
                s.connect((printer_ip, port))
                s.sendall(pdf_bytes)
            return True, f"Albarán PDF enviado con éxito vía Socket IP a {printer_ip}:{port}."
        except socket.timeout:
            return False, f"Tiempo de espera agotado conectando con la impresora de albaranes ({printer_ip}:{port})."
        except Exception as e:
            return False, f"Error de conexión Socket con la impresora ({printer_ip}:{port}): {str(e)}"
        
    def _send_pdf_via_sumatra(self, pdf_bytes, printer_name, sumatra_path):
        """Envía el PDF al spooler local de Windows mediante SumatraPDF."""
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
                temp_pdf.write(pdf_bytes)
                temp_path = temp_pdf.name

            resultado = subprocess.run(
                [
                    sumatra_path,
                    "-print-to",
                    printer_name,
                    "-silent",
                    temp_path,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if resultado.returncode == 0:
                return True, f"Albarán PDF enviado con éxito a {printer_name}."
            else:
                error_msg = resultado.stderr.strip() or resultado.stdout.strip() or "Error desconocido"
                return False, f"Error imprimiendo en {printer_name}: {error_msg}"
        except subprocess.TimeoutExpired:
            return False, f"Tiempo de espera agotado al imprimir en {printer_name} (30s)."
        except Exception as e:
            return False, f"Error en spooler ({printer_name}): {str(e)}"
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except PermissionError:
                    pass

    def send_pdf_to_printer(self, pdf_bytes, printer_ip=''):
        """
        Imprime el PDF del albarán de forma directa:
        1. Si la impresora tiene un driver/nombre de Windows configurado (ej. Brother MFC, Kyocera, Canon)
           y existe SumatraPDF en el servidor, imprime directamente mediante el spooler de red.
        2. Si no, envía el flujo directo por Socket TCP 9100.
        """
        if self.is_printing_disabled_for_test():
            return True, "Impresión PDF simulada/omitida (Entorno TEST con impresión desactivada)"

        target_ip = printer_ip or self.get_default_pdf_ip()
        printers = self.get_printers()
        albaranes = printers.get('albaranes') if isinstance(printers.get('albaranes'), dict) else printers
        
        # 1. Buscar si hay configuración específica de Windows para esta IP o nombre
        windows_printer = None
        for name, data in albaranes.items():
            if isinstance(data, dict):
                if data.get('ip') == target_ip or name == target_ip or data.get('impresora_windows') == target_ip:
                    windows_printer = data.get('impresora_windows') or data.get('nombre_local') or data.get('NOMIMPPDF') or name
                    break
            elif name == target_ip or data == target_ip:
                windows_printer = name
                break

        sumatra_path = getattr(binaries, 'SUMATRA_PATH', None)

        # 2. Si tiene impresora Windows asignada en el servidor -> SumatraPDF Spooler
        if windows_printer and sumatra_path and os.path.exists(sumatra_path):
            success, msg = self._send_pdf_via_sumatra(pdf_bytes, windows_printer, sumatra_path)
            if success:
                return True, msg
            else:
                current_app.logger.warning(f"[PrintHandler] Falló SumatraPDF ({windows_printer}): {msg}. Intentando Socket IP...")

        # 3. Envío por Socket TCP IP directa (para impresoras con motor PDF nativo)
        if target_ip:
            success, msg = self.send_pdf_via_socket(pdf_bytes, printer_ip=target_ip)
            if success:
                return True, msg

        # 4. Fallback si no funcionó lo anterior
        if sumatra_path and os.path.exists(sumatra_path):
            fallback_printer = windows_printer or self.get_default_pdf_printer_name() or 'Brother MFC-J5330DW'
            return self._send_pdf_via_sumatra(pdf_bytes, fallback_printer, sumatra_path)

        return False, f"No se pudo enviar el PDF a la impresora ({target_ip or 'sin IP'})."
        
    def get_printers(self):
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            app_dir = os.path.abspath(os.path.join(current_dir, "..", "..")) 
            ruta_json = os.path.join(app_dir, 'impresoras.json')
            if os.path.exists(ruta_json):
                with open(ruta_json, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return {}
        
    def get_printers_dict(self, isZebra=True):
        printers = self.get_printers()
        return [
            {'key': v.get('IP', ''), 'value': k} 
            for k, v in printers.items() 
            if (isZebra and 'Zebra' in k) or not isZebra
        ]

    def get_zebra_printers(self):
        """Catálogo de impresoras Zebra para etiquetas con detalles de IP y formato"""
        printers = self.get_printers()
        result = []
        etiquetas_dict = printers.get('etiquetas') if isinstance(printers.get('etiquetas'), dict) else printers
        for name, data in etiquetas_dict.items():
            if not isinstance(data, dict):
                continue
            ip = data.get('ip') or data.get('IP', '')
            if ip and ('albaran' not in name.lower()):
                result.append({
                    'key': ip,
                    'value': f"{name} ({ip})",
                    'name': name,
                    'ip': ip,
                    'size': data.get('size') or data.get('Size', '80X30')
                })
        return result

    def get_pdf_printers(self):
        """Catálogo de impresoras de red para Albaranes / Documentos PDF por Socket IP"""
        printers = self.get_printers()
        result = []
        albaranes_dict = printers.get('albaranes') if isinstance(printers.get('albaranes'), dict) else printers
        for name, data in albaranes_dict.items():
            if not isinstance(data, dict):
                continue
            ip_pdf = data.get('ip') or data.get('IPPDF') or data.get('IP', '')
            if ip_pdf:
                result.append({
                    'key': ip_pdf,
                    'value': f"{name} ({ip_pdf})",
                    'name': name,
                    'ip': ip_pdf,
                    'nom_local': data.get('nombre_local') or data.get('NOMIMPPDF', '')
                })
        return result
    
    def get_default_ip(self):
        from flask import request, has_request_context
        impresora_std = None
        if has_request_context():
            impresora_std = request.headers.get('X-Active-Printer')
        if not impresora_std and session:
            impresora_std = session.get('impresora') or session.get('active_printer')

        printers = self.get_printers()
        etiquetas = printers.get('etiquetas') if isinstance(printers.get('etiquetas'), dict) else printers

        if impresora_std:
            # Si ya es una IP directa
            if '.' in str(impresora_std) and len(str(impresora_std).split('.')) == 4:
                return str(impresora_std).strip()
            # 1. Búsqueda exacta
            data = etiquetas.get(impresora_std)
            if isinstance(data, dict) and data.get('ip'):
                return data.get('ip')
            # 2. Búsqueda por coincidencia de nombre
            for name, d in etiquetas.items():
                if isinstance(d, dict) and (name.lower() in str(impresora_std).lower() or str(impresora_std).lower() in name.lower()):
                    return d.get('ip') or d.get('IP', '')

        zebra_list = self.get_zebra_printers()
        return zebra_list[0]['ip'] if zebra_list else ''
    
    def get_default_pdf_ip(self):
        from flask import request, has_request_context
        impresora_pdf_std = None
        if has_request_context():
            impresora_pdf_std = request.headers.get('X-Active-Pdf-Printer')
        if not impresora_pdf_std and session:
            impresora_pdf_std = session.get('impresora_pdf') or session.get('active_pdf_printer') or session.get('impresora')

        printers = self.get_printers()
        albaranes = printers.get('albaranes') if isinstance(printers.get('albaranes'), dict) else printers

        if impresora_pdf_std:
            # Si ya es una IP directa
            if '.' in str(impresora_pdf_std) and len(str(impresora_pdf_std).split('.')) == 4:
                return str(impresora_pdf_std).strip()
            # 1. Búsqueda exacta
            data = albaranes.get(impresora_pdf_std)
            if isinstance(data, dict) and (data.get('ip') or data.get('IPPDF')):
                return data.get('ip') or data.get('IPPDF')
            # 2. Búsqueda por coincidencia de nombre
            for name, d in albaranes.items():
                if isinstance(d, dict):
                    clean_target = str(impresora_pdf_std).lower().replace('impresora', '').replace('zebra', '').replace('albaranes', '').strip()
                    if clean_target and (clean_target in name.lower() or name.lower() in str(impresora_pdf_std).lower()):
                        return d.get('ip') or d.get('IPPDF') or d.get('IP', '')

        pdf_list = self.get_pdf_printers()
        return pdf_list[0]['ip'] if pdf_list else ''
    
    def get_default_pdf_printer_name(self):
        from flask import request, has_request_context
        impresora_pdf_std = None
        if has_request_context():
            impresora_pdf_std = request.headers.get('X-Active-Pdf-Printer')
        if not impresora_pdf_std and session:
            impresora_pdf_std = session.get('impresora_pdf') or session.get('active_pdf_printer') or session.get('impresora')

        printers = self.get_printers()
        albaranes = printers.get('albaranes') if isinstance(printers.get('albaranes'), dict) else printers
        
        if impresora_pdf_std:
            for name, d in albaranes.items():
                if isinstance(d, dict):
                    if d.get('ip') == impresora_pdf_std or name == impresora_pdf_std or d.get('impresora_windows') == impresora_pdf_std:
                        return d.get('impresora_windows') or d.get('nombre_local') or d.get('NOMIMPPDF') or name
                    clean_target = str(impresora_pdf_std).lower().replace('impresora', '').replace('zebra', '').replace('albaranes', '').strip()
                    if clean_target and (clean_target in name.lower() or name.lower() in str(impresora_pdf_std).lower()):
                        return d.get('impresora_windows') or d.get('nombre_local') or d.get('NOMIMPPDF') or name
                        
        return 'Brother MFC-J5330DW Printer'
    
    def get_zebra_printer_size(self, printer_ip):
        printers = self.get_printers()
        etiquetas = printers.get('etiquetas') if isinstance(printers.get('etiquetas'), dict) else printers
        for name, data in etiquetas.items():
            if isinstance(data, dict):
                ip = data.get('ip') or data.get('IP')
                if ip == printer_ip:
                    return data.get('size') or data.get('Size', '80X30')
        return "80X30"