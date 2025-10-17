import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class FileStorageManager:
    def __init__(self, base_path: str = None):
        """Initialize file storage manager with proper directory structure"""
        if base_path is None:
            base_path = os.path.join(os.getcwd(), "file_storage")
        
        self.base_path = Path(base_path)
        self.uploads_dir = self.base_path / "uploads"
        self.processed_dir = self.base_path / "processed"
        self.models_dir = self.base_path / "models"
        self.workspace_dir = self.base_path / "workspace"
        self.database_dir = self.base_path / "database"
        
        # Create directory structure
        self._create_directories()
        
        # Initialize database
        self.db_path = self.database_dir / "file_storage.db"
        self._init_database()
    
    def _create_directories(self):
        """Create all necessary directories"""
        directories = [
            self.uploads_dir,
            self.processed_dir,
            self.models_dir,
            self.workspace_dir,
            self.database_dir
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created directory: {directory}")
    
    def _init_database(self):
        """Initialize SQLite database for file tracking"""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                original_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                upload_date TEXT NOT NULL,
                user_id TEXT,
                status TEXT DEFAULT 'uploaded',
                processing_result TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS processing_jobs (
                id TEXT PRIMARY KEY,
                file_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                error_message TEXT,
                result_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files (id)
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("Database initialized")
    
    def save_uploaded_file(self, file_content: bytes, filename: str, user_id: str = None) -> Dict[str, str]:
        """Save uploaded file and return file information"""
        try:
            # Generate unique file ID
            file_id = str(uuid.uuid4())
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_filename = self._sanitize_filename(filename)
            unique_filename = f"{timestamp}_{file_id}_{safe_filename}"
            
            # Save file
            file_path = self.uploads_dir / unique_filename
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            # Get file info
            file_size = len(file_content)
            file_type = self._get_file_type(filename)
            
            # Save to database
            self._save_file_record(file_id, filename, str(file_path), file_type, file_size, user_id)
            
            logger.info(f"File saved: {filename} -> {file_path}")
            
            return {
                'file_id': file_id,
                'original_name': filename,
                'file_path': str(file_path),
                'file_type': file_type,
                'file_size': file_size,
                'status': 'uploaded'
            }
            
        except Exception as e:
            logger.error(f"Error saving file {filename}: {str(e)}")
            raise e
    
    def create_workspace(self, job_id: str) -> Path:
        """Create workspace directory for processing job"""
        workspace_path = self.workspace_dir / job_id
        workspace_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created workspace: {workspace_path}")
        return workspace_path
    
    def save_processed_file(self, job_id: str, filename: str, content: bytes, file_type: str = "processed") -> str:
        """Save processed file (IFC, GLB, etc.)"""
        try:
            if file_type == "ifc":
                output_dir = self.processed_dir
            elif file_type == "glb":
                output_dir = self.models_dir
            else:
                output_dir = self.processed_dir
            
            output_path = output_dir / f"{job_id}_{filename}"
            with open(output_path, 'wb') as f:
                f.write(content)
            
            logger.info(f"Processed file saved: {output_path}")
            return str(output_path)
            
        except Exception as e:
            logger.error(f"Error saving processed file {filename}: {str(e)}")
            raise e
    
    def get_file_info(self, file_id: str) -> Optional[Dict]:
        """Get file information from database"""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM files WHERE id = ?', (file_id,))
        row = cursor.fetchone()
        
        if row:
            columns = [description[0] for description in cursor.description]
            file_info = dict(zip(columns, row))
            conn.close()
            return file_info
        
        conn.close()
        return None
    
    def update_file_status(self, file_id: str, status: str, processing_result: str = None):
        """Update file status in database"""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE files 
            SET status = ?, processing_result = ?
            WHERE id = ?
        ''', (status, processing_result, file_id))
        
        conn.commit()
        conn.close()
        logger.info(f"Updated file {file_id} status to {status}")
    
    def create_processing_job(self, file_id: str) -> str:
        """Create processing job record"""
        import sqlite3
        
        job_id = str(uuid.uuid4())
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO processing_jobs (id, file_id, status)
            VALUES (?, ?, ?)
        ''', (job_id, file_id, 'pending'))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Created processing job {job_id} for file {file_id}")
        return job_id
    
    def update_processing_job(self, job_id: str, status: str, progress: int = None, error_message: str = None, result_path: str = None):
        """Update processing job status"""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        if status == 'completed':
            cursor.execute('''
                UPDATE processing_jobs 
                SET status = ?, progress = ?, result_path = ?, completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (status, progress or 100, result_path, job_id))
        else:
            cursor.execute('''
                UPDATE processing_jobs 
                SET status = ?, progress = ?, error_message = ?
                WHERE id = ?
            ''', (status, progress, error_message, job_id))
        
        conn.commit()
        conn.close()
        logger.info(f"Updated processing job {job_id}: {status}")
    
    def list_user_files(self, user_id: str) -> List[Dict]:
        """List all files for a user"""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT f.*, pj.status as job_status, pj.progress, pj.error_message
            FROM files f
            LEFT JOIN processing_jobs pj ON f.id = pj.file_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        ''', (user_id,))
        
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        
        files = [dict(zip(columns, row)) for row in rows]
        
        conn.close()
        return files
    
    def cleanup_old_files(self, days_old: int = 30):
        """Clean up old files and database records"""
        import sqlite3
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.now() - timedelta(days=days_old)
        
        # Get old files
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT file_path FROM files 
            WHERE created_at < ?
        ''', (cutoff_date.isoformat(),))
        
        old_files = cursor.fetchall()
        
        # Delete files from filesystem
        for (file_path,) in old_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Deleted old file: {file_path}")
            except Exception as e:
                logger.warning(f"Could not delete file {file_path}: {e}")
        
        # Delete database records
        cursor.execute('''
            DELETE FROM files WHERE created_at < ?
        ''', (cutoff_date.isoformat(),))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Cleaned up files older than {days_old} days")
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        import re
        # Remove or replace unsafe characters
        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        return safe_filename
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from extension"""
        ext = Path(filename).suffix.lower()
        type_map = {
            '.dxf': 'dxf',
            '.dwg': 'dwg',
            '.ifc': 'ifc',
            '.glb': 'glb',
            '.gltf': 'gltf',
            '.obj': 'obj',
            '.skp': 'skp',
            '.pdf': 'pdf',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.png': 'image'
        }
        return type_map.get(ext, 'unknown')
    
    def _save_file_record(self, file_id: str, original_name: str, file_path: str, file_type: str, file_size: int, user_id: str = None):
        """Save file record to database"""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO files (id, original_name, file_path, file_type, file_size, upload_date, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (file_id, original_name, file_path, file_type, file_size, datetime.now().isoformat(), user_id))
        
        conn.commit()
        conn.close()
    
    def get_storage_stats(self) -> Dict:
        """Get storage statistics"""
        import sqlite3
        
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Count files by type
        cursor.execute('''
            SELECT file_type, COUNT(*) as count, SUM(file_size) as total_size
            FROM files
            GROUP BY file_type
        ''')
        
        type_stats = cursor.fetchall()
        
        # Total files
        cursor.execute('SELECT COUNT(*) FROM files')
        total_files = cursor.fetchone()[0]
        
        # Total size
        cursor.execute('SELECT SUM(file_size) FROM files')
        total_size = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            'total_files': total_files,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'by_type': {row[0]: {'count': row[1], 'size_bytes': row[2]} for row in type_stats}
        }
