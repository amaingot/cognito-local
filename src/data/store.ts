import fs from "fs";
import path from "path";

export class DataStore<T> {
  private data: Map<string, T> = new Map();
  private filePath: string | null;

  constructor(dataDir: string | null, fileName: string) {
    this.filePath = dataDir ? path.join(dataDir, fileName) : null;
    this.load();
  }

  private load(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.data = new Map(Object.entries(raw));
    } catch {
      // Start fresh if file is corrupted
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      this.filePath,
      JSON.stringify(Object.fromEntries(this.data), null, 2)
    );
  }

  get(key: string): T | undefined {
    return this.data.get(key);
  }

  set(key: string, value: T): void {
    this.data.set(key, value);
    this.persist();
  }

  delete(key: string): boolean {
    const result = this.data.delete(key);
    if (result) this.persist();
    return result;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  values(): T[] {
    return Array.from(this.data.values());
  }

  entries(): [string, T][] {
    return Array.from(this.data.entries());
  }

  size(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
    this.persist();
  }
}
