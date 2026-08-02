from flask import session
from app.utils.extensions import sl_handler
from app.data.user_repository import UserRepository

class AuthService:
    """
    Servicio de Autenticación y Gestión de Sesiones SAP.
    """

    @staticmethod
    def login(username, password, company_db):
        db_target = company_db or 'NouColors_D'
        res = sl_handler.login(username=username, password=password, company_db=db_target)
        if res.get('status') == 'ok':
            session['sap_user'] = username
            session['sap_username'] = username
            session['sap_password'] = password
            session['company_db'] = db_target
            
            # Obtener datos adicionales del usuario
            try:
                user_info = UserRepository.find_user_by_code(username)
                if user_info:
                    user_key = user_info.get('InternalKey', 0)
                    session['sap_usercode'] = user_key
                    emp_info = UserRepository.get_employee_info(user_key)
                    session['sap_employee_id'] = emp_info.get('EmployeeID', 0)
                    session['sap_salesperson'] = emp_info.get('SalesPersonCode', '')
                    session['impresora'] = emp_info.get('U_BXPDfPrn', '')
            except Exception:
                pass
                
            return True, "Login correcto en SAP"
        else:
            return False, res.get('message', 'Error de autenticación en SAP')

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
