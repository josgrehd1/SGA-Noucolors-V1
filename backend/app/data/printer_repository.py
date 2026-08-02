import os
import json

class PrinterRepository:
    """
    Repositorio de acceso a la configuración de impresoras (impresoras.json).
    """

    @staticmethod
    def get_printers():
        app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        json_path = os.path.join(app_dir, 'impresoras.json')
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    @staticmethod
    def get_printers_list(is_zebra=True):
        printers = PrinterRepository.get_printers()
        return [
            {'key': v.get('IP', ''), 'value': k}
            for k, v in printers.items()
            if (is_zebra and 'Zebra' in k) or not is_zebra
        ]
