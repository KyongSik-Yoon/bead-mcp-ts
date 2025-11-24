import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
const BEADS_DIR = ".beads";
const BEADS_FILE = "beads.jsonl";
export class BeadsManager {
    rootDir;
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    getBeadsPath() {
        return path.join(this.rootDir, BEADS_DIR, BEADS_FILE);
    }
    ensureInitialized() {
        const beadsDir = path.join(this.rootDir, BEADS_DIR);
        if (!fs.existsSync(beadsDir)) {
            throw new Error("Beads not initialized. Run 'beads_init' first.");
        }
    }
    init() {
        const beadsDir = path.join(this.rootDir, BEADS_DIR);
        if (!fs.existsSync(beadsDir)) {
            fs.mkdirSync(beadsDir, { recursive: true });
        }
        const filePath = this.getBeadsPath();
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "");
        }
        return "Initialized .beads directory.";
    }
    getAll() {
        this.ensureInitialized();
        const filePath = this.getBeadsPath();
        if (!fs.existsSync(filePath))
            return [];
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim() !== "");
        return lines.map((line) => JSON.parse(line));
    }
    add(title, description, priority = 1) {
        this.ensureInitialized();
        const bead = {
            id: uuidv4(),
            title,
            description,
            status: "open",
            priority,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            labels: [],
        };
        const filePath = this.getBeadsPath();
        fs.appendFileSync(filePath, JSON.stringify(bead) + "\n");
        return bead;
    }
    update(id, updates) {
        this.ensureInitialized();
        const beads = this.getAll();
        const index = beads.findIndex((b) => b.id === id);
        if (index === -1)
            return null;
        const updatedBead = {
            ...beads[index],
            ...updates,
            updated_at: new Date().toISOString(),
        };
        beads[index] = updatedBead;
        this.saveAll(beads);
        return updatedBead;
    }
    saveAll(beads) {
        const filePath = this.getBeadsPath();
        const content = beads.map((b) => JSON.stringify(b)).join("\n") + "\n";
        fs.writeFileSync(filePath, content);
    }
}
