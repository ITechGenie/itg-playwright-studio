"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readGlobalConfig = readGlobalConfig;
exports.writeGlobalConfig = writeGlobalConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.itgps');
/**
 * Reads the global config from <configDir>/config.json.
 * Returns null if the file does not exist.
 */
async function readGlobalConfig(configDir) {
    const dir = configDir ?? DEFAULT_CONFIG_DIR;
    const filePath = path.join(dir, 'config.json');
    try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    }
    catch (err) {
        if (isNodeError(err) && err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }
}
/**
 * Writes the global config to <configDir>/config.json.
 * Creates the directory if it does not exist.
 * Sets file permissions to 0600 (owner read/write only).
 */
async function writeGlobalConfig(config, configDir) {
    const dir = configDir ?? DEFAULT_CONFIG_DIR;
    const filePath = path.join(dir, 'config.json');
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    await fs.promises.chmod(filePath, 0o600);
}
function isNodeError(err) {
    return err instanceof Error && 'code' in err;
}
//# sourceMappingURL=config-store.js.map