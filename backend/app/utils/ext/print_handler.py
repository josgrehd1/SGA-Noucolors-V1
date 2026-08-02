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

    def send_zpl_to_printer(self, zpl_data, printer_ip='', port=9100):
        try:
            active_db = session.get('company_db', current_app.config.get('COMPANY_DB', '')) if session else current_app.config.get('COMPANY_DB', '')
            if 'TEST' in active_db:
                return True, "TEST ZPL enviado con éxito."

            if not printer_ip:
                printer_ip = self.get_default_ip()
                
            if not printer_ip:
                return False, "Error: No se ha configurado una IP de impresora Zebra válida."

            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(3.0)
                s.connect((printer_ip, port))
                s.sendall(zpl_data.encode('utf-8'))
            return True, "Etiqueta enviada correctamente."
        except socket.timeout:
            return False, f"Error: Tiempo de espera agotado con la impresora Zebra ({printer_ip})."
        except Exception as e:
            return False, f"Error de conexión con la impresora Zebra ({printer_ip}): {str(e)}"
        
    def send_pdf_to_printer(self, pdf_bytes):
        temp_path = None
        try:
            printer_name = session.get('impresora_pdf') or self.get_default_pdf_printer_name() or 'ImpresoraSergio'
            
            if not printer_name:
                return False, "Error: No se ha especificado ni encontrado ninguna impresora PDF válida."

            sumatra_path = binaries.SUMATRA_PATH
            if not sumatra_path or not os.path.exists(sumatra_path):
                return False, f"No se encuentra SumatraPDF.exe (SUMATRA_PATH={sumatra_path})"

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
                temp_pdf.write(pdf_bytes)
                temp_path = temp_pdf.name

            active_db = session.get('company_db', current_app.config.get('COMPANY_DB', '')) if session else current_app.config.get('COMPANY_DB', '')
            if 'TEST' in active_db:
                return True, "TEST PDF enviado con éxito a la impresora."

            resultado = subprocess.run(
                [
                    sumatra_path,
                    "-print-to",
                    printer_name,
                    "-silent",
                    "-exit-when-done",
                    temp_path,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if resultado.returncode == 0:
                return True, "PDF enviado con éxito a la impresora."
            else:
                error_msg = resultado.stderr.strip() or resultado.stdout.strip() or "Código de error desconocido"
                return False, f"Error de SumatraPDF (code {resultado.returncode}): {error_msg}"

        except subprocess.TimeoutExpired:
            return False, "Tiempo de espera agotado al intentar imprimir PDF (30s)."
        except Exception as e:
            return False, f"Error general en la función de impresión PDF: {str(e)}"
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except PermissionError:
                    pass
        
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
    
    def get_default_ip(self):
        impresora_std = session.get('impresora') if session else None
        if not impresora_std:
            return ''
        printer_info = self.printer_ips.get(impresora_std)
        return printer_info.get('IP', '') if printer_info else ''
    
    def get_default_pdf_ip(self):
        impresora_pdf_std = session.get('impresora_pdf') or session.get('impresora') if session else None
        if not impresora_pdf_std:
            return ''
        printer_info = self.printer_ips.get(impresora_pdf_std)
        return printer_info.get('IPPDF', '') if printer_info else ''
    
    def get_default_pdf_printer_name(self):
        impresora_pdf_std = session.get('impresora_pdf') or session.get('impresora') if session else None
        if not impresora_pdf_std:
            return 'ImpresoraSergio'
        printer_info = self.printer_ips.get(impresora_pdf_std)
        return printer_info.get('NOMIMPPDF', 'ImpresoraSergio') if printer_info else 'ImpresoraSergio'
    
    def get_zebra_printer_size(self, printer_ip):
        printers = self.printer_ips.values()
        if not printer_ip:
            printer_ip = self.get_default_ip()
        
        return next((datos["Size"] for datos in printers if isinstance(datos, dict) and datos.get("IP") == printer_ip), "100X50")