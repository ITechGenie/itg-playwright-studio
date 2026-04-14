import JSZip from 'jszip';
import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';
import { db } from '../db/index.js';
import {
  users, roles, memberships, projects, projectConfigs,
  executions, schedules, dataTemplates, templateAttributes,
  environments, dataSets,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateId } from './uuid.js';

export type Scope = { projectId: string | null };

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: Array<{ table: string; row: number; message: string }>;
}

// Tables exported globally (all rows)
const GLOBAL_TABLES = [
  'users', 'roles', 'memberships', 'projects', 'project_configs',
  'executions', 'schedules', 'data_templates', 'template_attributes',
  'environments', 'data_sets',
] as const;

// Tables exported/imported at project scope (have project_id)
const PROJECT_TABLES = [
  'project_configs', 'data_templates', 'template_attributes',
  'environments', 'data_sets', 'schedules', 'executions',
] as const;

async function fetchTableRows(tableName: string, projectId: string | null): Promise<Record<string, any>[]> {
  switch (tableName) {
    case 'users': return db.select().from(users) as any;
    case 'roles': return db.select().from(roles) as any;
    case 'memberships': return db.select().from(memberships) as any;
    case 'projects': return db.select().from(projects) as any;
    case 'project_configs': {
      const rows = await db.select().from(projectConfigs);
      return projectId ? rows.filter(r => r.projectId === projectId) : rows;
    }
    case 'executions': {
      const rows = await db.select().from(executions);
      return projectId ? rows.filter(r => r.projectId === projectId) : rows;
    }
    case 'schedules': {
      const rows = await db.select().from(schedules);
      return projectId ? rows.filter(r => r.projectId === projectId) : rows;
    }
    case 'data_templates': {
      const rows = await db.select().from(dataTemplates);
      return projectId ? rows.filter(r => r.projectId === projectId) : rows;
    }
    case 'template_attributes': {
      if (projectId) {
        // Join through data_templates to filter by project
        const templates = await db.select().from(dataTemplates).where(eq(dataTemplates.projectId, projectId));
        const templateIds = new Set(templates.map(t => t.id));
        const attrs = await db.select().from(templateAttributes);
        return attrs.filter(a => templateIds.has(a.templateId));
      }
      return db.select().from(templateAttributes);
    }
    case 'environments': {
      const rows = await db.select().from(environments);
      return projectId ? rows.filter(r => r.projectId === projectId) : rows;
    }
    case 'data_sets': {
      const rows = await db.select().from(dataSets);
      return projectId ? rows.filter(r => r.projectId === projectId) : rows;
    }
    default: return [];
  }
}

export async function exportData(scope: Scope): Promise<Buffer> {
  const zip = new JSZip();
  const tables = scope.projectId ? PROJECT_TABLES : GLOBAL_TABLES;

  for (const tableName of tables) {
    const rows = await fetchTableRows(tableName, scope.projectId);
    // Serialize dates to ISO strings for CSV
    const serialized = rows.map(row => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = v instanceof Date ? v.toISOString() : v;
      }
      return out;
    });
    const csv = rows.length > 0 ? stringify(serialized, { header: true }) : '';
    zip.file(`${tableName}.csv`, csv);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

async function upsertRow(tableName: string, row: Record<string, any>, projectId: string | null): Promise<void> {
  // Override project_id for project-scoped imports
  if (projectId && 'projectId' in row) {
    row = { ...row, projectId };
  }

  // Parse date fields back from ISO strings
  const parseDate = (v: any) => (v ? new Date(v) : null);

  switch (tableName) {
    case 'project_configs':
      await db.insert(projectConfigs).values(row as any).onConflictDoUpdate({
        target: projectConfigs.id,
        set: row as any,
      });
      break;
    case 'data_templates':
      await db.insert(dataTemplates).values({ ...row, createdAt: parseDate(row.createdAt) } as any).onConflictDoUpdate({
        target: dataTemplates.id,
        set: { ...row, createdAt: parseDate(row.createdAt) } as any,
      });
      break;
    case 'template_attributes':
      await db.insert(templateAttributes).values(row as any).onConflictDoUpdate({
        target: templateAttributes.id,
        set: row as any,
      });
      break;
    case 'environments':
      await db.insert(environments).values({ ...row, createdAt: parseDate(row.createdAt) } as any).onConflictDoUpdate({
        target: environments.id,
        set: { ...row, createdAt: parseDate(row.createdAt) } as any,
      });
      break;
    case 'data_sets':
      await db.insert(dataSets).values({ ...row, createdAt: parseDate(row.createdAt) } as any).onConflictDoUpdate({
        target: dataSets.id,
        set: { ...row, createdAt: parseDate(row.createdAt) } as any,
      });
      break;
    case 'schedules':
      await db.insert(schedules).values({
        ...row,
        createdAt: parseDate(row.createdAt),
        lastRunAt: parseDate(row.lastRunAt),
        nextRunAt: parseDate(row.nextRunAt),
      } as any).onConflictDoUpdate({
        target: schedules.id,
        set: {
          ...row,
          createdAt: parseDate(row.createdAt),
          lastRunAt: parseDate(row.lastRunAt),
          nextRunAt: parseDate(row.nextRunAt),
        } as any,
      });
      break;
    case 'executions':
      await db.insert(executions).values({
        ...row,
        startTime: parseDate(row.startTime),
        endTime: parseDate(row.endTime),
      } as any).onConflictDoUpdate({
        target: executions.id,
        set: {
          ...row,
          startTime: parseDate(row.startTime),
          endTime: parseDate(row.endTime),
        } as any,
      });
      break;
    case 'users':
      await db.insert(users).values({ ...row, createdAt: parseDate(row.createdAt) } as any).onConflictDoUpdate({
        target: users.id,
        set: { ...row, createdAt: parseDate(row.createdAt) } as any,
      });
      break;
    case 'roles':
      await db.insert(roles).values(row as any).onConflictDoUpdate({
        target: roles.id,
        set: row as any,
      });
      break;
    case 'memberships':
      await db.insert(memberships).values({ ...row, createdAt: parseDate(row.createdAt) } as any).onConflictDoUpdate({
        target: memberships.id,
        set: { ...row, createdAt: parseDate(row.createdAt) } as any,
      });
      break;
    case 'projects':
      await db.insert(projects).values({
        ...row,
        createdAt: parseDate(row.createdAt),
        updatedAt: parseDate(row.updatedAt),
      } as any).onConflictDoUpdate({
        target: projects.id,
        set: {
          ...row,
          createdAt: parseDate(row.createdAt),
          updatedAt: parseDate(row.updatedAt),
        } as any,
      });
      break;
  }
}

export async function importData(scope: Scope, zipBuffer: Buffer): Promise<ImportResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new Error('INVALID_ZIP');
  }

  const tableOrder = scope.projectId
    ? PROJECT_TABLES
    : GLOBAL_TABLES;

  let inserted = 0;
  let skipped = 0;
  const errors: ImportResult['errors'] = [];

  for (const tableName of tableOrder) {
    const file = zip.file(`${tableName}.csv`);
    if (!file) continue;

    const csvText = await file.async('string');
    if (!csvText.trim()) continue;

    let rows: Record<string, any>[];
    try {
      rows = parse(csvText, { columns: true, skip_empty_lines: true });
    } catch (e: any) {
      errors.push({ table: tableName, row: 0, message: `CSV parse error: ${e.message}` });
      skipped++;
      continue;
    }

    for (let i = 0; i < rows.length; i++) {
      try {
        await upsertRow(tableName, rows[i], scope.projectId);
        inserted++;
      } catch (e: any) {
        errors.push({ table: tableName, row: i + 1, message: e.message });
        skipped++;
      }
    }
  }

  return { inserted, skipped, errors };
}
