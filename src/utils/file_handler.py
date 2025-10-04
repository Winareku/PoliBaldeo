"""
File handler utility for PoliBaldeo application.
Manages saving and loading of .poli files.
"""

import os
from typing import List, Tuple, Optional
from PySide6.QtWidgets import QMessageBox


class FileHandler:
    """Handles file operations for PoliBaldeo files."""
    
    @staticmethod
    def save_to_file(filepath: str, materias: List) -> bool:
        """
        Save materias data to a .poli file.
        
        Args:
            filepath: Path to save the file
            materias: List of MateriaWidget objects
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(filepath, 'w', encoding='utf-8') as file:
                for materia in materias:
                    file.write(f"{materia.nombre}|{materia.creditos}\n")
                    
                    for paralelo in materia.paralelos:
                        bloques_texto = '; '.join(paralelo.bloques)
                        estado_checkbox = '1' if paralelo.checkbox.isChecked() else '0'
                        # Escape newlines in info
                        info_escapada = paralelo.info.replace('\n', '\\n')
                        file.write(f"{paralelo.nombre} | {bloques_texto} | {estado_checkbox} | {info_escapada}\n")
                    
                    file.write('\n')
            return True
        except Exception as e:
            QMessageBox.critical(None, "Error", f"No se pudo guardar el archivo: {str(e)}")
            return False
    
    @staticmethod
    def load_from_file(filepath: str) -> Optional[List[dict]]:
        """
        Load materias data from a .poli file.
        
        Args:
            filepath: Path to load the file from
            
        Returns:
            List of dictionaries containing materia data, or None if error
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                contenido = file.read()
        except Exception as e:
            QMessageBox.critical(None, "Error", f"No se pudo leer el archivo: {str(e)}")
            return None
        
        materias_data = []
        materias_texto = contenido.split('\n\n')
        
        for materia_texto in materias_texto:
            if not materia_texto.strip():
                continue
            
            lineas = materia_texto.strip().split('\n')
            if not lineas:
                continue
            
            # Parse first line: nombre|creditos
            primera_linea = lineas[0].split('|')
            if len(primera_linea) == 1:
                nombre_materia = primera_linea[0].strip()
                creditos = 0
            else:
                nombre_materia = primera_linea[0].strip()
                try:
                    creditos = int(primera_linea[1].strip())
                except ValueError:
                    creditos = 0
            
            paralelos = []
            for i in range(1, len(lineas)):
                linea_paralelo = lineas[i].strip()
                if not linea_paralelo:
                    continue
                
                try:
                    partes = linea_paralelo.split('|')
                    if len(partes) < 3:
                        continue
                    
                    nombre_paralelo = partes[0].strip()
                    bloques_texto = partes[1].strip()
                    estado_checkbox = partes[2].strip() == '1'
                    
                    # Info field (may not be present in old files)
                    info = ""
                    if len(partes) >= 4:
                        info = partes[3].strip().replace('\\n', '\n')
                    
                    bloques = [bloque.strip() for bloque in bloques_texto.split(';')]
                    
                    paralelos.append({
                        'nombre': nombre_paralelo,
                        'bloques': bloques,
                        'selected': estado_checkbox,
                        'info': info
                    })
                except Exception as e:
                    print(f"Error al procesar paralelo: {str(e)}")
            
            materias_data.append({
                'nombre': nombre_materia,
                'creditos': creditos,
                'paralelos': paralelos
            })
        
        return materias_data
    
    @staticmethod
    def validate_filepath(filepath: str, extension: str = ".poli") -> str:
        """
        Validate and ensure file has correct extension.
        
        Args:
            filepath: Original file path
            extension: Expected file extension
            
        Returns:
            Validated filepath with correct extension
        """
        if not filepath.endswith(extension):
            filepath += extension
        return filepath