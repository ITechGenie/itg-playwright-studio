import { Router } from 'express';
import { db } from '../db/index.js';
import { projects, dataTemplates, templateAttributes, environments, dataSets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateId } from '../lib/uuid.js';
import * as crypto from 'crypto';

// Encryption Utilities for "secret" types
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-max!'; // 32 bytes
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
  } catch (e) {
    return text; // Fallback if not encrypted (or wrong key)
  }
}

export function createDataRouter() {
  const router = Router();

  // 1. Templates
  router.get('/:projectId/data/templates', async (req, res) => {
    try {
      const { projectId } = req.params;
      const templates = await db.select().from(dataTemplates).where(eq(dataTemplates.projectId, projectId));
      
      const results = [];
      for (const t of templates) {
        const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, t.id));
        results.push({ ...t, attributes: attrs });
      }
      
      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  router.post('/:projectId/data/templates', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, attributes } = req.body;
      
      const templateId = generateId();
      await db.insert(dataTemplates).values({
        id: templateId,
        projectId,
        name,
        createdAt: new Date(),
      });

      if (attributes && Array.isArray(attributes)) {
        for (const attr of attributes) {
          await db.insert(templateAttributes).values({
            id: generateId(),
            templateId,
            key: attr.key,
            type: attr.type,
            scope: attr.scope,
            description: attr.description,
          });
        }
      }
      
      res.status(201).json({ id: templateId, name });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // 2. Environments
  router.get('/:projectId/data/environments', async (req, res) => {
    try {
      const { projectId } = req.params;
      const envs = await db.select().from(environments).where(eq(environments.projectId, projectId));
      
      const results = [];
      for (const env of envs) {
        // Find existing datasets
        const sets = await db.select().from(dataSets).where(eq(dataSets.environmentId, env.id));
        // Mask secrets locally? Not needed, we just don't return them if not necessary, but here we'll just not decrypt them for listing.
        results.push({ ...env, datasets: sets.map(s => ({ id: s.id, name: s.name })) });
      }
      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch environments' });
    }
  });

  router.post('/:projectId/data/environments', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { templateId, name, variables } = req.body; // variables is a Record<string, string>
      
      // Before storing, encrypt variables marked as "secret" in template
      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      
      const processedVars = { ...variables };
      for (const [key, val] of Object.entries(processedVars)) {
        if (secretKeys.has(key) && typeof val === 'string' && val.trim() !== '') {
          processedVars[key] = encrypt(val);
        }
      }

      const envId = generateId();
      await db.insert(environments).values({
        id: envId,
        projectId,
        templateId,
        name,
        variables: JSON.stringify(processedVars),
        createdAt: new Date(),
      });
      
      res.status(201).json({ id: envId, name });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create environment' });
    }
  });

  // 3. Datasets
  router.post('/:projectId/data/environments/:environmentId/datasets', async (req, res) => {
    try {
      const { environmentId } = req.params;
      const { name, variables } = req.body;

      // Find template via environment to know which are secrets
      const [env] = await db.select().from(environments).where(eq(environments.id, environmentId));
      if (!env) return res.status(404).json({ error: 'Environment not found' });

      const attrs = await db.select().from(templateAttributes).where(eq(templateAttributes.templateId, env.templateId));
      const secretKeys = new Set(attrs.filter(a => a.type === 'secret').map(a => a.key));
      
      const processedVars = { ...variables };
      for (const [key, val] of Object.entries(processedVars)) {
        if (secretKeys.has(key) && typeof val === 'string' && val.trim() !== '') {
          processedVars[key] = encrypt(val);
        }
      }

      const datasetId = generateId();
      await db.insert(dataSets).values({
        id: datasetId,
        environmentId,
        name,
        variables: JSON.stringify(processedVars),
        createdAt: new Date(),
      });
      
      res.status(201).json({ id: datasetId, name });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create dataset' });
    }
  });

  return router;
}
