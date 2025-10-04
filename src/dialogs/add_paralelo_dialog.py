"""
Dialog for adding or editing paralelos.
"""

import os
from typing import List, Tuple, Optional
from PySide6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, 
                              QLabel, QLineEdit, QComboBox, QWidget, QTextEdit,
                              QMessageBox, QScrollArea, QMainWindow)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from config import THEME_FOLDER, CUSTOM_FONT, TEXTEDIT_STYLE, DIAS_SEMANA


class CustomComboBox(QComboBox):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMaxVisibleItems(6)  # Show ~6 items when expanded
        
    def wheelEvent(self, event):
        """Override wheel event to prevent scrolling when combobox is closed"""
        if not self.view().isVisible():
            event.ignore()
        else:
            super().wheelEvent(event)

class AddParaleloDialog(QDialog):
    """Dialog for adding or editing a paralelo."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Editar Paralelo")
        self.setFixedSize(480, 560)
        
        # Aplicar tema Dark.qss directamente
        qss_file = os.path.join(THEME_FOLDER, 'Dark.qss')
        if os.path.exists(qss_file):
            with open(qss_file, 'r') as f:
                self.setStyleSheet(f.read())
    
        self.bloques = []
        self.original_nombre = None
        
        self._setup_ui()
    
    def _setup_ui(self):
        """Set up the user interface."""
        layout = QVBoxLayout()
        
        # Name field
        nombre_layout = QHBoxLayout()
        nombre_label = QLabel("Nombre:")
        nombre_label.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        nombre_layout.addWidget(nombre_label)
        self.nombre_edit = QLineEdit()
        nombre_layout.addWidget(self.nombre_edit)
        layout.addLayout(nombre_layout)
        
        # Additional info field
        info_layout = QVBoxLayout()
        info_label = QLabel("Información adicional:")
        info_label.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        info_layout.addWidget(info_label)
        self.info_edit = QTextEdit()
        self.info_edit.setMinimumHeight(60)  # Set minimum height
        self.info_edit.setMaximumHeight(100)
        self.info_edit.setStyleSheet(TEXTEDIT_STYLE)
        info_layout.addWidget(self.info_edit)
        layout.addLayout(info_layout)
        
        # Time blocks section
        bloques_label = QLabel("Bloques Horarios:")
        bloques_label.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        layout.addWidget(bloques_label)
        
        # Create scroll area for bloques
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        
        # Create container widget for bloques
        self.bloques_container = QWidget()
        self.bloques_layout = QVBoxLayout(self.bloques_container)
        self.bloques_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        
        scroll_area.setWidget(self.bloques_container)
        scroll_area.setMinimumHeight(150)
        layout.addWidget(scroll_area)
        
        # Add day button
        add_button = QPushButton("Añadir Día")
        add_button.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        add_button.clicked.connect(self.add_bloque_horario)
        layout.addWidget(add_button)
        
        # Dialog buttons
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
    
    def add_bloque_horario(self):
        """Add a new time block."""
        bloque_layout = QHBoxLayout()
        
        # Day combo - using CustomComboBox
        dia_combo = CustomComboBox()
        dia_combo.addItems(DIAS_SEMANA)
        bloque_layout.addWidget(dia_combo)
        
        # Start time - using CustomComboBox
        bloque_layout.addWidget(QLabel("de"))
        hora_inicio = CustomComboBox()
        self._add_horas(hora_inicio)
        bloque_layout.addWidget(hora_inicio)
        
        # End time - using CustomComboBox
        bloque_layout.addWidget(QLabel("a"))
        hora_fin = CustomComboBox()
        self._add_horas(hora_fin)
        hora_fin.setCurrentIndex(2)
        bloque_layout.addWidget(hora_fin)
        
        # Delete button
        delete_button = QPushButton("X")
        delete_button.setFont(QFont(CUSTOM_FONT, weight=QFont.Bold))
        bloque_layout.addWidget(delete_button)
        
        bloque_widget = QWidget()
        bloque_widget.setLayout(bloque_layout)
        
        delete_button.clicked.connect(lambda: self.remove_bloque(bloque_widget))
        
        self.bloques_layout.addWidget(bloque_widget)
        self.bloques.append((bloque_widget, dia_combo, hora_inicio, hora_fin))
    
    def remove_bloque(self, widget: QWidget):
        """Remove a time block."""
        for i, (w, _, _, _) in enumerate(self.bloques):
            if w == widget:
                self.bloques.pop(i)
                break
        widget.deleteLater()
        self.adjustSize()
    
    def _add_horas(self, combo: QComboBox):
        """Add time options to combo box."""
        for hora in range(7, 22):
            combo.addItem(f"{hora:02d}:00")
            if hora < 21:
                combo.addItem(f"{hora:02d}:30")
    
    def get_paralelo_data(self) -> Tuple[str, str, List[str]]:
        """
        Get the paralelo data from the dialog.
        
        Returns:
            Tuple of (name, info, blocks)
        """
        nombre = self.nombre_edit.text()
        info = self.info_edit.toPlainText()
        bloques = []
        
        for _, dia_combo, hora_inicio, hora_fin in self.bloques:
            dia = dia_combo.currentText()
            inicio = hora_inicio.currentText()
            fin = hora_fin.currentText()
            bloques.append(f"{dia} {inicio}-{fin}")
        
        return nombre, info, bloques
    
    def accept(self):
        """Validate and accept the dialog."""
        if not self.nombre_edit.text().strip():
            msg = QMessageBox(QMessageBox.Critical, "Error", 
                            "El nombre del paralelo no puede estar vacío.",
                            parent=self)
            msg.exec()
            return
        
        if not self.bloques:
            msg = QMessageBox(QMessageBox.Critical, "Error", 
                            "Debe haber al menos un bloque horario.",
                            parent=self)
            msg.exec()
            return
        
        # Check for duplicate names
        if hasattr(self.parent(), 'paralelos'):
            for paralelo in self.parent().paralelos:
                if (paralelo.nombre == self.nombre_edit.text().strip() and 
                    paralelo.nombre != self.original_nombre):
                    QMessageBox.critical(self, "Error", 
                                       f"Ya existe un paralelo con el nombre '{self.nombre_edit.text().strip()}'.")
                    return
        
        # Validate all fields are complete
        for _, dia_combo, hora_inicio, hora_fin in self.bloques:
            if not dia_combo.currentText() or not hora_inicio.currentText() or not hora_fin.currentText():
                QMessageBox.critical(self, "Error", "Todos los campos deben estar completos.")
                return
        
        # Validate time ranges
        for _, dia_combo, hora_inicio, hora_fin in self.bloques:
            inicio = hora_inicio.currentText()
            fin = hora_fin.currentText()
            if inicio >= fin:
                QMessageBox.critical(self, "Error", 
                                   f"La hora de fin ({fin}) debe ser mayor que la hora de inicio ({inicio}).")
                return
        
        super().accept()