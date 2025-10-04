"""
Dialog for selecting schedule combinations without conflicts.
"""

from typing import List
from PySide6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton,
                              QLabel, QListWidget, QMessageBox)


class CombinacionDialog(QDialog):
    """Dialog for displaying and selecting schedule combinations."""
    
    def __init__(self, combinaciones: List, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Combinaciones Encontradas")
        self.setFixedSize(500, 400)
        
        self.combinaciones = combinaciones
        self.combinacion_seleccionada = None
        
        self._setup_ui()
    
    def _setup_ui(self):
        """Set up the user interface."""
        layout = QVBoxLayout()
        
        # Label
        layout.addWidget(QLabel("Selecciona una combinación sin conflictos:"))
        
        # List of combinations
        self.lista_combinaciones = QListWidget()
        for i, combo in enumerate(self.combinaciones):
            texto = f"Combinación {i+1}: {', '.join([f'{materia.nombre} ({paralelo.nombre})' for materia, paralelo in combo])}"
            self.lista_combinaciones.addItem(texto)
        layout.addWidget(self.lista_combinaciones)
        
        # Buttons
        buttons_layout = QHBoxLayout()
        
        aplicar_button = QPushButton("Aplicar Combinación")
        aplicar_button.clicked.connect(self.aplicar_combinacion)
        
        cancelar_button = QPushButton("Cancelar")
        cancelar_button.clicked.connect(self.reject)
        
        buttons_layout.addWidget(aplicar_button)
        buttons_layout.addWidget(cancelar_button)
        layout.addLayout(buttons_layout)
        
        self.setLayout(layout)
    
    def aplicar_combinacion(self):
        """Apply the selected combination."""
        index = self.lista_combinaciones.currentRow()
        if index >= 0:
            self.combinacion_seleccionada = self.combinaciones[index]
            self.accept()
        else:
            QMessageBox.warning(self, "Selección", "Por favor selecciona una combinación.")