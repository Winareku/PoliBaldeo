"""
Paralelo widget for displaying and managing course sections.
"""

from typing import List
from PySide6.QtWidgets import (QWidget, QHBoxLayout, QPushButton, QLabel,
                              QCheckBox, QStyle, QToolTip, QMessageBox)
from PySide6.QtGui import QFont
from config import CHECKBOX_STYLE, BUTTON_STYLE
from dialogs import AddParaleloDialog, InfoParaleloDialog


class ParaleloWidget(QWidget):
    """Widget for displaying a paralelo (course section)."""
    
    def __init__(self, nombre: str, bloques: List[str], parent=None, info: str = ""):
        super().__init__()
        self.nombre = nombre
        self.bloques = bloques
        self.info = info
        self.parent_materia = parent
        
        self._setup_ui()
    
    def _setup_ui(self):
        """Set up the user interface."""
        layout = QHBoxLayout()
        layout.setContentsMargins(0, 2, 1, 2)
        layout.setSpacing(5)
        
        # Checkbox for selection
        self.checkbox = QCheckBox()
        self.checkbox.setStyleSheet(CHECKBOX_STYLE)
        self.checkbox.clicked.connect(self.on_selected)
        layout.addWidget(self.checkbox)
        
        # Label with paralelo info
        info_text = f"{self.nombre} | {'; '.join(self.bloques)}"
        self.label = QLabel(info_text)
        self.label.mousePressEvent = self.on_label_clicked
        layout.addWidget(self.label, 1)
        
        # Action buttons (hidden by default)
        self.buttons = []
        button_actions = [
            (QStyle.SP_ArrowUp, self.move_up, "Mover arriba"),
            (QStyle.SP_ArrowDown, self.move_down, "Mover abajo"),
            (QStyle.SP_MessageBoxInformation, self.mostrar_info, "Ver información"),
            (QStyle.SP_FileDialogDetailedView, self.edit_paralelo, "Editar paralelo"),
            (QStyle.SP_DialogCloseButton, self.delete_paralelo, "Eliminar paralelo"),
        ]
        
        for std_icon, callback, tooltip in button_actions:
            button = QPushButton()
            button.setIcon(self.style().standardIcon(std_icon))
            button.setFixedSize(24, 24)
            button.clicked.connect(callback)
            button.setVisible(False)
            button.setStyleSheet(BUTTON_STYLE)
            button.setToolTip(tooltip)
            layout.addWidget(button)
            self.buttons.append(button)
        
        self.setLayout(layout)
    
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
        """Move this paralelo up in the list."""
        paralelos = self.parent_materia.paralelos
        index = paralelos.index(self)
        if index > 0:
            paralelos[index], paralelos[index - 1] = paralelos[index - 1], paralelos[index]
            self.update_layout()
    
    def move_down(self):
        """Move this paralelo down in the list."""
        paralelos = self.parent_materia.paralelos
        index = paralelos.index(self)
        if index < len(paralelos) - 1:
            paralelos[index], paralelos[index + 1] = paralelos[index + 1], paralelos[index]
            self.update_layout()
    
    def update_layout(self):
        """Update the layout after reordering."""
        layout = self.parent_materia.paralelos_layout
        # Remove all widgets
        for i in reversed(range(layout.count())):
            widget = layout.itemAt(i).widget()
            if widget:
                layout.removeWidget(widget)
        # Add them back in new order
        for paralelo in self.parent_materia.paralelos:
            layout.addWidget(paralelo)
    
    def on_label_clicked(self, event):
        """Handle click on paralelo label."""
        if self.checkbox.isEnabled():
            self.checkbox.setChecked(not self.checkbox.isChecked())
            self.on_selected()
    
    def on_selected(self):
        """Handle paralelo selection change."""
        self.parent_materia.parent_app.verificar_conflictos()
        self.parent_materia.parent_app.actualizar_creditos()
    
    def mostrar_info(self):
        """Show information dialog."""
        dialog = InfoParaleloDialog(self.info, self)
        dialog.exec()
    
    def edit_paralelo(self):
        """Open dialog to edit paralelo."""
        dialog = AddParaleloDialog(self.parent_materia)
        
        # Pre-fill with current data
        dialog.nombre_edit.setText(self.nombre)
        dialog.info_edit.setPlainText(self.info)
        dialog.original_nombre = self.nombre
        
        # Add existing time blocks
        for bloque in self.bloques:
            dia, horas = bloque.split()
            hora_inicio, hora_fin = horas.split('-')
            dialog.add_bloque_horario()
            bloque_widget, dia_combo, hora_inicio_combo, hora_fin_combo = dialog.bloques[-1]
            dia_combo.setCurrentText(dia)
            hora_inicio_combo.setCurrentText(hora_inicio)
            hora_fin_combo.setCurrentText(hora_fin)
        
        if dialog.exec():
            nuevo_nombre, nueva_info, nuevos_bloques = dialog.get_paralelo_data()
            self.nombre = nuevo_nombre
            self.info = nueva_info
            self.bloques = nuevos_bloques
            self.label.setText(f"{nuevo_nombre} | {'; '.join(nuevos_bloques)}")
            self.parent_materia.parent_app.verificar_conflictos()
    
    def delete_paralelo(self):
        """Delete this paralelo after confirmation."""
        # Get parent window to inherit theme
        parent_window = self.window()
        
        msg_box = QMessageBox(parent_window)
        msg_box.setIcon(QMessageBox.Warning)
        msg_box.setWindowTitle("Eliminar paralelo")
        msg_box.setText(
            f"¿Estás seguro de que deseas eliminar el paralelo '{self.nombre}'? "
            "Esta acción no se puede deshacer."
        )
        
        eliminar_button = msg_box.addButton("Eliminar", QMessageBox.DestructiveRole)
        cancelar_button = msg_box.addButton("Cancelar", QMessageBox.RejectRole)
        
        # Set parent window to inherit theme
        msg_box.setParent(parent_window)
        
        msg_box.exec()
        
        if msg_box.clickedButton() == eliminar_button:
            parent_layout = self.parent_materia.paralelos_layout
            parent_layout.removeWidget(self)
            
            try:
                self.parent_materia.paralelos.remove(self)
            except ValueError:
                pass
            
            self.parent_materia.parent_app.verificar_conflictos()
            self.parent_materia.parent_app.actualizar_creditos()
            self.deleteLater()
    
    def setCheckboxEnabled(self, enabled: bool):
        """
        Enable or disable the checkbox.
        
        Args:
            enabled: True to enable, False to disable
        """
        self.checkbox.setEnabled(enabled)
        if not enabled:
            self.label.setStyleSheet("text-decoration: line-through;")
        else:
            self.label.setStyleSheet("")