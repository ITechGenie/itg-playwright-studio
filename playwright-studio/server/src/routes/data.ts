import { Router } from 'express';
import { db } from '../db/index.js';
import { dataTemplates, templateAttributes, environments, dataSets, environmentDatasets } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { generateId } from '../lib/uuid.js';
import * as crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-max!';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return text;
  }
}

function applyDefaults(vars: Record<string, string>, attrs: { key: string; defaultValue: string | null }[]) {
  const result = { ...vars };
  for (const attr of attrs) {
    if (attr.defaultValue != null && (result[attr.key] === undefined || result[attr.key] === '')) {
      result[attr.key] = attr.defaultValue;
    }
  }
  return result;
}

function processSecrets(vars: Record<string, string>, secretKeys: Set<string>, existingVars?: Record<string, string>) {
  const out = { ...vars };
  for (const [key, val] of Object.entries(out)) {
    if (secretKeys.has(key)) {
      if (!val || val === 'REDACTED') {
        out[key] = existingVars?.[key] ?? '';
      } else if (val.trim()) {
        out[key] = encrypt(val);
      }
    }
  }
  return out;
}

function redactSecrets(vars: Record<string, string>, secretKeys: Set<string>) {
  const out = { ...vars };
  for (const key of Object.keys(out)) {
    if (secretKeys.has(key) && out[key]) out[key] = 'REDACTED';
  }
  return out;
}

export function createDataRouter() {
  const router = Router();

  // ── Templates ──────────────────────────────────────────────────────────────

  router.get('/:projectId/data/templates', async (req, res) => {
    try {
      const { projectId } = req.params;
      const templates = await db.select().from(dataTemplates).where(eq(dataTemplates.projectId, projectId));
      res.json(templates.map(t => ({ ...t, attributes: [] })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch templates' }); }
  });

  router.get('/:projectId/data/templates/:templateId', async (req, res) => {
    try {
      const { templateId } = req.params;
      const [template] = await db.select().from(dataTemplates).where(eq(dataTemplates.id, templateId));
      if (!template) return res.status(404).json({ error: 'Template not found' });
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, templateId));
      res.json({ ...template, attributes: attrs });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch template' }); }
  });

  router.post('/:projectId/data/templates', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, attributes } = req.body;
      const templateId = generateId();
      await db.insert(dataTemplates).values({ id: templateId, projectId, name, createdAt: new Date() });
      if (Array.isArray(attributes)) {
        for (const attr of attributes) {
          await db.insert(templateAttributes).values({
            id: generateId(), templateId, key: attr.key, type: attr.type,
            scope: attr.scope, description: attr.description || null, defaultValue: attr.defaultValue || null,
          });
        }
      }
      res.status(201).json({ id: templateId, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create template' }); }
  });

  router.post('/:projectId/data/templates/:templateId', async (req, res) => {
    try {
      const { templateId } = req.params;
      const { name, attributes } = req.body;
      const [existing] = await db.select().from(dataTemplates).where(eq(dataTemplates.id, templateId));
      if (!existing) return res.status(404).json({ error: 'Template not found' });
      await db.update(dataTemplates).set({ name }).where(eq(dataTemplates.id, templateId));
      await db.delete(templateAttributes).where(eq(templateAttributes.templateId, templateId));
      if (Array.isArray(attributes)) {
        for (const attr of attributes) {
          await db.insert(templateAttributes).values({
            id: generateId(), templateId, key: attr.key, type: attr.type,
            scope: attr.scope, description: attr.description || null, defaultValue: attr.defaultValue || null,
          });
        }
      }
      res.json({ id: templateId, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update template' }); }
  });

  router.delete('/:projectId/data/templates/:templateId', async (req, res) => {
    try {
      const { templateId } = req.params;
      await db.delete(templateAttributes).where(eq(templateAttributes.templateId, templateId));
      await db.delete(dataTemplates).where(eq(dataTemplates.id, templateId));
      res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete template' }); }
  });

  // ── Environments ───────────────────────────────────────────────────────────

  router.get('/:projectId/data/environments', async (req, res) => {
    try {
      const { projectId } = req.params;
      const envs = await db.select().from(environments).where(eq(environments.projectId, projectId));
      res.json(envs.map(env => ({ ...env, variables: '{}' })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch environments' }); }
  });

  router.get('/:projectId/data/environments/:environmentId', async (req, res) => {
    try {
      const { environmentId } = req.params;
      const [env] = await db.select().from(environments).where(eq(environments.id, environmentId));
      if (!env) return res.status(404).json({ error: 'Environment not found' });

      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, env.templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const rawVars = JSON.parse(env.variables || '{}');
      const varsWithDefaults = applyDefaults(rawVars, attrs.filter(a => a.scope === 'environment'));
      const redacted = redactSecrets(varsWithDefaults, secretKeys);

      // Linked datasets
      const links = await db.select().from(environmentDatasets).where(eq(environmentDatasets.environmentId, environmentId));
      const dsIds = links.map(l => l.datasetId);
      const datasets = dsIds.length > 0
        ? await db.select({ id: dataSets.id, name: dataSets.name, createdAt: dataSets.createdAt })
            .from(dataSets).where(inArray(dataSets.id, dsIds))
        : [];

      res.json({ ...env, variables: JSON.stringify(redacted), datasets });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch environment' }); }
  });

  router.post('/:projectId/data/environments', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { templateId, name, variables } = req.body;
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const processedVars = processSecrets(variables || {}, secretKeys);
      const envId = generateId();
      await db.insert(environments).values({ id: envId, projectId, templateId, name, variables: JSON.stringify(processedVars), createdAt: new Date() });
      res.status(201).json({ id: envId, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create environment' }); }
  });

  router.post('/:projectId/data/environments/:environmentId', async (req, res) => {
    try {
      const { environmentId } = req.params;
      const { name, variables } = req.body;
      const [env] = await db.select().from(environments).where(eq(environments.id, environmentId));
      if (!env) return res.status(404).json({ error: 'Environment not found' });
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, env.templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const existingVars = JSON.parse(env.variables || '{}');
      const processedVars = processSecrets(variables || {}, secretKeys, existingVars);
      await db.update(environments).set({ name, variables: JSON.stringify(processedVars) }).where(eq(environments.id, environmentId));
      res.json({ id: environmentId, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update environment' }); }
  });

  router.delete('/:projectId/data/environments/:environmentId', async (req, res) => {
    try {
      const { environmentId } = req.params;
      // Remove links only — datasets themselves are not deleted (they may be linked to other envs)
      await db.delete(environmentDatasets).where(eq(environmentDatasets.environmentId, environmentId));
      await db.delete(environments).where(eq(environments.id, environmentId));
      res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete environment' }); }
  });

  // Link/unlink datasets to an environment
  router.post('/:projectId/data/environments/:environmentId/links', async (req, res) => {
    try {
      const { environmentId } = req.params;
      const { datasetIds } = req.body; // array of dataset IDs to set as the full linked set
      // Replace all links for this env
      await db.delete(environmentDatasets).where(eq(environmentDatasets.environmentId, environmentId));
      for (const dsId of (datasetIds || [])) {
        await db.insert(environmentDatasets).values({ id: generateId(), environmentId, datasetId: dsId });
      }
      res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update dataset links' }); }
  });

  // ── Datasets ───────────────────────────────────────────────────────────────

  // ── Datasets (ordered: static paths before parameterized) ─────────────────

  // List
  router.get('/:projectId/data/datasets', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { templateId } = req.query;
      const query = templateId
        ? and(eq(dataSets.projectId, projectId), eq(dataSets.templateId, templateId as string))
        : eq(dataSets.projectId, projectId);
      const sets = await db.select().from(dataSets).where(query);
      res.json(sets.map(s => ({ ...s, variables: '{}' })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch datasets' }); }
  });

  // Create single
  router.post('/:projectId/data/datasets', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { templateId, name, variables, environmentIds } = req.body;
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const processedVars = processSecrets(variables || {}, secretKeys);
      const datasetId = generateId();
      await db.insert(dataSets).values({ id: datasetId, projectId, templateId, name, variables: JSON.stringify(processedVars), createdAt: new Date() });
      for (const envId of (environmentIds || [])) {
        await db.insert(environmentDatasets).values({ id: generateId(), environmentId: envId, datasetId });
      }
      res.status(201).json({ id: datasetId, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create dataset' }); }
  });

  // Bulk create — registered BEFORE /:datasetId so Express doesn't match 'bulk' as an ID
  router.post('/:projectId/data/datasets/bulk', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { templateId, datasets, environmentIds } = req.body;
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const created = [];
      for (const ds of datasets) {
        const processedVars = processSecrets(ds.variables || {}, secretKeys);
        const datasetId = generateId();
        await db.insert(dataSets).values({ id: datasetId, projectId, templateId, name: ds.name, variables: JSON.stringify(processedVars), createdAt: new Date() });
        for (const envId of (environmentIds || [])) {
          await db.insert(environmentDatasets).values({ id: generateId(), environmentId: envId, datasetId });
        }
        created.push({ id: datasetId, name: ds.name });
      }
      res.status(201).json({ created });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to bulk create datasets' }); }
  });

  // Get single
  router.get('/:projectId/data/datasets/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params;
      const [dataset] = await db.select().from(dataSets).where(eq(dataSets.id, datasetId));
      if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, dataset.templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const rawVars = JSON.parse(dataset.variables || '{}');
      const varsWithDefaults = applyDefaults(rawVars, attrs.filter(a => a.scope === 'dataset'));
      const redacted = redactSecrets(varsWithDefaults, secretKeys);
      const links = await db.select().from(environmentDatasets).where(eq(environmentDatasets.datasetId, datasetId));
      const envIds = links.map(l => l.environmentId);
      const linkedEnvs = envIds.length > 0
        ? await db.select({ id: environments.id, name: environments.name }).from(environments).where(inArray(environments.id, envIds))
        : [];
      res.json({ ...dataset, variables: JSON.stringify(redacted), linkedEnvironments: linkedEnvs });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch dataset' }); }
  });

  // Update single
  router.post('/:projectId/data/datasets/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params;
      const { name, variables, environmentIds } = req.body;
      const [dataset] = await db.select().from(dataSets).where(eq(dataSets.id, datasetId));
      if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, dataset.templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const existingVars = JSON.parse(dataset.variables || '{}');
      const processedVars = processSecrets(variables || {}, secretKeys, existingVars);
      await db.update(dataSets).set({ name, variables: JSON.stringify(processedVars) }).where(eq(dataSets.id, datasetId));
      if (environmentIds !== undefined) {
        await db.delete(environmentDatasets).where(eq(environmentDatasets.datasetId, datasetId));
        for (const envId of environmentIds) {
          await db.insert(environmentDatasets).values({ id: generateId(), environmentId: envId, datasetId });
        }
      }
      res.json({ id: datasetId, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update dataset' }); }
  });

  // Delete single
  router.delete('/:projectId/data/datasets/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params;
      await db.delete(environmentDatasets).where(eq(environmentDatasets.datasetId, datasetId));
      await db.delete(dataSets).where(eq(dataSets.id, datasetId));
      res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete dataset' }); }
  });

  // Legacy env-scoped dataset GET (backward compat)
  router.get('/:projectId/data/environments/:environmentId/datasets/:datasetId', async (req, res) => {
    const { datasetId } = req.params;
    try {
      const [dataset] = await db.select().from(dataSets).where(eq(dataSets.id, datasetId));
      if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, dataset.templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      const rawVars = JSON.parse(dataset.variables || '{}');
      const varsWithDefaults = applyDefaults(rawVars, attrs.filter(a => a.scope === 'dataset'));
      res.json({ ...dataset, variables: JSON.stringify(redactSecrets(varsWithDefaults, secretKeys)) });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch dataset' }); }
  });

  return router;
}
