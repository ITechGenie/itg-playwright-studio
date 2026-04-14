import { useRef, useState } from 'react';
import { exportData, importData, type ImportResult } from '@/services/user-admin-api-client';
import { Button } from '@/components/ui/button';
import { Download, Upload, CheckCircle, AlertCircle } from 'lucide-react';

export interface DataTransferControlsProps {
  apiBasePath: string;
}

export function DataTransferControls({ apiBasePath }: DataTransferControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportData(apiBasePath);
    } catch (e: any) {
      setExportError(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    setImportResult(null);
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await importData(apiBasePath, file);
      setImportResult(result);
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export Data'}
        </Button>
        <Button variant="outline" onClick={handleImportClick} disabled={importing}>
          <Upload className="h-4 w-4 mr-2" />
          {importing ? 'Importing...' : 'Import Data'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {exportError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Export failed: {exportError}</span>
        </div>
      )}

      {importError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Import failed: {importError}</span>
        </div>
      )}

      {importResult && (
        <div className="rounded-md border p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Import complete
          </div>
          <div className="text-muted-foreground space-y-1">
            <p>Inserted: <span className="text-foreground font-medium">{importResult.inserted}</span></p>
            <p>Skipped: <span className="text-foreground font-medium">{importResult.skipped}</span></p>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="font-medium text-destructive">Row errors ({importResult.errors.length}):</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                {importResult.errors.map((e, i) => (
                  <li key={i}>{e.table} row {e.row}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
