// Real local storage system using IndexedDB for persistent data storage
export interface StoredProject {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  fileData: ArrayBuffer; // Actual file data
  cadData: any; // Parsed CAD data
  floorPlanElements: any[];
  rooms: any[];
  ifcModel: any;
  ifcFile: any;
  processingStats: any;
  agentParameters: any;
  status: 'processing' | 'completed' | 'error';
  error?: string;
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  uploadDate: string;
}

class RealLocalStorage {
  private dbName = 'CADProcessorDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available in server environment');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('uploadDate', 'uploadDate', { unique: false });
          projectStore.createIndex('status', 'status', { unique: false });
        }

        // Files store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('name', 'name', { unique: false });
          fileStore.createIndex('type', 'type', { unique: false });
          fileStore.createIndex('uploadDate', 'uploadDate', { unique: false });
        }

        // Processing cache store
        if (!db.objectStoreNames.contains('processingCache')) {
          const cacheStore = db.createObjectStore('processingCache', { keyPath: 'fileId' });
          cacheStore.createIndex('processedDate', 'processedDate', { unique: false });
        }
      };
    });
  }

  async storeProject(project: StoredProject): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put(project);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProject(id: string): Promise<StoredProject | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProjects(): Promise<StoredProject[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async storeFile(file: StoredFile): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(file);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFile(id: string): Promise<StoredFile | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFiles(): Promise<StoredFile[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async storeProcessingCache(fileId: string, data: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['processingCache'], 'readwrite');
      const store = transaction.objectStore('processingCache');
      const request = store.put({
        fileId,
        data,
        processedDate: new Date().toISOString()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProcessingCache(fileId: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['processingCache'], 'readonly');
      const store = transaction.objectStore('processingCache');
      const request = store.get(fileId);

      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearProcessingCache(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['processingCache'], 'readwrite');
      const store = transaction.objectStore('processingCache');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageInfo(): Promise<{ used: number; available: number; projects: number; files: number }> {
    if (!this.db) await this.init();

    const projects = await this.getAllProjects();
    const files = await this.getAllFiles();

    // Calculate approximate storage usage
    let used = 0;
    projects.forEach(project => {
      used += project.fileSize;
      used += JSON.stringify(project.cadData).length;
      used += JSON.stringify(project.floorPlanElements).length;
      used += JSON.stringify(project.ifcModel).length;
    });

    files.forEach(file => {
      used += file.size;
    });

    return {
      used,
      available: 0, // Browser doesn't provide this info
      projects: projects.length,
      files: files.length
    };
  }

  async exportProject(id: string): Promise<Blob> {
    const project = await this.getProject(id);
    if (!project) throw new Error('Project not found');

    const exportData = {
      project,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  }

  async importProject(file: File): Promise<string> {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    if (!importData.project) throw new Error('Invalid project file');

    const project = importData.project;
    project.id = this.generateId(); // Generate new ID to avoid conflicts
    project.uploadDate = new Date().toISOString();

    await this.storeProject(project);
    return project.id;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Export singleton instance
export const realLocalStorage = new RealLocalStorage();
