"""
Calendar window for displaying weekly schedule.
"""

from typing import Dict, Tuple, List
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                              QFrame, QGridLayout, QLabel, QPushButton, QScrollArea,
                              QFileDialog, QMessageBox, QStyle, QSizePolicy)
from PySide6.QtCore import Qt, QSize
from PySide6.QtGui import QFont, QPainter
from PySide6.QtPrintSupport import QPrinter
from config import (CUSTOM_FONT, CALENDARIO_WINDOW_SIZE, CALENDARIO_MIN_SIZE,
                   DIAS_SEMANA, HORA_INICIO, HORA_FIN)
from utils import TimeUtils


class CalendarioWindow(QMainWindow):
    """Window for displaying the weekly schedule calendar."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Horario Semanal - PoliBaldeo")
        self.resize(*CALENDARIO_WINDOW_SIZE)
        self.setMinimumSize(*CALENDARIO_MIN_SIZE)
        
        self.parent_app = parent
        self.celdas = {}
        
        self._setup_ui()
    
    def _setup_ui(self):
        """Set up the user interface."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        
        # Button frame
        button_frame = QFrame()
        button_frame.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        button_layout = QHBoxLayout(button_frame)
        button_layout.setContentsMargins(5, 0, 5, 0)
        button_layout.setSpacing(5)
        
        # Save button
        save_button = QPushButton()
        save_button.setFixedSize(24, 24)
        save_button.setIcon(self.style().standardIcon(QStyle.SP_DialogSaveButton))
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
        save_button.setToolTip("Guardar horario como imagen o PDF")
        button_layout.addWidget(save_button, alignment=Qt.AlignLeft)
        
        main_layout.addWidget(button_frame)
        
        # Title frame
        title_frame = QFrame()
        title_layout = QHBoxLayout(title_frame)
        title_layout.setContentsMargins(10, 0, 10, 30)
        title_layout.setSpacing(10)
        
        title = QLabel("Horario Semanal")
        title.setFont(QFont(CUSTOM_FONT, 24, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        title_layout.addWidget(title, alignment=Qt.AlignCenter)
        
        main_layout.addWidget(title_frame)
        
        # Header container
        header_scroll_container = QVBoxLayout()
        header_scroll_container.setSpacing(0)
        header_scroll_container.setContentsMargins(0, 0, 0, 0)
        main_layout.addLayout(header_scroll_container)
        
        # Header widget
        self.header_widget = QWidget()
        self.header_layout = QGridLayout(self.header_widget)
        self.header_layout.setSpacing(1)
        self.header_layout.setContentsMargins(0, 0, 0, 0)
        
        # Create header with day names
        dias_header = [""] + DIAS_SEMANA
        for col, dia in enumerate(dias_header):
            label = QLabel(f"{dia}")
            label.setAlignment(Qt.AlignCenter)
            if col == 0:
                label.setFixedWidth(40)
            elif col > 0:
                label.setFont(QFont(CUSTOM_FONT, 10, QFont.Bold))
            label.setStyleSheet("margin-bottom: 10px;")
            self.header_layout.addWidget(label, 0, col)
        
        for col in range(len(dias_header)):
            self.header_layout.setColumnStretch(col, 1)
        
        header_scroll_container.addWidget(self.header_widget)
        
        # Scroll area for calendar
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("QScrollArea { border: none; }")
        main_layout.addWidget(scroll_area)
        
        scroll_content = QWidget()
        scroll_area.setWidget(scroll_content)
        
        layout = QVBoxLayout(scroll_content)
        
        # Calendar grid
        self.grid = QGridLayout()
        self.grid.setSpacing(1)
        
        # Create time slots
        horas = TimeUtils.generar_horas()
        
        # Create time labels
        for row, hora in enumerate(horas, 1):
            label = QLabel(hora)
            label.setAlignment(Qt.AlignCenter | Qt.AlignVCenter)
            label.setFont(QFont(CUSTOM_FONT, 10, QFont.Bold))
            label.setFixedWidth(60)
            self.grid.addWidget(label, row, 0)
        
        # Create cells for each time slot and day
        for row in range(1, len(horas) + 1):
            for col in range(1, len(dias_header)):
                celda = QFrame()
                celda.setFrameShape(QFrame.StyledPanel)
                celda.setMinimumHeight(40)
                celda.setLayout(QVBoxLayout())
                celda.layout().setContentsMargins(3, 3, 3, 3)
                celda.layout().setSpacing(0)
                self.grid.addWidget(celda, row, col)
                
                hora = horas[row - 1]
                dia = dias_header[col]
                self.celdas[(dia, hora)] = celda
        
        # Set column stretches
        for col in range(len(dias_header)):
            self.grid.setColumnStretch(col, 1)
        
        layout.addLayout(self.grid)
        
        # Sync header with horizontal scrolling
        scroll_area.horizontalScrollBar().valueChanged.connect(
            self.sync_header_scroll
        )
    
    def sync_header_scroll(self, value: int):
        """Sync header scroll with content scroll."""
        self.header_widget.move(-value, self.header_widget.y())
    
    def guardar_vista(self):
        """Save the calendar view as image or PDF."""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "Guardar Horario", "", 
            "Imagen PNG (*.png);;PDF (*.pdf)"
        )
        
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
        """Update the calendar with selected paralelos."""
        # Clear all cells
        for celda in self.celdas.values():
            while celda.layout().count():
                item = celda.layout().takeAt(0)
                widget = item.widget()
                if widget:
                    widget.deleteLater()
        
        # Pre-calculate schedules
        horarios_paralelos = []
        for materia_widget in self.parent_app.materias:
            for paralelo in materia_widget.paralelos:
                if paralelo.checkbox.isChecked():
                    color_fondo = TimeUtils.generar_color_oscuro()
                    horarios = self.procesar_bloques_horarios(
                        materia_widget.nombre, paralelo, color_fondo
                    )
                    horarios_paralelos.extend(horarios)
        
        # Add all schedules to calendar
        for dia, hora, label_text, color_fondo in horarios_paralelos:
            key = (dia, hora)
            if key in self.celdas:
                celda = self.celdas[key]
                label = QLabel(label_text)
                label.setAlignment(Qt.AlignCenter)
                label.setStyleSheet(
                    f"background-color: {color_fondo}; "
                    f"border-radius: 3px; padding: 2px; color: white;"
                )
                celda.layout().addWidget(label)
    
    def procesar_bloques_horarios(self, nombre_materia: str, paralelo, 
                                  color_fondo: str) -> List[Tuple[str, str, str, str]]:
        """
        Process time blocks for a paralelo.
        
        Args:
            nombre_materia: Name of the materia
            paralelo: ParaleloWidget instance
            color_fondo: Background color for display
            
        Returns:
            List of tuples (day, time, label_text, color)
        """
        horarios = []
        first_cell_map = {}  # Track first cell of each day
        
        for bloque in paralelo.bloques:
            dia, hora_inicio, hora_fin = TimeUtils.parse_bloque(bloque)
            
            # Determine if this is the first cell of this day
            if dia not in first_cell_map:
                first_cell_map[dia] = True
            else:
                first_cell_map[dia] = False
            
            # Expand time range
            horas_bloque = TimeUtils.expand_time_range(hora_inicio, hora_fin)
            
            # Add all hours of the block
            for i, hora in enumerate(horas_bloque):
                label_text = nombre_materia
                if i == 0 and first_cell_map[dia]:
                    label_text += f" ({paralelo.nombre})"
                
                horarios.append((dia, hora, label_text, color_fondo))
        
        return horarios