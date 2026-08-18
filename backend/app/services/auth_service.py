from flask import session
import logging
from app.utils.extensions import sl_handler
from app.data.user_repository import UserRepository

log = logging.getLogger(__name__)

class AuthService:
    """
    Servicio de Autenticación y Gestión de Sesiones SAP.
    """

    @staticmethod
    def login(username, password, company_db):
        db_target = company_db
        if not db_target:
            return False, "Debe seleccionar una empresa/base de datos SAP al iniciar sesión."
        log.info(f"[Login] Usuario: {username} | Empresa seleccionada: {db_target}")

        # 1. Asegurar la sesión máster del Usuario Técnico (Acceso Indirecto)
        master_token = sl_handler.ensure_master_session(company_db=db_target)
        log.info(f"[Login] Master token obtenido: {'✅ SÍ' if master_token else '❌ NO'}")

        # Niveles con acceso permitido al SGA
        # S = Supervisor, A = Almacén
        # Cualquier otro nivel (T=Técnico, vacío, desconocido) queda bloqueado
        NIVELES_PERMITIDOS = ['S', 'A']

        # 2. Intentar autenticación por Empleado (U_MAC_User / U_MAC_Pass)
        if master_token:
            try:
                emp_info = UserRepository.authenticate_employee_by_udf(username, password, master_session=master_token)
                log.info(f"[Login] Empleado encontrado: {emp_info}")
                if emp_info:
                    nivel = str(emp_info.get('Nivel') or '').strip().upper()
                    log.info(f"[Login] Nivel del empleado: '{nivel}'")

                    if nivel not in NIVELES_PERMITIDOS:
                        log.warning(f"[Login] ❌ Acceso denegado por Nivel '{nivel}' — no pertenece a un perfil autorizado para el SGA")
                        return False, f"Acceso denegado. Tu perfil de usuario ('{nivel}') no tiene permisos para acceder al SGA. Contacta con el administrador."

                    session.permanent = True
                    session['sap_session'] = master_token
                    session['sap_user'] = emp_info.get('U_MAC_User', username)
                    session['sap_username'] = emp_info.get('FullName', username)
                    session['sap_employee_id'] = emp_info.get('EmployeeID', 0)
                    session['sap_salesperson'] = emp_info.get('SalesPersonCode', '')
                    session['impresora'] = emp_info.get('U_BXPDfPrn', '')
                    session['sap_nivel'] = nivel
                    session['company_db'] = db_target
                    try:
                        from app.services.sap_sync_monitor import SapSyncMonitor
                        SapSyncMonitor.register_active_db(db_target)
                    except Exception:
                        pass
                    log.info(f"[Login] ✅ Acceso Indirecto OK: {emp_info.get('FullName')} | Nivel: {nivel} (EmployeeID: {emp_info.get('EmployeeID')})")
                    return True, "Login correcto en SGA (Acceso Indirecto)"
            except Exception as e:
                log.warning(f"[Login] Error en autenticación por empleado: {e}")

        # 3. Fallback: Autenticación directa por usuario nominativo SAP B1
        res = sl_handler.login(username=username, password=password, company_db=db_target)
        if res.get('status') == 'ok':
            session['sap_user'] = username
            session['sap_username'] = username
            session['sap_password'] = password
            session['company_db'] = db_target
            try:
                from app.services.sap_sync_monitor import SapSyncMonitor
                SapSyncMonitor.register_active_db(db_target)
            except Exception:
                pass
            
            try:
                user_info = UserRepository.find_user_by_code(username)
                if user_info:
                    user_key = user_info.get('InternalKey', 0)
                    session['sap_usercode'] = user_key
                    emp_info = UserRepository.get_employee_info(user_key)
                    session['sap_employee_id'] = emp_info.get('EmployeeID', 0)
                    session['sap_salesperson'] = emp_info.get('SalesPersonCode', '')
                    session['impresora'] = emp_info.get('U_BXPDfPrn', '')
                    session['sap_nivel'] = str(emp_info.get('U_U_MAC_Nivel') or '').strip().upper()
            except Exception:
                pass
                
            return True, "Login correcto en SAP"
        else:
            if not master_token:
                return False, "Error al conectar con SAP Service Layer usando la cuenta máster. Compruebe SAP_MASTER_USER, SAP_MASTER_PASSWORD y COMPANY_DB en backend/.env"
            return False, res.get('message', 'Usuario o contraseña incorrectos en SAP / SGA')

    @staticmethod
    def logout():
        try:
            sl_handler.logout()
        except Exception:
            pass
        session.clear()
        return True

    @staticmethod
    def get_current_user():
        if 'sap_username' in session or 'sap_user' in session:
            return {
                'username': session.get('sap_username') or session.get('sap_user'),
                'company_db': session.get('company_db'),
                'employee_id': session.get('sap_employee_id', 0),
                'printer': session.get('impresora', '')
            }
        return None

    @staticmethod
    def get_available_companies():
        return [
            {'key': 'NouColors_D', 'value': 'NouColors (Producción)'},
            {'key': 'KLEANTEK_PROD', 'value': 'Kleantek (Producción)'},
            {'key': 'NouColors_D_TEST', 'value': 'Entorno de Pruebas'}
        ]
