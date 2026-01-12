
import { Pad, SampleMetadata, StepData } from '../types';

const DB_NAME = 'uss44-sampler-db';
const DB_VERSION = 8; // Incremented for user library stores
const STORES = {
  SAMPLES: 'samples',
  PAD_CONFIGS: 'pad-configs',
  SAMPLE_METADATA: 'sample-metadata',
  SEQUENCES: 'sequences',
  // User Library Stores
  USER_SONGS: 'user_songs',
  USER_SOUNDS: 'user_sounds',
  USER_SEQUENCES: 'user_sequences'
};

export interface StoredSample {
  id: string;
  name: string;
  data: ArrayBuffer;
  waveform?: number[];
}

export interface LibraryEntry {
  name: string;
  date: number;
  data: any;
}

export class DbService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

        // System Stores
        if (!db.objectStoreNames.contains(STORES.SAMPLES)) {
          db.createObjectStore(STORES.SAMPLES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.PAD_CONFIGS)) {
          db.createObjectStore(STORES.PAD_CONFIGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SAMPLE_METADATA)) {
          db.createObjectStore(STORES.SAMPLE_METADATA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SEQUENCES)) {
          db.createObjectStore(STORES.SEQUENCES, { keyPath: 'id' });
        }

        // User Library Stores (Key is filename)
        if (!db.objectStoreNames.contains(STORES.USER_SONGS)) {
          db.createObjectStore(STORES.USER_SONGS, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(STORES.USER_SOUNDS)) {
          db.createObjectStore(STORES.USER_SOUNDS, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(STORES.USER_SEQUENCES)) {
          db.createObjectStore(STORES.USER_SEQUENCES, { keyPath: 'name' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- Generic Library Methods ---

  async listLibrary(storeName: string): Promise<{ name: string, date: number }[]> {
    await this.init();
    const tx = this.db!.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Return lightweight metadata only
        const results = request.result.map((item: LibraryEntry) => ({
          name: item.name,
          date: item.date
        }));
        // Sort by date descending
        resolve(results.sort((a, b) => b.date - a.date));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveToLibrary(storeName: string, name: string, data: any): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(storeName, 'readwrite');
    const entry: LibraryEntry = { name, date: Date.now(), data };
    tx.objectStore(storeName).put(entry);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadFromLibrary(storeName: string, name: string): Promise<any> {
    await this.init();
    const tx = this.db!.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(name);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFromLibrary(storeName: string, name: string): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(name);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async renameInLibrary(storeName: string, oldName: string, newName: string): Promise<void> {
    const data = await this.loadFromLibrary(storeName, oldName);
    if (!data) throw new Error("File not found");

    // Check if new name exists
    const exists = await this.loadFromLibrary(storeName, newName);
    if (exists) throw new Error("Filename already exists");

    await this.saveToLibrary(storeName, newName, data);
    await this.deleteFromLibrary(storeName, oldName);
  }

  // --- Existing System Persistence Methods ---

  async saveSample(sample: StoredSample): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.SAMPLES, 'readwrite');
    tx.objectStore(STORES.SAMPLES).put(sample);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllSamples(): Promise<StoredSample[]> {
    await this.init();
    const tx = this.db!.transaction(STORES.SAMPLES, 'readonly');
    const request = tx.objectStore(STORES.SAMPLES).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async savePadConfig(id: string, config: Partial<Pad>): Promise<void> {
    await this.init();
    const { buffer, ...persistentConfig } = config as any;
    const tx = this.db!.transaction(STORES.PAD_CONFIGS, 'readwrite');
    tx.objectStore(STORES.PAD_CONFIGS).put({ id, ...persistentConfig });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllPadConfigs(): Promise<any[]> {
    await this.init();
    const tx = this.db!.transaction(STORES.PAD_CONFIGS, 'readonly');
    const request = tx.objectStore(STORES.PAD_CONFIGS).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSequence(id: string, steps: StepData[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.SEQUENCES, 'readwrite');
    tx.objectStore(STORES.SEQUENCES).put({ id, steps });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllSequences(): Promise<{ id: string, steps: StepData[] }[]> {
    await this.init();
    const tx = this.db!.transaction(STORES.SEQUENCES, 'readonly');
    const request = tx.objectStore(STORES.SEQUENCES).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        // Filter out metadata record
        const items = request.result.filter((item: any) => !item.id.startsWith('__'));
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetadata(key: string, value: any): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.SEQUENCES, 'readwrite');
    tx.objectStore(STORES.SEQUENCES).put({ id: `__metadata_${key}`, value });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMetadata(key: string): Promise<any> {
    await this.init();
    const tx = this.db!.transaction(STORES.SEQUENCES, 'readonly');
    const request = tx.objectStore(STORES.SEQUENCES).get(`__metadata_${key}`);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSampleMetadata(list: SampleMetadata[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.SAMPLE_METADATA, 'readwrite');
    const store = tx.objectStore(STORES.SAMPLE_METADATA);
    store.clear();
    for (const item of list) {
      store.put(item);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSampleMetadata(): Promise<SampleMetadata[]> {
    await this.init();
    const tx = this.db!.transaction(STORES.SAMPLE_METADATA, 'readonly');
    const request = tx.objectStore(STORES.SAMPLE_METADATA).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    await this.init();
    const tx = this.db!.transaction([STORES.SAMPLES, STORES.PAD_CONFIGS, STORES.SEQUENCES], 'readwrite');
    tx.objectStore(STORES.SAMPLES).clear();
    tx.objectStore(STORES.PAD_CONFIGS).clear();
    tx.objectStore(STORES.SEQUENCES).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearSequences(): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.SEQUENCES, 'readwrite');
    tx.objectStore(STORES.SEQUENCES).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbService = new DbService();
