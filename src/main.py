#!/usr/bin/env python
"""
PoliBaldeo
Main entry point for the application.

Author: Winareku
License: MIT
"""

import sys
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QFontDatabase, QIcon
from windows import PoliBaldeo
from config import FONT_PATH, DEFAULT_THEME, ICON_PATH

def load_custom_font():
    """Load custom font and return font family name"""
    font_id = QFontDatabase.addApplicationFont(FONT_PATH)
    if font_id != -1:
        return QFontDatabase.applicationFontFamilies(font_id)[0]
    return "Arial"

def main():
    app = QApplication([])
    app.setWindowIcon(QIcon(ICON_PATH))
    
    # Aplicar tema por defecto
    app.setStyleSheet(DEFAULT_THEME)
    
    # Cargar fuente después de inicializar QApplication
    font_family = load_custom_font()
    
    # Crear y mostrar la ventana principal
    window = PoliBaldeo()
    window.show()
    
    return app.exec()

if __name__ == "__main__":
    sys.exit(main())
