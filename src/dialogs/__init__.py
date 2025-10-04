"""
Dialogs module for PoliBaldeo application.
"""

from .info_paralelo_dialog import InfoParaleloDialog
from .add_paralelo_dialog import AddParaleloDialog
from .add_materia_dialog import AddMateriaDialog
from .combinacion_dialog import CombinacionDialog

__all__ = [
    'InfoParaleloDialog',
    'AddParaleloDialog', 
    'AddMateriaDialog',
    'CombinacionDialog'
]