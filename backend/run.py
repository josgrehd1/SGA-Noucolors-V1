import os
from app import create_app
from app.utils.extensions import socketio

app = create_app()

if __name__ == "__main__":
    # MODO PRODUCCIÓN: debug=False elimina el Werkzeug reloader que causaba
    # recargas de página en el móvil al cambiar entre Wi-Fi y 4G en el almacén.
    # Para desarrollo local usa: FLASK_ENV=development en el .env
    is_dev = os.environ.get('FLASK_ENV', 'production') == 'development'
    port = app.config.get('PORT', 5000)
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=is_dev,
        use_reloader=False,      # Nunca recargar — evita interrupciones en almacén
        allow_unsafe_werkzeug=True
    )
