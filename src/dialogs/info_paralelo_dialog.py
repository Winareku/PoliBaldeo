"""
Information dialog for showing paralelo details.
"""

import os
from PySide6.QtWidgets import QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QTextEdit, QMainWindow
from PySide6.QtGui import QFont
from config import THEME_FOLDER, CUSTOM_FONT, TEXTEDIT_STYLE


class InfoParaleloDialog(QDialog):
    """Dialog for displaying paralelo information."""
    
    def __init__(self, info_text: str, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Información del Paralelo")
        self.setFixedSize(400, 300)
        
        # Aplicar tema Dark.qss directamente
        qss_file = os.path.join(THEME_FOLDER, 'Dark.qss')
        if os.path.exists(qss_file):
            with open(qss_file, 'r') as f:
                self.setStyleSheet(f.read())
    
        self._setup_ui(info_text)
    
    def _setup_ui(self, info_text: str):
        """Set up the user interface."""
        layout = QVBoxLayout()
        
        # Info text edit
        self.info_edit = QTextEdit()
        self.info_edit.setPlainText(info_text)
        self.info_edit.setReadOnly(True)
        self.info_edit.setStyleSheet(TEXTEDIT_STYLE)
        layout.addWidget(self.info_edit)
        
        # Buttons
        buttons_layout = QHBoxLayout()
        close_button = QPushButton("Cerrar")
        close_button.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        close_button.clicked.connect(self.close)
        buttons_layout.addWidget(close_button)
        layout.addLayout(buttons_layout)
        
        self.setLayout(layout)