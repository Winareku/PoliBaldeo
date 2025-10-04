"""
Main window for PoliBaldeo application.
"""

import os
from typing import List, Optional
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QGridLayout,
                              QLabel, QScrollArea, QFileDialog, QMessageBox, QStyle, QProgressDialog, QApplication)
from PySide6.QtCore import Qt
from PySide6.QtGui import QIcon, QFont, QPixmap, QAction
from config import (ICON_PATH, DOWNLOAD_ICON_PATH, CUSTOM_FONT, 
                   DEFAULT_WINDOW_SIZE, POLIBALDEO_EXTENSION, ICALENDAR_EXTENSION)
from utils import FileHandler, CalendarExporter, ThemeManager, TimeUtils
from dialogs import AddMateriaDialog, CombinacionDialog
from widgets import MateriaWidget, ParaleloWidget
from .calendario_window import CalendarioWindow


class PoliBaldeo(QMainWindow):
    """Main application window for PoliBaldeo."""
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle('"Sin título" - PoliBaldeo')
        self.archivo_actual = None
        self.setIcon()
        self.resize(*DEFAULT_WINDOW_SIZE)
        self.setMinimumSize(*DEFAULT_WINDOW_SIZE)
        
        self.materias = []
        self.columnas = 1
        self.calendario_window = None
        self.total_creditos = 0
        self.theme_manager = ThemeManager()
        
        self.setup_ui()
        self.setup_menu()
        self.actualizar_materias_label()
    
    def setIcon(self):
        """Set the application icon."""
        if os.path.exists(ICON_PATH):
            self.setWindowIcon(QIcon(ICON_PATH))
        else:
            self.setWindowIcon(self.style().standardIcon(QStyle.SP_FileDialogDetailedView))
    
    def setup_ui(self):
        """Set up the main user interface."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout()
        main_layout.setAlignment(Qt.AlignCenter)
        main_layout.setContentsMargins(50, 50, 50, 50)
        central_widget.setLayout(main_layout)
        
        # Drag and drop icon
        self.drag_icon = QLabel()
        if os.path.exists(DOWNLOAD_ICON_PATH):
            self.drag_icon.setPixmap(
                QPixmap(DOWNLOAD_ICON_PATH).scaled(256, 256, Qt.KeepAspectRatio)
            )
        else:
            self.drag_icon.setText("📂")
            self.drag_icon.setAlignment(Qt.AlignCenter)
            self.drag_icon.setStyleSheet("font-size: 100px;")
        
        self.drag_icon.setAlignment(Qt.AlignCenter)
        self.drag_icon.setStyleSheet("""
            QLabel {
                border: 2px solid #5c6e91;
                border-radius: 10px;
                padding: 5px;
            }
        """)
        self.drag_icon.setVisible(True)
        self.drag_icon.setToolTip("Arrastra un archivo .poli aquí para abrirlo")
        main_layout.addWidget(self.drag_icon)
        
        self.setAcceptDrops(True)
        
        # Materias container
        materias_container = QWidget()
        self.materias_layout = QVBoxLayout()
        materias_container.setLayout(self.materias_layout)
        
        self.materias_label = QLabel("Materias")
        self.materias_label.setFont(QFont(CUSTOM_FONT, 12, QFont.Bold))
        self.materias_layout.addWidget(self.materias_label)
        
        # Scroll area for materias
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
    
    def setup_menu(self):
        """Set up the menu bar."""
        menubar = self.menuBar()
        
        # File menu
        archivo_menu = menubar.addMenu("Archivo")
        
        nuevo_action = QAction("Nuevo", self)
        nuevo_action.triggered.connect(self.nuevo_horario)
        nuevo_action.setToolTip("Crear un nuevo horario")
        archivo_menu.addAction(nuevo_action)
        
        abrir_action = QAction("Abrir", self)
        abrir_action.triggered.connect(self.abrir_archivo)
        abrir_action.setToolTip("Abrir un horario existente")
        archivo_menu.addAction(abrir_action)
        
        guardar_action = QAction("Guardar", self)
        guardar_action.triggered.connect(self.guardar)
        guardar_action.setToolTip("Guardar el horario actual")
        archivo_menu.addAction(guardar_action)
        
        guardar_como_action = QAction("Guardar como", self)
        guardar_como_action.triggered.connect(self.guardar_archivo)
        guardar_como_action.setToolTip("Guardar el horario con un nombre diferente")
        archivo_menu.addAction(guardar_como_action)
        
        exportar_cal_action = QAction("Exportar Calendario", self)
        exportar_cal_action.triggered.connect(self.exportar_calendario)
        exportar_cal_action.setToolTip("Exportar horario a formato iCalendar (.ics)")
        archivo_menu.addAction(exportar_cal_action)
        
        # Edit menu
        editar_menu = menubar.addMenu("Editar")
        
        add_materia_action = QAction("Añadir Materia", self)
        add_materia_action.triggered.connect(self.show_add_materia_dialog)
        add_materia_action.setToolTip("Añadir una nueva materia al horario")
        editar_menu.addAction(add_materia_action)
        
        deselect_action = QAction("Deseleccionar Todo", self)
        deselect_action.triggered.connect(self.deseleccionar_todo)
        deselect_action.setToolTip("Deseleccionar todos los paralelos")
        editar_menu.addAction(deselect_action)
        
        generar_combo_action = QAction("Generar Combinación", self)
        generar_combo_action.triggered.connect(self.generar_combinacion)
        generar_combo_action.setToolTip("Generar una combinación sin conflictos")
        editar_menu.addAction(generar_combo_action)
        
        # View menu
        ver_menu = menubar.addMenu("Ver")
        
        calendario_action = QAction("Vista de Horario", self)
        calendario_action.triggered.connect(self.mostrar_calendario)
        calendario_action.setToolTip("Mostrar el horario semanal")
        ver_menu.addAction(calendario_action)
        
        colapsar_action = QAction("Colapsar Todo", self)
        colapsar_action.triggered.connect(self.colapsar_todo)
        colapsar_action.setToolTip("Colapsar todas las materias")
        ver_menu.addAction(colapsar_action)
        
        expandir_action = QAction("Expandir Todo", self)
        expandir_action.triggered.connect(self.expandir_todo)
        expandir_action.setToolTip("Expandir todas las materias")
        ver_menu.addAction(expandir_action)
        
        # Columns submenu
        columnas_menu = ver_menu.addMenu("Columnas")
        self.columnas_actions = []
        
        for i in range(1, 5):
            columna_action = QAction(f"{i} Columna{'s' if i > 1 else ''}", self)
            columna_action.setData(i)
            columna_action.setCheckable(True)
            columna_action.triggered.connect(self.cambiar_columnas)
            columna_action.setToolTip(f"Mostrar materias en {i} columna{'s' if i > 1 else ''}")
            columnas_menu.addAction(columna_action)
            self.columnas_actions.append(columna_action)
        self.columnas_actions[0].setChecked(True)
        
        # Theme submenu
        tema_menu = ver_menu.addMenu("Tema")
        self.tema_actions = []
        self.cargar_temas(tema_menu)
    
    def cargar_temas(self, tema_menu):
        """Load available themes into the menu."""
        for theme_name, theme_path in self.theme_manager.available_themes:
            action = QAction(theme_name, self)
            action.setCheckable(True)
            action.triggered.connect(
                lambda checked, path=theme_path, name=theme_name: 
                self.aplicar_tema(path, name)
            )
            action.setToolTip(f"Aplicar tema {theme_name}")
            tema_menu.addAction(action)
            self.tema_actions.append(action)
        
        if not self.tema_actions:
            self.theme_manager.apply_default_theme(QApplication.instance())
    
    def aplicar_tema(self, theme_path: str, theme_name: str):
        """Apply a theme to the application."""
        if self.theme_manager.apply_theme(theme_path, theme_name, QApplication.instance()):
            for action in self.tema_actions:
                action.setChecked(action.text() == theme_name)
    
    def actualizar_materias_label(self):
        """Update the materias label."""
        if not self.materias:
            self.materias_label.setText("Arrastra o crea un archivo para empezar.")
            self.materias_label.setAlignment(Qt.AlignCenter)
            self.materias_label.setStyleSheet("color: #5c6e91;")
            self.drag_icon.setVisible(True)
            self.centralWidget().layout().setContentsMargins(50, 50, 50, 50)
        else:
            self.materias_label.setText(f"     Materias (Créditos: {self.total_creditos})")
            self.materias_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
            self.materias_label.setStyleSheet("")
            self.drag_icon.setVisible(False)
            self.centralWidget().layout().setContentsMargins(10, 10, 10, 10)
    
    def actualizar_creditos(self):
        """Update the total credits count."""
        self.total_creditos = 0
        for materia in self.materias:
            # Sum credits only if materia has at least one selected paralelo
            for paralelo in materia.paralelos:
                if paralelo.checkbox.isChecked():
                    self.total_creditos += materia.creditos
                    break
        
        self.actualizar_materias_label()
    
    def actualizar_titulo(self):
        """Update the window title."""
        if self.archivo_actual:
            nombre_archivo = os.path.basename(self.archivo_actual)
            self.setWindowTitle(f'"{nombre_archivo}" - PoliBaldeo')
        else:
            self.setWindowTitle('"Sin título" - PoliBaldeo')
    
    def show_add_materia_dialog(self):
        """Show dialog to add a new materia."""
        dialog = AddMateriaDialog(self)
        if dialog.exec():
            nombre, creditos = dialog.get_materia_data()
            if nombre:
                self.añadir_materia(nombre, creditos)
    
    def añadir_materia(self, nombre: str, creditos: int = 0):
        """Add a new materia."""
        materia_widget = MateriaWidget(nombre, self, creditos)
        
        num_materias = len(self.materias)
        fila = num_materias // self.columnas
        columna = num_materias % self.columnas
        
        self.materias_grid.addWidget(materia_widget, fila, columna)
        self.materias.append(materia_widget)
        self.actualizar_materias_label()
    
    def eliminar_materia(self, materia_widget: MateriaWidget):
        """Remove a materia."""
        index = self.materias.index(materia_widget)
        self.materias_grid.removeWidget(materia_widget)
        
        self.materias.remove(materia_widget)
        materia_widget.deleteLater()
        
        self.reorganizar_materias()
        self.verificar_conflictos()
        self.actualizar_creditos()
        
        if self.calendario_window:
            self.calendario_window.actualizar_calendario()
        
        self.actualizar_materias_label()
    
    def reorganizar_materias(self):
        """Reorganize materias in the grid."""
        for i in reversed(range(self.materias_grid.count())):
            self.materias_grid.itemAt(i).widget().setParent(None)
        
        for i, materia in enumerate(self.materias):
            fila = i // self.columnas
            columna = i % self.columnas
            self.materias_grid.addWidget(materia, fila, columna, alignment=Qt.AlignTop)
    
    def cambiar_columnas(self):
        """Change the number of columns in the grid."""
        action = self.sender()
        self.columnas = action.data()
        for columna_action in self.columnas_actions:
            columna_action.setChecked(columna_action == action)
        self.reorganizar_materias()
    
    def colapsar_todo(self):
        """Collapse all materias."""
        for materia in self.materias:
            materia.collapse()
    
    def expandir_todo(self):
        """Expand all materias."""
        for materia in self.materias:
            materia.expand()
    
    def deseleccionar_todo(self):
        """Deselect all paralelos."""
        for materia in self.materias:
            for paralelo in materia.paralelos:
                paralelo.checkbox.setChecked(False)
        
        self.restaurar_checkboxes()
        self.actualizar_creditos()
        
        if self.calendario_window:
            self.calendario_window.actualizar_calendario()
    
    def restaurar_checkboxes(self):
        """Restore all checkboxes to enabled state."""
        for materia in self.materias:
            for paralelo in materia.paralelos:
                paralelo.setCheckboxEnabled(True)
    
    def verificar_conflictos(self):
        """Check for schedule conflicts."""
        bloques_ocupados = {}
        paralelos_por_materia = {}
        
        self.restaurar_checkboxes()
        
        # Check selected paralelos
        for materia in self.materias:
            paralelos_seleccionados = []
            
            for paralelo in materia.paralelos:
                if paralelo.checkbox.isChecked():
                    paralelos_seleccionados.append(paralelo)
                    
                    for bloque in paralelo.bloques:
                        dia, hora_inicio, hora_fin = TimeUtils.parse_bloque(bloque)
                        
                        # Convert to minutes for efficient checking
                        inicio_minutos = TimeUtils.hora_a_minutos(hora_inicio)
                        fin_minutos = TimeUtils.hora_a_minutos(hora_fin)
                        
                        # Store block information
                        for minuto in range(inicio_minutos, fin_minutos, 30):  # Every 30 minutes
                            key = (dia, minuto)
                            bloques_ocupados[key] = materia.nombre
            
            if paralelos_seleccionados:
                paralelos_por_materia[materia.nombre] = paralelos_seleccionados
        
        # Check conflicts for unselected paralelos
        for materia in self.materias:
            # If materia has selected paralelos, disable others
            if materia.nombre in paralelos_por_materia:
                for paralelo in materia.paralelos:
                    if not paralelo.checkbox.isChecked():
                        paralelo.checkbox.setEnabled(False)
            
            # Check time conflicts
            for paralelo in materia.paralelos:
                if not paralelo.checkbox.isChecked() and paralelo.checkbox.isEnabled():
                    tiene_conflicto = False
                    
                    for bloque in paralelo.bloques:
                        dia, hora_inicio, hora_fin = TimeUtils.parse_bloque(bloque)
                        inicio_minutos = TimeUtils.hora_a_minutos(hora_inicio)
                        fin_minutos = TimeUtils.hora_a_minutos(hora_fin)
                        
                        # Check if there's conflict in any minute of the block
                        for minuto in range(inicio_minutos, fin_minutos, 30):
                            key = (dia, minuto)
                            if key in bloques_ocupados:
                                tiene_conflicto = True
                                break
                        
                        if tiene_conflicto:
                            break
                    
                    if tiene_conflicto:
                        paralelo.checkbox.setEnabled(False)
        
        if self.calendario_window:
            self.calendario_window.actualizar_calendario()
    
    def mostrar_calendario(self):
        """Show the calendar window."""
        if self.calendario_window and self.calendario_window.isVisible():
            self.calendario_window.close()
        
        self.calendario_window = CalendarioWindow(self)
        self.calendario_window.actualizar_calendario()
        self.calendario_window.show()
    
    def nuevo_horario(self):
        """Create a new schedule."""
        if not self.materias:
            if self.archivo_actual is None:
                self.actualizar_titulo()
            return
        
        reply = QMessageBox.question(
            self, "Nuevo Horario",
            "¿Estás seguro de crear un nuevo horario? Se perderán todos los datos actuales.",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            for i in reversed(range(self.materias_grid.count())):
                widget = self.materias_grid.itemAt(i).widget()
                if widget:
                    widget.setParent(None)
            
            self.materias.clear()
            self.archivo_actual = None
            self.total_creditos = 0
            self.actualizar_titulo()
            
            if self.calendario_window:
                self.calendario_window.actualizar_calendario()
            
            self.actualizar_materias_label()
    
    def guardar(self):
        """Save the current schedule."""
        if not self.materias:
            QMessageBox.warning(self, "Guardar", "No hay datos para guardar.")
            return
        
        if self.archivo_actual:
            if FileHandler.save_to_file(self.archivo_actual, self.materias):
                QMessageBox.information(self, "Guardado", "Archivo guardado exitosamente.")
        else:
            self.guardar_archivo()
    
    def guardar_archivo(self):
        """Save the schedule to a new file."""
        if not self.materias:
            QMessageBox.warning(self, "Guardar como", "No hay datos para guardar.")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "Guardar Horario", "", 
            f"Archivos PoliBaldeo (*{POLIBALDEO_EXTENSION})"
        )
        
        if file_path:
            file_path = FileHandler.validate_filepath(file_path, POLIBALDEO_EXTENSION)
            self.archivo_actual = file_path
            self.guardar()
            self.actualizar_titulo()
    
    def abrir_archivo(self):
        """Open an existing schedule file."""
        if self.materias:
            reply = QMessageBox.question(
                self,
                "Guardar cambios",
                "¿Deseas guardar los cambios antes de abrir un nuevo archivo?",
                QMessageBox.Yes | QMessageBox.No | QMessageBox.Cancel
            )
            
            if reply == QMessageBox.Yes:
                self.guardar_archivo()
            elif reply == QMessageBox.Cancel:
                return
        
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Abrir Horario", "", 
            f"Archivos PoliBaldeo (*{POLIBALDEO_EXTENSION})"
        )
        
        if file_path:
            try:
                self.archivo_actual = file_path
                self.cargar_desde_archivo(file_path)
                self.actualizar_titulo()
            except Exception as e:
                QMessageBox.critical(self, "Error", f"No se pudo abrir el archivo: {str(e)}")
    
    def cargar_desde_archivo(self, file_path: str):
        """Load schedule from a file."""
        # Clear existing materias
        for i in reversed(range(self.materias_grid.count())):
            widget = self.materias_grid.itemAt(i).widget()
            if widget:
                widget.setParent(None)
        
        self.materias.clear()
        self.total_creditos = 0
        
        # Load data from file
        materias_data = FileHandler.load_from_file(file_path)
        if not materias_data:
            return
        
        # Create materias and paralelos
        for materia_data in materias_data:
            nombre_materia = materia_data['nombre']
            creditos = materia_data['creditos']
            
            self.añadir_materia(nombre_materia, creditos)
            materia_widget = self.materias[-1]
            
            for paralelo_data in materia_data['paralelos']:
                paralelo_widget = ParaleloWidget(
                    paralelo_data['nombre'],
                    paralelo_data['bloques'],
                    materia_widget,
                    paralelo_data['info']
                )
                paralelo_widget.checkbox.setChecked(paralelo_data['selected'])
                materia_widget.paralelos_layout.addWidget(paralelo_widget)
                materia_widget.paralelos.append(paralelo_widget)
        
        self.verificar_conflictos()
        self.actualizar_creditos()
    
    def exportar_calendario(self):
        """Export schedule to iCalendar format."""
        if not self.materias:
            QMessageBox.warning(self, "Exportar", "No hay datos para exportar.")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "Exportar Calendario", "", 
            f"Archivos iCalendar (*{ICALENDAR_EXTENSION})"
        )
        
        if file_path:
            if CalendarExporter.export_to_ics(file_path, self.materias):
                QMessageBox.information(
                    self, "Exportación exitosa", 
                    f"Calendario exportado a: {file_path}"
                )
    
    def generar_combinacion(self):
        """Generate a combination of paralelos without conflicts."""
        if not self.materias:
            QMessageBox.information(
                self, "Generar Combinación", 
                "No hay materias para generar combinaciones."
            )
            return
        
        # Deselect all first
        self.deseleccionar_todo()
        
        # Show progress
        progress = QProgressDialog(
            "Generando combinaciones...", "Cancelar", 0, 100, self
        )
        progress.setWindowTitle("Generador de Combinaciones")
        progress.setWindowModality(Qt.WindowModal)
        progress.show()
        
        # Generate all possible combinations
        todas_combinaciones = []
        materias_con_paralelos = [m for m in self.materias if m.paralelos]
        
        if not materias_con_paralelos:
            progress.close()
            QMessageBox.information(
                self, "Generar Combinación", 
                "No hay paralelos para generar combinaciones."
            )
            return
        
        # Recursive function to generate combinations
        def backtrack(index: int, combinacion_actual: List):
            if progress.wasCanceled():
                return
            
            progress.setValue(int((index / len(materias_con_paralelos)) * 100))
            QApplication.processEvents()
            
            if index == len(materias_con_paralelos):
                todas_combinaciones.append(combinacion_actual.copy())
                return
            
            materia = materias_con_paralelos[index]
            for paralelo in materia.paralelos:
                # Check if this paralelo is compatible with current combination
                compatible = True
                for otra_materia, otro_paralelo in combinacion_actual:
                    if TimeUtils.hay_conflicto_horario(paralelo.bloques, otro_paralelo.bloques):
                        compatible = False
                        break
                
                if compatible:
                    combinacion_actual.append((materia, paralelo))
                    backtrack(index + 1, combinacion_actual)
                    combinacion_actual.pop()
        
        backtrack(0, [])
        progress.close()
        
        if not todas_combinaciones:
            QMessageBox.information(
                self, "Generar Combinación", 
                "No se encontraron combinaciones sin conflictos."
            )
            return
        
        # Show dialog to select combination
        dialog = CombinacionDialog(todas_combinaciones, self)
        if dialog.exec():
            combinacion = dialog.combinacion_seleccionada
            
            # Apply selected combination
            for materia, paralelo in combinacion:
                paralelo.checkbox.setChecked(True)
            
            self.verificar_conflictos()
            self.actualizar_creditos()
            
            if self.calendario_window:
                self.calendario_window.actualizar_calendario()
            
            QMessageBox.information(
                self, "Combinación Aplicada", 
                f"Se aplicó la combinación con {len(combinacion)} materias."
            )
    
    def dragEnterEvent(self, event):
        """Handle drag enter events."""
        if event.mimeData().hasUrls():
            event.accept()
        else:
            event.ignore()
    
    def dropEvent(self, event):
        """Handle drop events."""
        if event.mimeData().hasUrls():
            file_path = event.mimeData().urls()[0].toLocalFile()
            if file_path.endswith(POLIBALDEO_EXTENSION):
                self.archivo_actual = file_path
                self.cargar_desde_archivo(file_path)
                self.actualizar_titulo()
                self.drag_icon.setVisible(False)
            else:
                QMessageBox.warning(
                    self, "Archivo no válido", 
                    f"Por favor, arrastra un archivo de PoliBaldeo válido ({POLIBALDEO_EXTENSION})."
                )
    
    def closeEvent(self, event):
        """Handle close event."""
        if not self.materias:
            event.accept()
            return
        
        msg_box = QMessageBox(self)
        msg_box.setIcon(QMessageBox.Warning)
        msg_box.setWindowTitle("Cerrar aplicación")
        msg_box.setText(
            "¿Estás seguro de que deseas salir? "
            "Se perderán todos los datos actuales si no los guardas."
        )
        
        guardar_button = msg_box.addButton("Guardar", QMessageBox.AcceptRole)
        salir_button = msg_box.addButton("Salir sin guardar", QMessageBox.DestructiveRole)
        cancelar_button = msg_box.addButton("Cancelar", QMessageBox.RejectRole)
        
        msg_box.exec()
        
        if msg_box.clickedButton() == guardar_button:
            if self.archivo_actual:
                try:
                    self.guardar()
                    event.accept()
                except Exception as e:
                    QMessageBox.critical(self, "Error", f"No se pudo guardar el archivo: {str(e)}")
                    event.ignore()
            else:
                self.guardar_archivo()
                if self.archivo_actual is None:
                    event.ignore()
                else:
                    event.accept()
        elif msg_box.clickedButton() == salir_button:
            event.accept()
        else:
            event.ignore()