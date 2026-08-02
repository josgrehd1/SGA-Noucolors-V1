import os
import platform

# Variable global que usará printing.py
SUMATRA_PATH = None

def register_binaries():
    global SUMATRA_PATH

    if platform.system() == "Darwin":
        os.environ['PANGO_LIB'] = "/opt/homebrew/opt/pango/lib"
        os.environ['CAIRO_LIB'] = "/opt/homebrew/opt/cairo/lib"
        os.environ['DYLD_FALLBACK_LIBRARY_PATH'] = "/opt/homebrew/lib"

    # If it's Windows, WeasyPrint usually finds the DLLs automatically 
    # if they are installed via pip, or you don't need these specific exports.
    elif platform.system() == "Windows":

        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 1. Configurar Binarios (.dll)
        bin_path = os.path.join(base_dir, 'binaries')
        if os.path.exists(bin_path):
            os.environ['PATH'] = bin_path + os.pathsep + os.environ.get('PATH', '')
            os.add_dll_directory(bin_path)

        # 2. Configurar Fuentes (Para eliminar el error de Fontconfig)
        # Apuntamos a la carpeta 'etc/fonts' que acabamos de añadir
        fonts_path = os.path.join(base_dir, 'etc', 'fonts')
        if os.path.exists(fonts_path):
            os.environ['FONTCONFIG_PATH'] = fonts_path

        # 3. Localizar SumatraPDF.exe (para impresión de PDFs)
        sumatra_exe = os.path.join(bin_path, 'SumatraPDF-3.6.1-64.exe')
        if os.path.exists(sumatra_exe):
            SUMATRA_PATH = sumatra_exe
        else:
            SUMATRA_PATH = None