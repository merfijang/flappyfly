import type { ExperimentRecord } from '../types';
const KEY = 'fly-brain-experiments-v1';
export class ExperimentHistory {
  static all(): ExperimentRecord[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }
  static add(record: ExperimentRecord) { localStorage.setItem(KEY, JSON.stringify([record, ...this.all()].slice(0, 100))); }
  static best() { return Math.max(0, ...this.all().map((r) => r.score)); }
  static leaders() { return [...this.all()].sort((a, b) => b.score - a.score || b.lifetime - a.lifetime).slice(0, 5); }
  static nextFlyId() { return Math.max(0, ...this.all().map((r) => r.flyId)) + 1; }
}
