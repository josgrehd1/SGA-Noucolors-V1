"""
Diccionarios generales y constantes para mapeo
"""

SAP_TIPO_MOVIMIENTO_MAP = {
    13: ("Factura Venta", "venta"),
    14: ("Abono Cliente", "compra"),
    15: ("Entrega Cliente", "venta"),
    16: ("Devolución Cliente", "compra"),
    18: ("Factura Compra", "compra"),
    19: ("Abono Proveedor", "venta"),
    20: ("Orden de Compra", "compra"),
    21: ("Devolución Mercancía", "venta"),
    58: ("Entrada de producto", "compra"),
    59: ("Entrada Mercancía", "compra"),
    60: ("Salida Mercancía", "venta"),
    67: ("Traslado Almacén", "traslado"),
    10000071: ("Ajuste Inventario", "ajuste"),
    
}
