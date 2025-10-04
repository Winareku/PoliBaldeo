"""
Theme manager utility for PoliBaldeo application.
Manages loading and applying of themes.
"""

import os
from typing import List, Optional, Tuple
from PySide6.QtWidgets import QApplication, QMessageBox
from config import THEME_FOLDER, DEFAULT_THEME


class ThemeManager:
    """Manages application themes."""
    
    def __init__(self):
        self.current_theme = None
        self.available_themes = []
        self.load_available_themes()
    
    def load_available_themes(self) -> List[Tuple[str, str]]:
        """
        Load list of available themes from theme folder.
        
        Returns:
            List of tuples (theme_name, theme_path)
        """
        self.available_themes = []
        
        if not os.path.exists(THEME_FOLDER):
            return self.available_themes
        
        for theme_file in os.listdir(THEME_FOLDER):
            if theme_file.endswith(".qss"):
                theme_path = os.path.join(THEME_FOLDER, theme_file)
                theme_name = os.path.splitext(theme_file)[0]
                self.available_themes.append((theme_name, theme_path))
        
        return self.available_themes
    
    def apply_theme(self, theme_path: str, theme_name: str, application: QApplication) -> bool:
        """
        Apply a theme to the application.
        
        Args:
            theme_path: Path to the .qss file
            theme_name: Name of the theme
            application: QApplication instance
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(theme_path, "r", encoding="utf-8") as file:
                theme_content = file.read()
                application.setStyleSheet(theme_content)
                self.current_theme = theme_name
                return True
        except Exception as e:
            QMessageBox.critical(None, "Error", f"No se pudo cargar el tema: {str(e)}")
            return False
    
    def apply_default_theme(self, application: QApplication):
        """
        Apply the default theme to the application.
        
        Args:
            application: QApplication instance
        """
        application.setStyleSheet(DEFAULT_THEME)
        self.current_theme = "Default"
    
    def get_theme_by_name(self, theme_name: str) -> Optional[str]:
        """
        Get theme path by its name.
        
        Args:
            theme_name: Name of the theme
            
        Returns:
            Path to the theme file or None if not found
        """
        for name, path in self.available_themes:
            if name == theme_name:
                return path
        return None
    
    def get_current_stylesheet(self) -> str:
        """Return the current theme's stylesheet."""
        if hasattr(self, '_current_theme_path') and self._current_theme_path:
            with open(self._current_theme_path, 'r') as f:
                return f.read()
        return ""
    
    @staticmethod
    def apply_dark_theme(application: QApplication) -> bool:
        """
        Apply Dark theme if available.
        
        Args:
            application: QApplication instance
            
        Returns:
            True if applied, False otherwise
        """
        dark_path = os.path.join(THEME_FOLDER, "Dark.qss")
        if os.path.exists(dark_path):
            try:
                with open(dark_path, "r", encoding="utf-8") as file:
                    theme_content = file.read()
                    application.setStyleSheet(theme_content)
                    return True
            except Exception:
                pass
        return False