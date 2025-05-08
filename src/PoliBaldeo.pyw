import sys
import os
import json
import pywinstyles
import platform
from PySide6.QtWidgets import (QApplication, QMainWindow, QScrollArea, QWidget, QVBoxLayout, 
                              QHBoxLayout, QPushButton, QLabel, QCheckBox, QGridLayout, 
                              QFileDialog, QMessageBox, QDialog, QLineEdit, QComboBox, 
                              QSpinBox, QFrame, QSplitter, QSpacerItem, QSizePolicy, QStyle,
                              QStyleOption)
from PySide6.QtCore import Qt, QSize, QEvent, QTimer
from PySide6.QtGui import QAction, QIcon, QFont, QFontMetrics, QPainter, QPixmap
from PySide6.QtPrintSupport import QPrinter
from random import randint

if getattr(sys, 'frozen', False):
    script_path = os.path.dirname(sys.executable)
else:
    script_path = os.path.dirname(os.path.abspath(__file__))

icon_path = os.path.join(script_path, "resources", "PoliBaldeo.ico")
theme_folder = os.path.join(script_path, "themes")
custom_font = "Arial"

class MicaMessageBox(QMessageBox):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        aplicar_mica(self)

class AddParaleloDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Editar Paralelo")
        self.setFixedWidth(400)
        self.setMaximumHeight(100)
        
        self.bloques = []
        
        nightowl_path = os.path.join(theme_folder, "Night Owl.qss")
        if os.path.exists(nightowl_path):
            with open(nightowl_path, "r", encoding="utf-8") as file:
                theme_content = file.read()
                self.setStyleSheet(theme_content)
        else:
            print(f"Archivo de tema no encontrado: {nightowl_path}")

        aplicar_mica(self)

        layout = QVBoxLayout()
        
        nombre_layout = QHBoxLayout()
        nombre_label = QLabel("Nombre:")
        nombre_label.setFont(QFont(custom_font, weight=QFont.Bold))
        nombre_layout.addWidget(nombre_label)
        self.nombre_edit = QLineEdit()
        nombre_layout.addWidget(self.nombre_edit)
        layout.addLayout(nombre_layout)
        
        self.bloques_layout = QVBoxLayout()
        bloques_label = QLabel("Bloques Horarios:")
        bloques_label.setFont(QFont(custom_font, weight=QFont.Bold))
        layout.addWidget(bloques_label)
        layout.addLayout(self.bloques_layout)
        
        add_button = QPushButton("Añadir Día")
        add_button.setFont(QFont(custom_font, weight=QFont.Bold))
        add_button.clicked.connect(self.add_bloque_horario)
        layout.addWidget(add_button)
        
        buttons_layout = QHBoxLayout()
        accept_button = QPushButton("Aceptar")
        accept_button.setFont(QFont(custom_font, weight=QFont.Bold))
        accept_button.clicked.connect(self.accept)
        cancel_button = QPushButton("Cancelar")
        cancel_button.setFont(QFont(custom_font, weight=QFont.Bold))
        cancel_button.clicked.connect(self.reject)
        buttons_layout.addWidget(accept_button)
        buttons_layout.addWidget(cancel_button)
        layout.addLayout(buttons_layout)
        
        self.setLayout(layout)
    
    def add_bloque_horario(self):
        bloque_layout = QHBoxLayout()
        
        dia_combo = QComboBox()
        dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
        dia_combo.addItems(dias)
        bloque_layout.addWidget(dia_combo)
        
        bloque_layout.addWidget(QLabel("de"))
        hora_inicio = QComboBox()
        self.add_horas(hora_inicio)
        bloque_layout.addWidget(hora_inicio)
        hora_inicio.setMaxVisibleItems(5)
        
        bloque_layout.addWidget(QLabel("a"))
        hora_fin = QComboBox()
        self.add_horas(hora_fin)
        hora_fin.setCurrentIndex(2)
        bloque_layout.addWidget(hora_fin)
        hora_fin.setMaxVisibleItems(5)
        
        delete_button = QPushButton("Eliminar")
        delete_button.setFont(QFont(custom_font, weight=QFont.Bold))
        bloque_layout.addWidget(delete_button)
        
        bloque_widget = QWidget()
        bloque_widget.setLayout(bloque_layout)
        
        delete_button.clicked.connect(lambda: self.remove_bloque(bloque_widget))
        
        self.bloques_layout.addWidget(bloque_widget)
        self.bloques.append((bloque_widget, dia_combo, hora_inicio, hora_fin))
    
    def remove_bloque(self, widget):
        for i, (w, _, _, _) in enumerate(self.bloques):
            if w == widget:
                self.bloques.pop(i)
                break
        widget.deleteLater()
        self.adjustSize()
    
    def add_horas(self, combo):
        for hora in range(7, 22):
            combo.addItem(f"{hora:02d}:00")
            if hora < 21:  
                combo.addItem(f"{hora:02d}:30")
    
    def get_paralelo_data(self):
        nombre = self.nombre_edit.text()
        bloques = []
        
        for _, dia_combo, hora_inicio, hora_fin in self.bloques:
            dia = dia_combo.currentText()
            inicio = hora_inicio.currentText()
            fin = hora_fin.currentText()
            bloques.append(f"{dia} {inicio}-{fin}")
        
        return nombre, bloques

    def accept(self):
        if not self.nombre_edit.text().strip():
            QMessageBox.critical(self, "Error", "El nombre del paralelo no puede estar vacío.")
            return

        if not self.bloques:
            QMessageBox.critical(self, "Error", "Debe haber al menos un bloque horario.")
            return
        
        for paralelo in self.parent().paralelos:
            if paralelo.nombre == self.nombre_edit.text().strip() and paralelo.nombre != getattr(self, 'original_nombre', ''):
                QMessageBox.critical(self, "Error", f"Ya existe un paralelo con el nombre '{self.nombre_edit.text().strip()}'.")
                return
        
        for _, dia_combo, hora_inicio, hora_fin in self.bloques:
            if not dia_combo.currentText() or not hora_inicio.currentText() or not hora_fin.currentText():
                QMessageBox.critical(self, "Error", "Todos los campos deben estar completos.")
                return
        
        for _, dia_combo, hora_inicio, hora_fin in self.bloques:
            inicio = hora_inicio.currentText()
            fin = hora_fin.currentText()
            if inicio >= fin:
                QMessageBox.critical(self, "Error", f"La hora de fin ({fin}) debe ser mayor que la hora de inicio ({inicio}).")
                return
        
        super().accept()

class AddMateriaDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Editar Materia")
        self.setFixedSize(300, 125)
        
        aplicar_mica(self)

        layout = QVBoxLayout()
        
        label = QLabel("Nombre de la Materia:")
        label.setFont(QFont(custom_font, weight=QFont.Bold))
        layout.addWidget(label)
        
        self.nombre_edit = QLineEdit()
        layout.addWidget(self.nombre_edit)
        
        buttons = QHBoxLayout()
        accept_button = QPushButton("Aceptar")
        accept_button.setFont(QFont(custom_font, weight=QFont.Bold))
        accept_button.clicked.connect(self.accept)
        cancel_button = QPushButton("Cancelar")
        cancel_button.setFont(QFont(custom_font, weight=QFont.Bold))
        cancel_button.clicked.connect(self.reject)
        buttons.addWidget(accept_button)
        buttons.addWidget(cancel_button)
        layout.addLayout(buttons)
        
        self.setLayout(layout)
    
    def get_materia_name(self):
        return self.nombre_edit.text()
    
    def accept(self):
        if not self.nombre_edit.text().strip():
            QMessageBox.critical(self, "Error", "El nombre de la materia no puede estar vacío.")
            return
            
        super().accept()

class MateriaWidget(QWidget):
    def __init__(self, nombre, parent=None):
        super().__init__(parent)
        self.nombre = nombre
        self.paralelos = []
        self.is_expanded = True
        self.parent_app = parent
        
        self.main_layout = QVBoxLayout()
        self.main_layout.setContentsMargins(5, 5, 5, 5)
        self.main_layout.setSpacing(2)
        
        header_frame = QFrame()
        header_frame.setFrameShape(QFrame.NoFrame)
        header_frame.setFrameShape(QFrame.StyledPanel)
        header_frame.setLineWidth(1)
        header_layout = QHBoxLayout(header_frame)
        header_layout.setContentsMargins(5, 5, 5, 5)
        
        self.expand_button = QPushButton()
        self.expand_button.setFixedSize(24, 24)
        self.expand_button.setIcon(QIcon(os.path.join(script_path, "resources/arrow_down.png")))
        self.expand_button.clicked.connect(self.toggle_expand)
        self.expand_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: 2px solid #5c6e91;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: rgba(119, 119, 119, 0.1);
            }
        """)
        header_layout.addWidget(self.expand_button)
        
        self.materia_label = QLabel(nombre)
        self.materia_label.setFont(QFont(custom_font, 10, QFont.Bold))
        self.materia_label.mousePressEvent = self.on_label_clicked
        header_layout.addWidget(self.materia_label, 1)

        self.buttons = []
        for icon_name, callback in [
            ("arrow_drop_up.png", self.move_up),
            ("arrow_drop_down.png", self.move_down),
            ("edit.png", self.edit_materia),
            ("add.png", self.add_paralelo),
            ("delete.png", self.delete_materia),
        ]:
            button = QPushButton()
            button.setIcon(QIcon(os.path.join(script_path, "resources", icon_name)))
            button.setFixedSize(24, 24)
            button.clicked.connect(callback)
            button.setVisible(False)
            button.setStyleSheet("""
                QPushButton {
                    background-color: transparent;
                    border: 2px solid #5c6e91;
                    border-radius: 3px;
                }
                QPushButton:hover {
                    background-color: rgba(119, 119, 119, 0.1);
                }
            """)
            header_layout.addWidget(button)
            self.buttons.append(button)
        
        self.main_layout.addWidget(header_frame)
        
        self.paralelos_widget = QWidget()
        self.paralelos_layout = QVBoxLayout(self.paralelos_widget)
        self.paralelos_layout.setContentsMargins(20, 0, 5, 5)
        self.paralelos_layout.setSpacing(1)
        self.main_layout.addWidget(self.paralelos_widget)
        
        self.paralelos_layout.addItem(QSpacerItem(0, 0, QSizePolicy.Minimum, QSizePolicy.Minimum))
        self.setLayout(self.main_layout)

    def enterEvent(self, event):
        for button in self.buttons:
            button.setVisible(True)
        super().enterEvent(event)

    def leaveEvent(self, event):
        for button in self.buttons:
            button.setVisible(False)
        super().leaveEvent(event)

    def move_up(self):
        materias = self.parent_app.materias
        index = materias.index(self)
        if index > 0:
            materias[index], materias[index - 1] = materias[index - 1], materias[index]
            self.parent_app.reorganizar_materias()

    def move_down(self):
        materias = self.parent_app.materias
        index = materias.index(self)
        if index < len(materias) - 1:
            materias[index], materias[index + 1] = materias[index + 1], materias[index]
            self.parent_app.reorganizar_materias()

    def on_label_clicked(self, event):
        self.toggle_expand()

    def toggle_expand(self):
        self.is_expanded = not self.is_expanded
        self.paralelos_widget.setVisible(self.is_expanded)
        icon_path = "resources/arrow_down.png" if self.is_expanded else "resources/arrow_right.png"
        self.expand_button.setIcon(QIcon(os.path.join(script_path, icon_path)))

    def edit_materia(self):
        dialog = AddMateriaDialog(self.parent_app)
        dialog.nombre_edit.setText(self.nombre)
        
        if dialog.exec():
            nuevo_nombre = dialog.get_materia_name().strip()

            if not nuevo_nombre:
                QMessageBox.critical(self, "Error", "El nombre de la materia no puede estar vacío.")
                return
            
            for materia in self.parent_app.materias:
                if materia.nombre == nuevo_nombre and materia != self:
                    QMessageBox.critical(self, "Error", f"Ya existe una materia con el nombre '{nuevo_nombre}'.")
                    return

            self.nombre = nuevo_nombre
            self.materia_label.setText(nuevo_nombre)

    def add_paralelo(self):
        dialog = AddParaleloDialog(self)

        if dialog.exec():
            nombre, bloques = dialog.get_paralelo_data()
            if nombre and bloques:
                for paralelo in self.paralelos:
                    if paralelo.nombre == nombre:
                        QMessageBox.critical(self, "Error", f"Ya existe un paralelo con el nombre '{nombre}' en esta materia.")
                        return
                
                paralelo_widget = ParaleloWidget(nombre, bloques, self)
                self.paralelos_layout.addWidget(paralelo_widget)
                self.paralelos.append(paralelo_widget)
                self.parent_app.verificar_conflictos()
    
    def delete_materia(self):
        reply = QMessageBox.question(self, "Confirmar eliminación",
                                     f"¿Estás seguro de eliminar la materia '{self.nombre}' y todos sus paralelos?",
                                     QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            self.parent_app.eliminar_materia(self)
    
    def collapse(self):
        if self.is_expanded:
            self.toggle_expand()
    
    def expand(self):
        if not self.is_expanded:
            self.toggle_expand()
    
    def get_data(self):
        data = {
            "nombre": self.nombre,
            "paralelos": []
        }
        
        for paralelo in self.paralelos:
            paralelo_data = {
                "nombre": paralelo.nombre,
                "bloques": paralelo.bloques,
                "selected": paralelo.checkbox.isChecked()
            }
            data["paralelos"].append(paralelo_data)
        
        return data

class ParaleloWidget(QWidget):
    def __init__(self, nombre, bloques, parent=None):
        super().__init__()
        self.nombre = nombre
        self.bloques = bloques
        self.parent_materia = parent
        
        layout = QHBoxLayout()
        layout.setContentsMargins(0, 2, 1, 2)
        layout.setSpacing(5)
        
        self.checkbox = QCheckBox()
        self.checkbox.setStyleSheet(f"""
        QCheckBox::indicator {{
            width: 24px;
            height: 24px;
        }}
        QCheckBox::indicator:unchecked {{
            image: url({os.path.join(script_path, "resources", "checkbox_unchecked.png").replace("\\", "/")});
        }}
        QCheckBox::indicator:checked {{
            image: url({os.path.join(script_path, "resources", "checkbox_checked.png").replace("\\", "/")});
        }}
        QCheckBox::indicator:disabled {{
            image: url({os.path.join(script_path, "resources", "checkbox_disabled.png").replace("\\", "/")});
        }}
        """)
        self.checkbox.clicked.connect(self.on_selected)
        layout.addWidget(self.checkbox)
        
        info_text = f"{nombre} | {'; '.join(bloques)}"
        self.label = QLabel(info_text)
        self.label.mousePressEvent = self.on_label_clicked
        layout.addWidget(self.label, 1)

        self.buttons = []
        for icon_name, callback in [
            ("arrow_drop_up.png", self.move_up),
            ("arrow_drop_down.png", self.move_down),
            ("edit.png", self.edit_paralelo),
            ("backspace.png", self.delete_paralelo),
        ]:
            button = QPushButton()
            button.setIcon(QIcon(os.path.join(script_path, "resources", icon_name)))
            button.setFixedSize(24, 24)
            button.clicked.connect(callback)
            button.setVisible(False)
            button.setStyleSheet("""
                QPushButton {
                    background-color: transparent;
                    border: 2px solid #5c6e91;
                    border-radius: 3px;
                }
                QPushButton:hover {
                    background-color: rgba(119, 119, 119, 0.1);
                }
            """)
            layout.addWidget(button)
            self.buttons.append(button)
        
        self.setLayout(layout)

    def enterEvent(self, event):
        for button in self.buttons:
            button.setVisible(True)
        super().enterEvent(event)

    def leaveEvent(self, event):
        for button in self.buttons:
            button.setVisible(False)
        super().leaveEvent(event)

    def move_up(self):
        paralelos = self.parent_materia.paralelos
        index = paralelos.index(self)
        if index > 0:
            paralelos[index], paralelos[index - 1] = paralelos[index - 1], paralelos[index]
            self.update_layout()

    def move_down(self):
        paralelos = self.parent_materia.paralelos
        index = paralelos.index(self)
        if index < len(paralelos) - 1:
            paralelos[index], paralelos[index + 1] = paralelos[index + 1], paralelos[index]
            self.update_layout()

    def update_layout(self):
        layout = self.parent_materia.paralelos_layout
        for i in reversed(range(layout.count())):
            widget = layout.itemAt(i).widget()
            if widget:
                layout.removeWidget(widget)
        for paralelo in self.parent_materia.paralelos:
            layout.addWidget(paralelo)

    def on_label_clicked(self, event):
        if self.checkbox.isEnabled():
            self.checkbox.setChecked(not self.checkbox.isChecked())
            self.on_selected()

    def on_selected(self):
        self.parent_materia.parent_app.verificar_conflictos()
    
    def edit_paralelo(self):
        dialog = AddParaleloDialog(self.parent_materia)

        dialog.nombre_edit.setText(self.nombre)
        dialog.original_nombre = self.nombre

        for bloque in self.bloques:
            dia, horas = bloque.split()
            hora_inicio, hora_fin = horas.split('-')
            dialog.add_bloque_horario()
            bloque_widget, dia_combo, hora_inicio_combo, hora_fin_combo = dialog.bloques[-1]
            dia_combo.setCurrentText(dia)
            hora_inicio_combo.setCurrentText(hora_inicio)
            hora_fin_combo.setCurrentText(hora_fin)

        if dialog.exec():
            nuevo_nombre, nuevos_bloques = dialog.get_paralelo_data()
            self.nombre = nuevo_nombre
            self.bloques = nuevos_bloques
            self.label.setText(f"{nuevo_nombre} | {'; '.join(nuevos_bloques)}")
            self.parent_materia.parent_app.verificar_conflictos()
    
    def delete_paralelo(self):
        reply = QMessageBox.question(self, "Confirmar eliminación",
                                     f"¿Estás seguro de eliminar el paralelo '{self.nombre}'?",
                                     QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            parent_layout = self.parent_materia.paralelos_layout
            parent_layout.removeWidget(self)
            
            try:
                self.parent_materia.paralelos.remove(self)
            except ValueError:
                pass
            
            self.parent_materia.parent_app.verificar_conflictos()
            self.deleteLater()
    
    def setCheckboxEnabled(self, enabled):
        self.checkbox.setEnabled(enabled)
        if not enabled:
            self.label.setStyleSheet("text-decoration: line-through;")
        else:
            self.label.setStyleSheet("")

class CalendarioWindow(QMainWindow):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Horario Semanal - PoliBaldeo")
        self.resize(1280, 720)
        self.setMinimumSize(1080, 300)

        aplicar_mica(self)

        self.parent_app = parent
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)

        button_frame = QFrame()
        button_frame.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        button_layout = QHBoxLayout(button_frame)
        button_layout.setContentsMargins(5,0,5,0)
        button_layout.setSpacing(5)

        save_button = QPushButton()
        save_button.setFixedSize(24, 24)
        save_button.setIcon(QIcon(os.path.join(script_path, "resources", "save.png")))
        save_button.setIconSize(QSize(24, 24))
        save_button.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                border: none;
            }
            QPushButton:hover {
                background-color: rgba(119, 119, 119, 0.1);
                border-radius: 5px;
            }
        """)
        save_button.clicked.connect(self.guardar_vista)
        button_layout.addWidget(save_button, alignment=Qt.AlignLeft)

        main_layout.addWidget(button_frame)

        title_frame = QFrame()
        title_layout = QHBoxLayout(title_frame)
        title_layout.setContentsMargins(10, 0, 10, 30)
        title_layout.setSpacing(10)

        title = QLabel("Horario Semanal")
        title.setFont(QFont(custom_font, 24, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        title_layout.addWidget(title, alignment=Qt.AlignCenter)

        main_layout.addWidget(title_frame)

        header_scroll_container = QVBoxLayout()
        header_scroll_container.setSpacing(0)
        header_scroll_container.setContentsMargins(0, 0, 0, 0)
        main_layout.addLayout(header_scroll_container)

        self.header_widget = QWidget()
        self.header_layout = QGridLayout(self.header_widget)
        self.header_layout.setSpacing(1)
        self.header_layout.setContentsMargins(0, 0, 0, 0)

        dias = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
        for col, dia in enumerate(dias):
            label = QLabel(f"{dia}")
            label.setAlignment(Qt.AlignCenter)
            if col == 0:
                label.setFixedWidth(40)
            elif col > 0:
                label.setFont(QFont(custom_font, 10, QFont.Bold))
            label.setStyleSheet("margin-bottom: 10px;")
            self.header_layout.addWidget(label, 0, col)
        for col in range(len(dias)):
            self.header_layout.setColumnStretch(col, 1)

        header_scroll_container.addWidget(self.header_widget)

        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("QScrollArea { border: none; }")
        main_layout.addWidget(scroll_area)

        scroll_content = QWidget()
        scroll_area.setWidget(scroll_content)
        
        layout = QVBoxLayout(scroll_content)
        
        self.grid = QGridLayout()
        self.grid.setSpacing(1)
                
        horas = []
        for hora in range(7, 22):
            horas.append(f"{hora:02d}:00")
            if hora < 21:
                horas.append(f"{hora:02d}:30")
        
        for row, hora in enumerate(horas, 1):
            label = QLabel(hora)
            label.setAlignment(Qt.AlignCenter | Qt.AlignVCenter)
            label.setFont(QFont(custom_font, 10, QFont.Bold))
            label.setFixedWidth(60)
            self.grid.addWidget(label, row, 0)
        
        self.celdas = {}
        for row in range(1, len(horas) + 1):
            for col in range(1, len(dias)):
                celda = QFrame()
                celda.setFrameShape(QFrame.StyledPanel)
                celda.setMinimumHeight(40)
                celda.setLayout(QVBoxLayout())
                celda.layout().setContentsMargins(3,3,3,3)
                celda.layout().setSpacing(0)
                self.grid.addWidget(celda, row, col)
                
                hora = horas[row - 1]
                dia = dias[col]
                self.celdas[(dia, hora)] = celda
        
        for col in range(len(dias)):
            self.grid.setColumnStretch(col, 1)

        layout.addLayout(self.grid)

        scroll_area.horizontalScrollBar().valueChanged.connect(
            self.sync_header_scroll
        )

    def sync_header_scroll(self, value):
        self.header_widget.move(-value, self.header_widget.y())

    def guardar_vista(self):
        file_path, _ = QFileDialog.getSaveFileName(self, "Guardar Horario", "", "Imagen PNG (*.png);;PDF (*.pdf)")
        
        if file_path:
            if file_path.endswith(".png"):
                pixmap = self.grab()
                pixmap.save(file_path, "PNG")
            elif file_path.endswith(".pdf"):
                printer = QPrinter(QPrinter.HighResolution)
                printer.setOutputFormat(QPrinter.PdfFormat)
                printer.setOutputFileName(file_path)
                painter = QPainter(printer)
                self.render(painter)
                painter.end()
            QMessageBox.information(self, "Guardado", f"Horario guardado en: {file_path}")

    def actualizar_calendario(self):
        for celda in self.celdas.values():
            while celda.layout().count():
                item = celda.layout().takeAt(0)
                widget = item.widget()
                if widget:
                    widget.deleteLater()
        
        for materia_widget in self.parent_app.materias:
            for paralelo in materia_widget.paralelos:
                if paralelo.checkbox.isChecked():
                    self.añadir_paralelo_a_calendario(materia_widget.nombre, paralelo)
    
    def añadir_paralelo_a_calendario(self, nombre_materia, paralelo):
        def generar_color_oscuro():
            r = randint(0, 80)
            g = randint(50, 100)
            b = randint(50, 100)
            return f"rgb({r}, {g}, {b})"

        color_fondo = generar_color_oscuro()

        for bloque in paralelo.bloques:
            partes = bloque.split()
            dia = partes[0]
            rango_hora = partes[1]
            
            hora_inicio, hora_fin = rango_hora.split('-')
            
            horas_bloque = []
            hora_actual = hora_inicio
            
            while hora_actual != hora_fin:
                horas_bloque.append(hora_actual)
                
                h, m = map(int, hora_actual.split(':'))
                if m == 0:
                    hora_actual = f"{h:02d}:30"
                else:
                    h += 1
                    hora_actual = f"{h:02d}:00"
            
            first_cell = True
            for hora in horas_bloque:
                key = (dia, hora)
                if key in self.celdas:
                    celda = self.celdas[key]
                    
                    label_text = nombre_materia
                    if first_cell:
                        label_text += f" ({paralelo.nombre})"
                        first_cell = False
                    
                    label = QLabel(label_text)
                    label.setAlignment(Qt.AlignCenter)
                    label.setStyleSheet(f"background-color: {color_fondo}; border-radius: 3px; padding: 2px; color: white;")
                    
                    celda.layout().addWidget(label)

class PoliBaldeo(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('"Sin título" - PoliBaldeo')
        self.archivo_actual = None
        self.setIcon()
        self.resize(640, 480)
        self.setMinimumSize(640, 480)
        
        self.materias = []
        self.columnas = 1
        self.calendario_window = None
        
        self.setup_ui()
        self.setup_menu()
        self.actualizar_materias_label()

    def actualizar_materias_label(self):
        if not self.materias:
            self.materias_label.setText("Arrastra o crea un archivo para empezar.")
            self.materias_label.setAlignment(Qt.AlignCenter)
            self.materias_label.setStyleSheet("color: #5c6e91;")
            self.drag_icon.setVisible(True)
            self.centralWidget().layout().setContentsMargins(50, 50, 50, 50) 
        else:
            self.materias_label.setText("     Materias")
            self.materias_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
            self.materias_label.setStyleSheet("")
            self.drag_icon.setVisible(False)
            self.centralWidget().layout().setContentsMargins(10, 10, 10, 10)
    
    def closeEvent(self, event):
        if not self.materias:
            event.accept()
            return

        msg_box = MicaMessageBox(self)
        msg_box.setIcon(QMessageBox.Warning)
        msg_box.setWindowTitle("Cerrar aplicación")
        msg_box.setText("¿Estás seguro de que deseas salir? Se perderán todos los datos actuales si no los guardas.")
        
        guardar_button = msg_box.addButton("Guardar", QMessageBox.AcceptRole)
        salir_button = msg_box.addButton("Salir sin guardar", QMessageBox.DestructiveRole)
        cancelar_button = msg_box.addButton("Cancelar", QMessageBox.RejectRole)
        
        msg_box.exec()
        
        if msg_box.clickedButton() == guardar_button:
            self.guardar_archivo()
            if not self.archivo_actual:
                event.ignore()
            else:
                event.accept()
        elif msg_box.clickedButton() == salir_button:
            event.accept()
        else:
            event.ignore()

    def setIcon(self):
        self.setWindowIcon(QIcon(icon_path))

    def setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout()
        main_layout.setAlignment(Qt.AlignCenter)
        main_layout.setContentsMargins(50, 50, 50, 50)
        central_widget.setLayout(main_layout)

        self.drag_icon = QLabel()
        self.drag_icon.setPixmap(QPixmap(os.path.join(script_path, "resources", "download.png")).scaled(256, 256, Qt.KeepAspectRatio))
        self.drag_icon.setAlignment(Qt.AlignCenter)
        self.drag_icon.setStyleSheet("""
            QLabel {
                border: 2px solid #5c6e91;
                border-radius: 10px;
                padding: 5px;
            }
        """)
        self.drag_icon.setVisible(True)
        main_layout.addWidget(self.drag_icon)
        
        self.setAcceptDrops(True)
        
        materias_container = QWidget()
        self.materias_layout = QVBoxLayout()
        materias_container.setLayout(self.materias_layout)
        
        self.materias_label = QLabel("Materias")
        self.materias_label.setFont(QFont(custom_font, 12, QFont.Bold))
        self.materias_layout.addWidget(self.materias_label)
        
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("QScrollArea { border: none; }")
        self.materias_layout.addWidget(scroll_area)
        
        self.materias_widget = QWidget()
        self.materias_widget.setStyleSheet("background: transparent; border: none;")
        self.materias_grid = QGridLayout()
        self.materias_grid.setSpacing(10)
        self.materias_grid.setAlignment(Qt.AlignTop)
        self.materias_widget.setLayout(self.materias_grid)
        scroll_area.setWidget(self.materias_widget)
        
        main_layout.addWidget(materias_container)
    
    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.accept()
        else:
            event.ignore()

    def dropEvent(self, event):
        """Abre el archivo arrastrado al ícono."""
        if event.mimeData().hasUrls():
            file_path = event.mimeData().urls()[0].toLocalFile()
            if file_path.endswith(".poli"):
                self.archivo_actual = file_path
                self.cargar_desde_archivo(file_path)
                self.actualizar_titulo()
                self.drag_icon.setVisible(False)
            else:
                QMessageBox.warning(self, "Archivo no válido", "Por favor, arrastra un archivo de PoliBaldeo válido (.poli).")

    def setup_menu(self):
        menubar = self.menuBar()
        
        archivo_menu = menubar.addMenu("Archivo")
        
        nuevo_action = QAction("Nuevo", self)
        nuevo_action.triggered.connect(self.nuevo_horario)
        archivo_menu.addAction(nuevo_action)
        
        abrir_action = QAction("Abrir", self)
        abrir_action.triggered.connect(self.abrir_archivo)
        archivo_menu.addAction(abrir_action)
        
        guardar_action = QAction("Guardar", self)
        guardar_action.triggered.connect(self.guardar)
        archivo_menu.addAction(guardar_action)
        
        guardar_como_action = QAction("Guardar como", self)
        guardar_como_action.triggered.connect(self.guardar_archivo)
        archivo_menu.addAction(guardar_como_action)
        
        editar_menu = menubar.addMenu("Editar")
        
        add_materia_action = QAction("Añadir Materia", self)
        add_materia_action.triggered.connect(self.show_add_materia_dialog)
        editar_menu.addAction(add_materia_action)
        
        deselect_action = QAction("Deseleccionar Todo", self)
        deselect_action.triggered.connect(self.deseleccionar_todo)
        editar_menu.addAction(deselect_action)
        
        ver_menu = menubar.addMenu("Ver")
        
        calendario_action = QAction("Vista de Horario", self)
        calendario_action.triggered.connect(self.mostrar_calendario)
        ver_menu.addAction(calendario_action)
        
        colapsar_action = QAction("Colapsar Todo", self)
        colapsar_action.triggered.connect(self.colapsar_todo)
        ver_menu.addAction(colapsar_action)
        
        expandir_action = QAction("Expandir Todo", self)
        expandir_action.triggered.connect(self.expandir_todo)
        ver_menu.addAction(expandir_action)
        
        columnas_menu = ver_menu.addMenu("Columnas")
        self.columnas_actions = []
        
        for i in range(1, 5):
            columna_action = QAction(f"{i} Columna{'s' if i > 1 else ''}", self)
            columna_action.setData(i)
            columna_action.setCheckable(True)
            columna_action.triggered.connect(self.cambiar_columnas)
            columnas_menu.addAction(columna_action)
            self.columnas_actions.append(columna_action)
        self.columnas_actions[0].setChecked(True)

        tema_menu = ver_menu.addMenu("Tema")
        self.tema_actions = []
        self.cargar_temas(tema_menu)
    
    def cargar_temas(self, tema_menu):
        if not os.path.exists(theme_folder):
            return
        
        for theme_file in os.listdir(theme_folder):
            if theme_file.endswith(".qss"):
                theme_path = os.path.join(theme_folder, theme_file)
                theme_name = os.path.splitext(theme_file)[0]
                
                action = QAction(theme_name, self)
                action.setCheckable(True)
                action.triggered.connect(lambda checked, path=theme_path, name=theme_name: self.aplicar_tema(path, name))
                tema_menu.addAction(action)
                self.tema_actions.append(action)

        for action in self.tema_actions:
            if action.text() == "Night Owl":
                action.setChecked(True)

    def aplicar_tema(self, theme_path, theme_name):
        try:
            with open(theme_path, "r", encoding="utf-8") as file:
                theme_content = file.read()
                self.setStyleSheet(theme_content)

            for action in self.tema_actions:
                action.setChecked(action.text() == theme_name)
        except Exception as e:
            QMessageBox.critical(self, "Error", f"No se pudo cargar el tema: {str(e)}")
    
    def show_add_materia_dialog(self):
        dialog = AddMateriaDialog(self)
        if dialog.exec():
            nombre = dialog.get_materia_name()
            if nombre:
                self.añadir_materia(nombre)
    
    def añadir_materia(self, nombre):
        materia_widget = MateriaWidget(nombre, self)
        
        num_materias = len(self.materias)
        fila = num_materias // self.columnas
        columna = num_materias % self.columnas
        
        self.materias_grid.addWidget(materia_widget, fila, columna)
        self.materias.append(materia_widget)
        self.actualizar_materias_label()
    
    def eliminar_materia(self, materia_widget):
        index = self.materias.index(materia_widget)
        self.materias_grid.removeWidget(materia_widget)
        
        self.materias.remove(materia_widget)
        materia_widget.deleteLater()
        
        self.reorganizar_materias()
        
        self.verificar_conflictos()
        
        if self.calendario_window:
            self.calendario_window.actualizar_calendario()

        self.actualizar_materias_label()

    def reorganizar_materias(self):
        for i in reversed(range(self.materias_grid.count())):
            self.materias_grid.itemAt(i).widget().setParent(None)

        for i, materia in enumerate(self.materias):
            fila = i // self.columnas
            columna = i % self.columnas
            self.materias_grid.addWidget(materia, fila, columna, alignment=Qt.AlignTop)
    
    def cambiar_columnas(self):
        action = self.sender()
        self.columnas = action.data()
        for columna_action in self.columnas_actions:
            columna_action.setChecked(columna_action == action)
        self.reorganizar_materias()
    
    def colapsar_todo(self):
        for materia in self.materias:
            materia.collapse()
    
    def expandir_todo(self):
        for materia in self.materias:
            materia.expand()
    
    def deseleccionar_todo(self):
        for materia in self.materias:
            for paralelo in materia.paralelos:
                paralelo.checkbox.setChecked(False)
        
        self.restaurar_checkboxes()
        
        if self.calendario_window:
            self.calendario_window.actualizar_calendario()
    
    def restaurar_checkboxes(self):
        for materia in self.materias:
            for paralelo in materia.paralelos:
                paralelo.setCheckboxEnabled(True)
    
    def verificar_conflictos(self):
        bloques_ocupados = {}
        paralelos_por_materia = {}
        
        self.restaurar_checkboxes()
        
        for materia in self.materias:
            paralelos_seleccionados = []
            
            for paralelo in materia.paralelos:
                if paralelo.checkbox.isChecked():
                    paralelos_seleccionados.append(paralelo)
                    
                    for bloque in paralelo.bloques:
                        partes = bloque.split()
                        dia = partes[0]
                        rango_hora = partes[1]
                        
                        hora_inicio, hora_fin = rango_hora.split('-')
                        
                        hora_actual = hora_inicio
                        while hora_actual != hora_fin:
                            key = (dia, hora_actual)
                            bloques_ocupados[key] = materia.nombre
                            
                            h, m = map(int, hora_actual.split(':'))
                            if m == 0:
                                hora_actual = f"{h:02d}:30"
                            else:
                                h += 1
                                hora_actual = f"{h:02d}:00"
            
            if paralelos_seleccionados:
                paralelos_por_materia[materia.nombre] = paralelos_seleccionados
        
        for materia in self.materias:
            if materia.nombre in paralelos_por_materia:
                for paralelo in materia.paralelos:
                    if not paralelo.checkbox.isChecked():
                        paralelo.checkbox.setEnabled(False)
            
            for paralelo in materia.paralelos:
                if not paralelo.checkbox.isChecked() and paralelo.checkbox.isEnabled():
                    tiene_conflicto = False
                    
                    for bloque in paralelo.bloques:
                        partes = bloque.split()
                        dia = partes[0]
                        rango_hora = partes[1]
                        
                        hora_inicio, hora_fin = rango_hora.split('-')
                        
                        hora_actual = hora_inicio
                        while hora_actual != hora_fin:
                            key = (dia, hora_actual)
                            if key in bloques_ocupados:
                                tiene_conflicto = True
                                break
                            
                            h, m = map(int, hora_actual.split(':'))
                            if m == 0:
                                hora_actual = f"{h:02d}:30"
                            else:
                                h += 1
                                hora_actual = f"{h:02d}:00"
                        
                        if tiene_conflicto:
                            break
                    
                    if tiene_conflicto:
                        paralelo.checkbox.setEnabled(False)
        
        if self.calendario_window:
            self.calendario_window.actualizar_calendario()
    
    def mostrar_calendario(self):
        if self.calendario_window and self.calendario_window.isVisible():
            self.calendario_window.close()
        
        self.calendario_window = CalendarioWindow(self)
        self.calendario_window.actualizar_calendario()
        self.calendario_window.show()
    
    def nuevo_horario(self):
        if not self.materias:
            if self.archivo_actual is None:
                self.actualizar_titulo()
            return

        reply = QMessageBox.question(self, "Nuevo Horario",
                                    "¿Estás seguro de crear un nuevo horario? Se perderán todos los datos actuales.",
                                    QMessageBox.Yes | QMessageBox.No)
        
        if reply == QMessageBox.Yes:
            for i in reversed(range(self.materias_grid.count())):
                widget = self.materias_grid.itemAt(i).widget()
                if widget:
                    widget.setParent(None)
            
            self.materias.clear()
            self.archivo_actual = None
            self.actualizar_titulo()
            
            if self.calendario_window:
                self.calendario_window.actualizar_calendario()

            self.actualizar_materias_label()

    def actualizar_titulo(self):
        if self.archivo_actual:
            nombre_archivo = os.path.basename(self.archivo_actual)
            self.setWindowTitle(f'"{nombre_archivo}" - PoliBaldeo')
        else:
            self.setWindowTitle('"Sin título" - PoliBaldeo')
    
    def guardar(self):
        if not self.materias:
            QMessageBox.warning(self, "Guardar", "No hay datos para guardar.")
            return
    
        if self.archivo_actual:
            try:
                with open(self.archivo_actual, 'w', encoding='utf-8') as file:
                    for materia in self.materias:
                        file.write(materia.nombre + '\n')
                        
                        for paralelo in materia.paralelos:
                            bloques_texto = '; '.join(paralelo.bloques)
                            estado_checkbox = '1' if paralelo.checkbox.isChecked() else '0'
                            file.write(f"{paralelo.nombre} | {bloques_texto} | {estado_checkbox}\n")
                        
                        file.write('\n')
                
                QMessageBox.information(self, "Guardado", "Archivo guardado exitosamente.")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"No se pudo guardar el archivo: {str(e)}")
        else:
            self.guardar_archivo()


    def abrir_archivo(self):
        if self.materias:
            reply = MicaMessageBox.question(
                self,
                "Guardar cambios",
                "¿Deseas guardar los cambios antes de abrir un nuevo archivo?",
                QMessageBox.Yes | QMessageBox.No | QMessageBox.Cancel
            )
            
            if reply == QMessageBox.Yes:
                self.guardar_archivo()
            elif reply == QMessageBox.Cancel:
                return
        
        file_path, _ = QFileDialog.getOpenFileName(self, "Abrir Horario", "", "Archivos PoliBaldeo (*.poli)")
        
        if file_path:
            try:
                self.archivo_actual = file_path
                self.cargar_desde_archivo(file_path)
                self.actualizar_titulo()
            except Exception as e:
                MicaMessageBox.critical(self, "Error", f"No se pudo abrir el archivo: {str(e)}")
    
    def cargar_desde_archivo(self, file_path):
        for i in reversed(range(self.materias_grid.count())):
            widget = self.materias_grid.itemAt(i).widget()
            if widget:
                widget.setParent(None)
    
        self.materias.clear()
        
        with open(file_path, 'r', encoding='utf-8') as file:
            contenido = file.read()
        
        materias_texto = contenido.split('\n\n')
        
        for materia_texto in materias_texto:
            if not materia_texto.strip():
                continue
                
            lineas = materia_texto.strip().split('\n')
            if not lineas:
                continue
                
            nombre_materia = lineas[0].strip()
            self.añadir_materia(nombre_materia)
            materia_widget = self.materias[-1]
            
            for i in range(1, len(lineas)):
                linea_paralelo = lineas[i].strip()
                if not linea_paralelo:
                    continue
                    
                try:
                    partes = linea_paralelo.split('|')

                    if len(partes) == 2:
                        partes.append('0')

                    if len(partes) != 3:
                        continue
                        
                    nombre_paralelo = partes[0].strip()
                    bloques_texto = partes[1].strip()
                    estado_checkbox = partes[2].strip() == '1'
                    
                    bloques = [bloque.strip() for bloque in bloques_texto.split(';')]
                    
                    paralelo_widget = ParaleloWidget(nombre_paralelo, bloques, materia_widget)
                    paralelo_widget.checkbox.setChecked(estado_checkbox)
                    materia_widget.paralelos_layout.addWidget(paralelo_widget)
                    materia_widget.paralelos.append(paralelo_widget)
                except Exception as e:
                    print(f"Error al procesar paralelo: {str(e)}")
        
        self.verificar_conflictos()
    
    def guardar_archivo(self):
        if not self.materias:
            QMessageBox.warning(self, "Guardar como", "No hay datos para guardar.")
            return
        file_path, _ = QFileDialog.getSaveFileName(self, "Guardar Horario", "", "Archivos PoliBaldeo (*.poli)")
        
        if file_path:
            if not file_path.endswith(".poli"):
                file_path += ".poli"
            self.archivo_actual = file_path
            self.guardar()
            self.actualizar_titulo()

def aplicar_mica(window):
    if platform.system() == "Windows":
        try:
            hwnd = int(window.winId())
            pywinstyles.apply_style(hwnd, style="mica")
        except Exception as e:
            print(f"No se pudo aplicar el efecto Mica: {str(e)}")

def main():
    app = QApplication(sys.argv)
    app.setStyle("windows11")

    nightowl_path = os.path.join(theme_folder, "Night Owl.qss")
    if os.path.exists(nightowl_path):
        with open(nightowl_path, "r", encoding="utf-8") as file:
            theme_content = file.read()
            app.setStyleSheet(theme_content)
    else:
        print(f"Archivo de tema no encontrado: {nightowl_path}")

    window = PoliBaldeo()
    window.show()

    aplicar_mica(window)

    sys.exit(app.exec())
if __name__ == "__main__":
    main()