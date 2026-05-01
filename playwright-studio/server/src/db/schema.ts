import * as sqliteSchema from './schema.sqlite.js';
import * as pgSchema from './schema.pg.js';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PATH || '';
export const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

// Export tables with fake static typing as sqliteSchema to keep existing TS typings happy
export const users = (isPostgres ? pgSchema.users : sqliteSchema.users) as unknown as typeof sqliteSchema.users;
export const roles = (isPostgres ? pgSchema.roles : sqliteSchema.roles) as unknown as typeof sqliteSchema.roles;
export const memberships = (isPostgres ? pgSchema.memberships : sqliteSchema.memberships) as unknown as typeof sqliteSchema.memberships;
export const accessTokens = (isPostgres ? pgSchema.accessTokens : sqliteSchema.accessTokens) as unknown as typeof sqliteSchema.accessTokens;
export const projects = (isPostgres ? pgSchema.projects : sqliteSchema.projects) as unknown as typeof sqliteSchema.projects;
export const projectConfigs = (isPostgres ? pgSchema.projectConfigs : sqliteSchema.projectConfigs) as unknown as typeof sqliteSchema.projectConfigs;
export const executions = (isPostgres ? pgSchema.executions : sqliteSchema.executions) as unknown as typeof sqliteSchema.executions;
export const dataTemplates = (isPostgres ? pgSchema.dataTemplates : sqliteSchema.dataTemplates) as unknown as typeof sqliteSchema.dataTemplates;
export const templateAttributes = (isPostgres ? pgSchema.templateAttributes : sqliteSchema.templateAttributes) as unknown as typeof sqliteSchema.templateAttributes;
export const environments = (isPostgres ? pgSchema.environments : sqliteSchema.environments) as unknown as typeof sqliteSchema.environments;
export const dataSets = (isPostgres ? pgSchema.dataSets : sqliteSchema.dataSets) as unknown as typeof sqliteSchema.dataSets;
export const environmentDatasets = (isPostgres ? pgSchema.environmentDatasets : sqliteSchema.environmentDatasets) as unknown as typeof sqliteSchema.environmentDatasets;
export const schedules = (isPostgres ? pgSchema.schedules : sqliteSchema.schedules) as unknown as typeof sqliteSchema.schedules;
export const schedulerLock = (isPostgres ? pgSchema.schedulerLock : sqliteSchema.schedulerLock) as unknown as typeof sqliteSchema.schedulerLock;
export const testResults = (isPostgres ? pgSchema.testResults : sqliteSchema.testResults) as unknown as typeof sqliteSchema.testResults;

