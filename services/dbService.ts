
import { Pad, SampleMetadata, StepData, Pattern, SongItem } from '../types';

const DB_NAME = 'uss44-sampler-db';
const DB_VERSION = 11; // Incremented for Song Mode migration
const STORES = {
  SAMPLES: 'samples',
  PAD_CONFIGS: 'pad-configs',
  SAMPLE_METADATA: 'sample-metadata',
  SEQUENCES: 'sequences',
  PATTERNS: 'patterns',
  SONGS: 'songs',
  // User Library Stores
  USER_SONGS: 'user_songs',
  USER_SOUNDS: 'user_sounds',
  USER_SEQUENCES: 'user_sequences',
  SAMPLE_PACKS: 'sample-packs'
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
        if (!db.objectStoreNames.contains(STORES.SAMPLE_PACKS)) {
          db.createObjectStore(STORES.SAMPLE_PACKS, { keyPath: 'id' });
        }

        // --- Song Mode Stores (v11) ---
        if (!db.objectStoreNames.contains(STORES.PATTERNS)) {
          const patternStore = db.createObjectStore(STORES.PATTERNS, { keyPath: 'id' });

          // MIGRATION: If we have data in SEQUENCES, migrate it to PATTERNS as 'Pattern A'
          if (e.oldVersion < 11 && db.objectStoreNames.contains(STORES.SEQUENCES)) {
            const seqStore = (e.currentTarget as IDBOpenDBRequest).transaction!.objectStore(STORES.SEQUENCES);
            const request = seqStore.getAll();
            request.onsuccess = () => {
              const sequences = request.result;
              if (sequences && sequences.length > 0) {
                const tracks: Record<string, StepData[]> = {};
                sequences.forEach((seq: any) => {
                  if (!seq.id.startsWith('__')) { // Ignore metadata
                    tracks[seq.id] = seq.steps;
                  }
                });

                if (Object.keys(tracks).length > 0) {
                  // Detect Step Count from data (usually 16 or 64)
                  let maxSteps = 16;
                  Object.values(tracks).forEach(steps => {
                    if (steps.length > maxSteps) maxSteps = 64; // Snap to 64 if any track > 16
                  });

                  const patternA: Pattern = {
                    id: 'ptn-0',
                    name: 'Pattern A',
                    tracks: tracks,
                    stepCount: maxSteps
                  };
                  patternStore.put(patternA);
                  console.log(`Migrated legacy sequences to Pattern A (${maxSteps} Steps)`);
                }
              }
            };
          }
        }

        if (!db.objectStoreNames.contains(STORES.SONGS)) {
          db.createObjectStore(STORES.SONGS, { autoIncrement: true }); // We'll just store one song array at key 'current' usually, or use 0
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("IndexedDB init blocked - please close other tabs of this app.");
      };
    });

    return this.initPromise;
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
    // Explicitly exclude non-persistent and redundant fields
    const { buffer, isHeld, lastTriggerTime, lastTriggerDuration, sampleName, waveform, ...persistentConfig } = config as any;
    const tx = this.db!.transaction(STORES.PAD_CONFIGS, 'readwrite');
    tx.objectStore(STORES.PAD_CONFIGS).put({ ...persistentConfig, id });
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
    const tx = this.db!.transaction(STORES.PATTERNS, 'readwrite');
    tx.objectStore(STORES.PATTERNS).put({ id: `__metadata_${key}`, value });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMetadata(key: string): Promise<any> {
    await this.init();
    const tx = this.db!.transaction(STORES.PATTERNS, 'readonly');
    const request = tx.objectStore(STORES.PATTERNS).get(`__metadata_${key}`);
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
    const tx = this.db!.transaction([STORES.SAMPLES, STORES.PAD_CONFIGS, STORES.PATTERNS, STORES.SONGS], 'readwrite');
    tx.objectStore(STORES.SAMPLES).clear();
    tx.objectStore(STORES.PAD_CONFIGS).clear();
    tx.objectStore(STORES.PATTERNS).clear();
    tx.objectStore(STORES.SONGS).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearSequences(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("IndexedDB not initialized");
    const tx = this.db.transaction([STORES.PATTERNS, STORES.SONGS], 'readwrite');
    tx.objectStore(STORES.PATTERNS).clear();
    tx.objectStore(STORES.SONGS).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearSoundKit(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("IndexedDB not initialized");
    const tx = this.db.transaction([STORES.SAMPLES, STORES.PAD_CONFIGS], 'readwrite');
    tx.objectStore(STORES.SAMPLES).clear();
    tx.objectStore(STORES.PAD_CONFIGS).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Sample Pack Management ---

  async saveSamplePack(pack: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("IndexedDB not initialized");
    const tx = this.db.transaction(STORES.SAMPLE_PACKS, 'readwrite');
    tx.objectStore(STORES.SAMPLE_PACKS).put(pack);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllSamplePacks(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error("IndexedDB not initialized");
    const tx = this.db.transaction(STORES.SAMPLE_PACKS, 'readonly');
    const request = tx.objectStore(STORES.SAMPLE_PACKS).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSamplePack(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error("IndexedDB not initialized");
    const tx = this.db.transaction(STORES.SAMPLE_PACKS, 'readwrite');
    tx.objectStore(STORES.SAMPLE_PACKS).delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // --- Song Mode Methods ---

  async savePattern(pattern: Pattern): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.PATTERNS, 'readwrite');
    tx.objectStore(STORES.PATTERNS).put(pattern);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllPatterns(): Promise<Pattern[]> {
    await this.init();
    const tx = this.db!.transaction(STORES.PATTERNS, 'readonly');
    const request = tx.objectStore(STORES.PATTERNS).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearPatterns(): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.PATTERNS, 'readwrite');
    tx.objectStore(STORES.PATTERNS).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveSong(song: SongItem[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction(STORES.SONGS, 'readwrite');
    // We store the active song list with a fixed key 'current_song'
    tx.objectStore(STORES.SONGS).put(song, 'current_song');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSong(): Promise<SongItem[]> {
    await this.init();
    // Check if store exists first (safety)
    if (!this.db!.objectStoreNames.contains(STORES.SONGS)) return [];

    const tx = this.db!.transaction(STORES.SONGS, 'readonly');
    const request = tx.objectStore(STORES.SONGS).get('current_song');
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbService = new DbService();
