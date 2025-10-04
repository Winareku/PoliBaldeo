"""
Configuration file for PoliBaldeo application.
"""

import os
import sys
from PySide6.QtGui import QFontDatabase

# Determine script path based on execution context
if getattr(sys, 'frozen', False):
    SCRIPT_PATH = os.path.dirname(sys.executable)
else:
    SCRIPT_PATH = os.path.dirname(os.path.abspath(__file__))

# Resource paths
ICON_PATH = os.path.join(SCRIPT_PATH, "resources", "PoliBaldeo.png")
DOWNLOAD_ICON_PATH = os.path.join(SCRIPT_PATH, "resources", "download.png")
THEME_FOLDER = os.path.join(SCRIPT_PATH, "themes")
FONT_PATH = os.path.join(SCRIPT_PATH, "resources", "LexendDeca.ttf")

# UI Configuration
CUSTOM_FONT = "Arial"  # Default font, will be updated after QApplication initialization
DEFAULT_WINDOW_SIZE = (640, 480)
CALENDARIO_WINDOW_SIZE = (1280, 720)
CALENDARIO_MIN_SIZE = (1080, 300)

# Academic Configuration
DEFAULT_CREDITS = 3
MAX_CREDITS = 10
SEMESTER_WEEKS = 16

# Time Configuration
HORA_INICIO = 7  # 7:00 AM
HORA_FIN = 22    # 10:00 PM

# Days of week
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]

# File extensions
POLIBALDEO_EXTENSION = ".poli"
ICALENDAR_EXTENSION = ".ics"

# Style sheets
BUTTON_STYLE = """
    QPushButton {
        background-color: transparent;
        border: 2px solid #5c6e91;
        border-radius: 3px;
    }
    QPushButton:hover {
        background-color: rgba(119, 119, 119, 0.1);
    }
"""

CHECKBOX_STYLE = """
    QCheckBox::indicator {
        width: 24px;
        height: 24px;
    }
    QCheckBox::indicator:unchecked {
        border: 2px solid #5c6e91;
        border-radius: 3px;
        background-color: #2b2b2b;
    }
    QCheckBox::indicator:checked {
        border: 2px solid #5c6e91;
        border-radius: 3px;
        background-color: #5c6e91;
    }
    QCheckBox::indicator:checked:hover {
        background-color: #6c7ea1;
    }
    QCheckBox::indicator:unchecked:hover {
        background-color: #3b3b3b;
    }
"""

TEXTEDIT_STYLE = """
    QTextEdit {
        background-color: #2b2b2b;
        color: #ffffff;
        border: 1px solid #5c6e91;
        border-radius: 3px;
    }
"""

DEFAULT_THEME = """
    QWidget {
        background-color: #121212;
        color: #e0e0e0;
    }

    QPushButton {
        background-color: #1e1e1e;
        color: #e0e0e0;
        border: 2px solid #2a7fff;
        border-radius: 4px;
        padding: 8px 16px;
    }

    QPushButton:hover {
        background-color: #2d2d2d;
    }

    QPushButton:pressed {
        background-color: #2a7fff;
        color: #121212;
    }

    QLineEdit, QTextEdit {
        background-color: #1e1e1e;
        color: #e0e0e0;
        border: 2px solid #2a7fff;
        border-radius: 4px;
        padding: 4px;
    }

    QComboBox {
        background-color: #1e1e1e;
        color: #e0e0e0;
        border: 2px solid #2a7fff;
        border-radius: 4px;
        padding: 4px;
    }

    QScrollBar:vertical, QScrollBar:horizontal {
        background: #121212;
        border: none;
        width: 8px;
    }

    QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
        background: none;
    }

    QScrollBar::handle {
        background: #404040;
        border-radius: 4px;
    }

    QScrollBar::handle:hover {
        background: #2a7fff;
    }

    QScrollBar::add-line, QScrollBar::sub-line {
        background: none;
    }
"""