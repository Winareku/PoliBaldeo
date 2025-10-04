"""
Materia widget for displaying and managing course subjects.
"""

from typing import List, Dict, Any
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QPushButton,
                              QLabel, QFrame, QSpacerItem, QSizePolicy, QStyle,
                              QToolTip, QMessageBox)
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from config import CUSTOM_FONT, BUTTON_STYLE
from dialogs import AddMateriaDialog, AddParaleloDialog
from .paralelo_widget import ParaleloWidget


class MateriaWidget(QWidget):
    """Widget for displaying a materia with its paralelos."""
    
    def __init__(self, nombre: str, parent=None, creditos: int = 0):
        super().__init__(parent)
        self.nombre = nombre
        self.creditos = creditos
        self.paralelos = []
        self.is_expanded = True
        self.parent_app = parent
        
        self._setup_ui()
    
    def _setup_ui(self):
        """Set up the user interface."""
        self.main_layout = QVBoxLayout()
        self.main_layout.setContentsMargins(5, 5, 5, 5)
        self.main_layout.setSpacing(2)
        
        # Header frame
        header_frame = QFrame()
        header_frame.setFrameShape(QFrame.StyledPanel)
        header_frame.setLineWidth(1)
        header_layout = QHBoxLayout(header_frame)
        header_layout.setContentsMargins(5, 5, 5, 5)
        
        # Expand/collapse button
        self.expand_button = QPushButton()
        self.expand_button.setFixedSize(24, 24)
        self.expand_button.setIcon(self.style().standardIcon(QStyle.SP_ArrowDown))
        self.expand_button.clicked.connect(self.toggle_expand)
        self.expand_button.setStyleSheet(BUTTON_STYLE)
        self.expand_button.setToolTip("Expandir/Contraer materia")
        header_layout.addWidget(self.expand_button)
        
        # Materia label
        self.materia_label = QLabel(f"{self.nombre} ({self.creditos} créditos)")
        self.materia_label.setFont(QFont(CUSTOM_FONT, 10, QFont.Bold))
        self.materia_label.mousePressEvent = self.on_label_clicked
        header_layout.addWidget(self.materia_label, 1)
        
        # Action buttons
        self.buttons = []
        button_actions = [
            (QStyle.SP_ArrowUp, self.move_up, "Mover arriba"),
            (QStyle.SP_ArrowDown, self.move_down, "Mover abajo"),
            (QStyle.SP_FileDialogDetailedView, self.edit_materia, "Editar materia"),
            (QStyle.SP_FileDialogNewFolder, self.add_paralelo, "Añadir paralelo"),
            (QStyle.SP_TrashIcon, self.delete_materia, "Eliminar materia"),
        ]
        
        for std_icon, callback, tooltip in button_actions:
            button = QPushButton()
            button.setIcon(self.style().standardIcon(std_icon))
            button.setFixedSize(24, 24)
            button.clicked.connect(callback)
            button.setVisible(False)
            button.setStyleSheet(BUTTON_STYLE)
            button.setToolTip(tooltip)
            header_layout.addWidget(button)
            self.buttons.append(button)
        
        self.main_layout.addWidget(header_frame)
        
        # Paralelos container
        self.paralelos_widget = QWidget()
        self.paralelos_layout = QVBoxLayout(self.paralelos_widget)
        self.paralelos_layout.setContentsMargins(20, 0, 5, 5)
        self.paralelos_layout.setSpacing(1)
        self.main_layout.addWidget(self.paralelos_widget)
        
        self.paralelos_layout.addItem(QSpacerItem(0, 0, QSizePolicy.Minimum, QSizePolicy.Minimum))
        self.setLayout(self.main_layout)
    
    def enterEvent(self, event):
        """Show action buttons on mouse enter."""
        for button in self.buttons:
            button.setVisible(True)
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        """Hide action buttons on mouse leave."""
        QToolTip.hideText()
        for button in self.buttons:
            button.setVisible(False)
        super().leaveEvent(event)
    
    def move_up(self):
        """Move this materia up in the list."""
        if not self.parent_app:
            return
        materias = self.parent_app.materias
        index = materias.index(self)
        if index > 0:
            materias[index], materias[index - 1] = materias[index - 1], materias[index]
            self.parent_app.reorganizar_materias()
    
    def move_down(self):
        """Move this materia down in the list."""
        if not self.parent_app:
            return
        materias = self.parent_app.materias
        index = materias.index(self)
        if index < len(materias) - 1:
            materias[index], materias[index + 1] = materias[index + 1], materias[index]
            self.parent_app.reorganizar_materias()
    
    def on_label_clicked(self, event):
        """Handle click on materia label."""
        self.toggle_expand()
    
    def toggle_expand(self):
        """Toggle expansion state of paralelos."""
        self.is_expanded = not self.is_expanded
        self.paralelos_widget.setVisible(self.is_expanded)
        icon = self.style().standardIcon(
            QStyle.SP_ArrowDown if self.is_expanded else QStyle.SP_ArrowRight
        )
        self.expand_button.setIcon(icon)
    
    def edit_materia(self):
        """Open dialog to edit materia."""
        dialog = AddMateriaDialog(self.parent_app)
        dialog.nombre_edit.setText(self.nombre)
        dialog.creditos_spin.setValue(self.creditos)
        
        if dialog.exec():
            nuevo_nombre, nuevos_creditos = dialog.get_materia_data()
            
            if not nuevo_nombre.strip():
                QMessageBox.critical(self, "Error", "El nombre de la materia no puede estar vacío.")
                return
            
            # Check for duplicate names
            for materia in self.parent_app.materias:
                if materia.nombre == nuevo_nombre and materia != self:
                    QMessageBox.critical(self, "Error", f"Ya existe una materia con el nombre '{nuevo_nombre}'.")
                    return
            
            self.nombre = nuevo_nombre
            self.creditos = nuevos_creditos
            self.materia_label.setText(f"{nuevo_nombre} ({nuevos_creditos} créditos)")
            self.parent_app.actualizar_creditos()
    
    def add_paralelo(self):
        """Add a new paralelo to this materia."""
        dialog = AddParaleloDialog(self)
        
        if dialog.exec():
            nombre, info, bloques = dialog.get_paralelo_data()
            if nombre and bloques:
                # Check for duplicate paralelo names
                for paralelo in self.paralelos:
                    if paralelo.nombre == nombre:
                        QMessageBox.critical(self, "Error", 
                                           f"Ya existe un paralelo con el nombre '{nombre}' en esta materia.")
                        return
                
                paralelo_widget = ParaleloWidget(nombre, bloques, self, info)
                self.paralelos_layout.addWidget(paralelo_widget)
                self.paralelos.append(paralelo_widget)
                self.parent_app.verificar_conflictos()
    
    def delete_materia(self):
        """Delete this materia after confirmation."""
        # Get parent window to inherit theme
        parent_window = self.window()
        
        msg_box = QMessageBox(parent_window)
        msg_box.setIcon(QMessageBox.Warning)
        msg_box.setWindowTitle("Eliminar materia")
        msg_box.setText(
            f"¿Estás seguro de eliminar la materia '{self.nombre}' y todos sus paralelos? "
            "Esta acción no se puede deshacer."
        )
        
        eliminar_button = msg_box.addButton("Eliminar", QMessageBox.DestructiveRole)
        cancelar_button = msg_box.addButton("Cancelar", QMessageBox.RejectRole)
        
        # Set parent window to inherit theme
        msg_box.setParent(parent_window)
        
        msg_box.exec()
        
        if msg_box.clickedButton() == eliminar_button:
            self.parent_app.eliminar_materia(self)
    
    def collapse(self):
        """Collapse the paralelos view."""
        if self.is_expanded:
            self.toggle_expand()
    
    def expand(self):
        """Expand the paralelos view."""
        if not self.is_expanded:
            self.toggle_expand()
    
    def get_data(self) -> Dict[str, Any]:
        """
        Get the data representation of this materia.
        
        Returns:
            Dictionary containing materia data
        """
        data = {
            "nombre": self.nombre,
            "creditos": self.creditos,
            "paralelos": []
        }
        
        for paralelo in self.paralelos:
            paralelo_data = {
                "nombre": paralelo.nombre,
                "info": paralelo.info,
                "bloques": paralelo.bloques,
                "selected": paralelo.checkbox.isChecked()
            }
            data["paralelos"].append(paralelo_data)
        
        return data