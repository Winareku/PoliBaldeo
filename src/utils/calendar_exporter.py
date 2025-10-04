"""
Calendar exporter utility for PoliBaldeo application.
Exports schedules to iCalendar format.
"""

from datetime import datetime, timedelta
from typing import List
from PySide6.QtWidgets import QMessageBox
from config import DIAS_SEMANA, SEMESTER_WEEKS


class CalendarExporter:
    """Handles export of schedules to iCalendar format."""
    
    @staticmethod
    def export_to_ics(filepath: str, materias: List) -> bool:
        """
        Export schedule to iCalendar (.ics) format.
        
        Args:
            filepath: Path to save the .ics file
            materias: List of MateriaWidget objects
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create basic .ics file content
            ics_content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PoliBaldeo//EN"]
            
            # Get current date for semester (assume 16 weeks)
            fecha_inicio = datetime.now()
            # Adjust to next Monday
            dias_para_lunes = (0 - fecha_inicio.weekday()) % 7
            if dias_para_lunes == 0 and fecha_inicio.hour > 12:
                dias_para_lunes = 7
            fecha_inicio += timedelta(days=dias_para_lunes)
            fecha_fin = fecha_inicio + timedelta(weeks=SEMESTER_WEEKS)
            
            dias_semana_num = {"Lunes": 0, "Martes": 1, "Miércoles": 2, "Jueves": 3, "Viernes": 4}
            
            for materia in materias:
                for paralelo in materia.paralelos:
                    if paralelo.checkbox.isChecked():
                        for bloque in paralelo.bloques:
                            partes = bloque.split()
                            dia_nombre = partes[0]
                            rango = partes[1]
                            
                            hora_inicio, hora_fin = rango.split('-')
                            
                            # Create event for each week
                            fecha_actual = fecha_inicio
                            while fecha_actual <= fecha_fin:
                                if fecha_actual.weekday() == dias_semana_num[dia_nombre]:
                                    # Format dates for iCalendar
                                    inicio_dt = datetime.combine(
                                        fecha_actual, 
                                        datetime.strptime(hora_inicio, "%H:%M").time()
                                    )
                                    fin_dt = datetime.combine(
                                        fecha_actual, 
                                        datetime.strptime(hora_fin, "%H:%M").time()
                                    )
                                    
                                    ics_content.extend([
                                        "BEGIN:VEVENT",
                                        f"SUMMARY:{materia.nombre} ({paralelo.nombre})",
                                        f"DTSTART:{inicio_dt.strftime('%Y%m%dT%H%M%S')}",
                                        f"DTEND:{fin_dt.strftime('%Y%m%dT%H%M%S')}",
                                        f"DESCRIPTION:Paralelo: {paralelo.nombre}",
                                        "END:VEVENT"
                                    ])
                                
                                fecha_actual += timedelta(days=1)
            
            ics_content.append("END:VCALENDAR")
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write('\r\n'.join(ics_content))
            
            return True
            
        except Exception as e:
            QMessageBox.critical(None, "Error", f"No se pudo exportar el calendario: {str(e)}")
            return False