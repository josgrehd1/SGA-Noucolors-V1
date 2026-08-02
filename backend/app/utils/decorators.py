from functools import wraps
from flask import session, jsonify

def sap_login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not (session.get('sap_session') or session.get('sap_username') or session.get('sap_user')):
            return jsonify({
                'status': 'error',
                'authenticated': False,
                'message': 'Sesión no iniciada o caducada en SAP. Por favor inicie sesión.'
            }), 401
        return view(*args, **kwargs)
    return wrapped_view
