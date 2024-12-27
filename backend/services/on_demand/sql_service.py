import sqlite3
from typing import List, Dict, Optional
import logging

class SQLService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SQLService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio SQL de forma lazy"""
        if hasattr(self, 'initialized'):
            return
            
        logger.info("💾 Inicializando SQLService")
        self._connection = None
        self.initialized = True
        logger.info("✅ SQLService base inicializado")

    @property
    def connection(self):
        """Obtiene la conexión SQL de forma lazy"""
        if self._connection is None:
            logger.info("🔌 Conectando a SQLite...")
            try:
                self._connection = sqlite3.connect('loinc.db')
                logger.info("✅ Conexión a SQLite establecida")
            except Exception as e:
                logger.error(f"❌ Error conectando a SQLite: {e}")
        return self._connection

    def setup_database(self):
        """Configura la base de datos y crea las tablas necesarias si no existen."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Crear tabla para documentación LOINC con soporte FTS5
                cursor.execute('''
                    CREATE VIRTUAL TABLE IF NOT EXISTS loinc_docs USING fts5(
                        loinc_num,
                        component,
                        property,
                        time_aspect,
                        system,
                        scale_type,
                        method_type,
                        class,
                        description
                    )
                ''')
                conn.commit()
        except sqlite3.Error as e:
            logging.error(f"Error configurando la base de datos: {e}")
            raise

    def search_loinc(self, query: str, limit: int = 10) -> List[Dict]:
        """
        Realiza una búsqueda en la documentación LOINC.
        
        Args:
            query: Término de búsqueda
            limit: Número máximo de resultados
            
        Returns:
            Lista de resultados coincidentes
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM loinc_docs 
                    WHERE loinc_docs MATCH ? 
                    ORDER BY rank 
                    LIMIT ?
                ''', (query, limit))
                
                results = cursor.fetchall()
                return [dict(row) for row in results]
        except sqlite3.Error as e:
            logging.error(f"Error en la búsqueda: {e}")
            return []

    def bulk_insert_docs(self, docs: List[Dict]) -> bool:
        """
        Inserta múltiples documentos LOINC en la base de datos.
        
        Args:
            docs: Lista de diccionarios con datos LOINC
            
        Returns:
            True si la inserción fue exitosa, False en caso contrario
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.executemany('''
                    INSERT INTO loinc_docs (
                        loinc_num, component, property, time_aspect,
                        system, scale_type, method_type, class, description
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', [(
                    doc.get('loinc_num', ''),
                    doc.get('component', ''),
                    doc.get('property', ''),
                    doc.get('time_aspect', ''),
                    doc.get('system', ''),
                    doc.get('scale_type', ''),
                    doc.get('method_type', ''),
                    doc.get('class', ''),
                    doc.get('description', '')
                ) for doc in docs])
                
                conn.commit()
                return True
        except sqlite3.Error as e:
            logging.error(f"Error en la inserción masiva: {e}")
            return False 