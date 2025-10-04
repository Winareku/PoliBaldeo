"""
Time utilities for PoliBaldeo application.
Handles time conversions and conflict checking.
"""

from typing import List, Tuple
from random import randint


class TimeUtils:
    """Utility class for time-related operations."""
    
    @staticmethod
    def hora_a_minutos(hora_str: str) -> int:
        """
        Convert time string to minutes from 00:00.
        
        Args:
            hora_str: Time in format HH:MM
            
        Returns:
            Minutes from 00:00
        """
        h, m = map(int, hora_str.split(':'))
        return h * 60 + m
    
    @staticmethod
    def minutos_a_hora(minutos: int) -> str:
        """
        Convert minutes from 00:00 to time string.
        
        Args:
            minutos: Minutes from 00:00
            
        Returns:
            Time string in format HH:MM
        """
        h = minutos // 60
        m = minutos % 60
        return f"{h:02d}:{m:02d}"
    
    @staticmethod
    def generar_horas() -> List[str]:
        """
        Generate list of time slots from 7:00 to 21:30.
        
        Returns:
            List of time strings
        """
        horas = []
        for hora in range(7, 22):
            horas.append(f"{hora:02d}:00")
            if hora < 21:
                horas.append(f"{hora:02d}:30")
        return horas
    
    @staticmethod
    def hay_conflicto_horario(bloques1: List[str], bloques2: List[str]) -> bool:
        """
        Check if two sets of time blocks have conflicts.
        
        Args:
            bloques1: First list of time blocks
            bloques2: Second list of time blocks
            
        Returns:
            True if there's a conflict, False otherwise
        """
        for bloque1 in bloques1:
            dia1, horas1 = bloque1.split()
            inicio1, fin1 = horas1.split('-')
            
            for bloque2 in bloques2:
                dia2, horas2 = bloque2.split()
                inicio2, fin2 = horas2.split('-')
                
                # Only check if same day
                if dia1 == dia2:
                    # Convert to minutes for comparison
                    inicio1_min = TimeUtils.hora_a_minutos(inicio1)
                    fin1_min = TimeUtils.hora_a_minutos(fin1)
                    inicio2_min = TimeUtils.hora_a_minutos(inicio2)
                    fin2_min = TimeUtils.hora_a_minutos(fin2)
                    
                    # Check overlap
                    if not (fin1_min <= inicio2_min or fin2_min <= inicio1_min):
                        return True  # Conflict found
        
        return False  # No conflict
    
    @staticmethod
    def generar_color_oscuro() -> str:
        """
        Generate a random dark color for calendar display.
        
        Returns:
            Color string in RGB format
        """
        r = randint(0, 80)
        g = randint(50, 100)
        b = randint(50, 100)
        return f"rgb({r}, {g}, {b})"
    
    @staticmethod
    def parse_bloque(bloque: str) -> Tuple[str, str, str]:
        """
        Parse a time block string.
        
        Args:
            bloque: Time block string (e.g., "Lunes 10:00-12:00")
            
        Returns:
            Tuple of (day, start_time, end_time)
        """
        partes = bloque.split()
        dia = partes[0]
        horas = partes[1]
        hora_inicio, hora_fin = horas.split('-')
        return dia, hora_inicio, hora_fin
    
    @staticmethod
    def expand_time_range(hora_inicio: str, hora_fin: str) -> List[str]:
        """
        Expand a time range into 30-minute slots.
        
        Args:
            hora_inicio: Start time
            hora_fin: End time
            
        Returns:
            List of time slots
        """
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
        
        return horas_bloque