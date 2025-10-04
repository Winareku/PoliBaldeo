"""
Dialog for adding or editing materias.
"""

from typing import Tuple
from PySide6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton,
                              QLabel, QLineEdit, QSpinBox, QMessageBox)
from PySide6.QtGui import QFont
from config import CUSTOM_FONT, DEFAULT_CREDITS, MAX_CREDITS


class AddMateriaDialog(QDialog):
    """Dialog for adding or editing a materia."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Editar Materia")
        self.setFixedSize(300, 150)
        
        self._setup_ui()
    
    def _setup_ui(self):
        """Set up the user interface."""
        layout = QVBoxLayout()
        
        # Name field
        label = QLabel("Nombre de la Materia:")
        label.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        layout.addWidget(label)
        
        self.nombre_edit = QLineEdit()
        layout.addWidget(self.nombre_edit)
        
        # Credits field
        creditos_layout = QHBoxLayout()
        creditos_label = QLabel("Créditos:")
        creditos_label.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        creditos_layout.addWidget(creditos_label)
        
        self.creditos_spin = QSpinBox()
        self.creditos_spin.setRange(0, MAX_CREDITS)
        self.creditos_spin.setValue(DEFAULT_CREDITS)
        creditos_layout.addWidget(self.creditos_spin)
        layout.addLayout(creditos_layout)
        
        # Buttons
        buttons_layout = QHBoxLayout()
        accept_button = QPushButton("Aceptar")
        accept_button.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        accept_button.clicked.connect(self.accept)
        
        cancel_button = QPushButton("Cancelar")
        cancel_button.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        cancel_button.clicked.connect(self.reject)
        
        buttons_layout.addWidget(accept_button)
        buttons_layout.addWidget(cancel_button)
        layout.addLayout(buttons_layout)
        
        self.setLayout(layout)
    
    def get_materia_data(self) -> Tuple[str, int]:
        """
        Get the materia data from the dialog.
        
        Returns:
            Tuple of (name, credits)
        """
        return self.nombre_edit.text(), self.creditos_spin.value()
    
    def accept(self):
        """Validate and accept the dialog."""
        if not self.nombre_edit.text().strip():
            QMessageBox.critical(self, "Error", "El nombre de la materia no puede estar vacío.")
            return
        
        super().accept()