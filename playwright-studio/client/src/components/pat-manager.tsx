import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KeyRoundIcon, PlusIcon, CopyIcon, TrashIcon, CheckIcon, ShieldAlertIcon } from 'lucide-react';

interface Pat {
  id: string;
  name: string;
  expiresAt: string | null;
  revoked: number;
  createdAt: string;
  lastUsedAt: string | null;
  // Only present in super_admin view
  userId?: string;
  userEmail?: string;
  userName?: string;
}

function formatDate(val: string | null) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

interface PatManagerProps {
  token: string;
  isSuperAdmin?: boolean;
}

export function PatManager({ token, isSuperAdmin = false }: PatManagerProps) {
  const [pats, setPats] = useState<Pat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('never');
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state
  const [revoking, setRevoking] = useState<string | null>(null);

  // Super admin: filter by user
  const [filterUserId, setFilterUserId] = useState<string>('all');

  const listUrl = isSuperAdmin ? '/apis/superadmin/pats' : '/apis/auth/pats';

  const fetchPats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load tokens');
      const data = await res.json();
      setPats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token, listUrl]);

  useEffect(() => { fetchPats(); }, [fetchPats]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: newName.trim() };
      if (expiresInDays !== 'never') body.expiresInDays = Number(expiresInDays);

      const res = await fetch('/apis/auth/pats', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create token');
      const data = await res.json();
      setCreatedToken(data.token);
      await fetchPats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setCreateOpen(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      // Super admin can revoke any token via the superadmin endpoint
      const revokeUrl = isSuperAdmin
        ? `/apis/superadmin/pats/${id}/revoke`
        : `/apis/auth/pats/${id}/revoke`;

      const res = await fetch(revokeUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to revoke token');
      await fetchPats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRevoking(null);
    }
  }

  function handleCopy() {
    if (!createdToken) return;
    navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setCreatedToken(null);
    setNewName('');
    setExpiresInDays('never');
    setCopied(false);
  }

  // Build unique user list for super_admin filter
  const uniqueUsers = isSuperAdmin
    ? Array.from(
        new Map(
          pats
            .filter(p => p.userId)
            .map(p => [p.userId, { id: p.userId!, email: p.userEmail ?? p.userId!, name: p.userName }])
        ).values()
      ).sort((a, b) => a.email.localeCompare(b.email))
    : [];

  // Apply filter
  const filteredPats = isSuperAdmin && filterUserId !== 'all'
    ? pats.filter(p => p.userId === filterUserId)
    : pats;

  const activePats = filteredPats.filter(p => !p.revoked && !isExpired(p.expiresAt));
  const inactivePats = filteredPats.filter(p => p.revoked || isExpired(p.expiresAt));

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Super admin notice + filter */}
      {isSuperAdmin && (
        <div className="flex items-start gap-3 bg-amber-950/20 border border-amber-800/40 rounded-lg px-4 py-3">
          <ShieldAlertIcon className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-300 font-medium">Super Admin view</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              You can see and revoke tokens for all users. Regular users only see their own tokens.
            </p>
          </div>
          {uniqueUsers.length > 1 && (
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-52 h-8 text-xs bg-zinc-900 border-zinc-700 text-white shrink-0">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all" className="text-xs">All users ({pats.length})</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.name ? `${u.name} (${u.email})` : u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {loading ? 'Loading…' : `${activePats.length} active token${activePats.length !== 1 ? 's' : ''}`}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
          <PlusIcon className="h-4 w-4" />
          Generate Token
        </Button>
      </div>

      {/* Active tokens */}
      {!loading && activePats.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-lg gap-2">
          <KeyRoundIcon className="h-8 w-8 opacity-40" />
          <p className="text-sm">No active tokens. Generate one to use with itgps-agent.</p>
        </div>
      )}

      {activePats.length > 0 && (
        <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
          {activePats.map(pat => (
            <div key={pat.id} className="flex items-center justify-between px-4 py-3 bg-zinc-900/50">
              <div className="flex items-center gap-3 min-w-0">
                <KeyRoundIcon className="h-4 w-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{pat.name}</p>
                  <p className="text-xs text-zinc-500">
                    {isSuperAdmin && pat.userEmail && (
                      <span className="text-zinc-400 mr-1.5">{pat.userName ?? pat.userEmail} ·</span>
                    )}
                    Created {formatDate(pat.createdAt)}
                    {pat.lastUsedAt && ` · Last used ${formatDate(pat.lastUsedAt)}`}
                    {pat.expiresAt && ` · Expires ${formatDate(pat.expiresAt)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Badge variant="outline" className="text-green-400 border-green-800 text-xs">Active</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 hover:text-red-400 h-7 w-7 p-0"
                  disabled={revoking === pat.id}
                  onClick={() => handleRevoke(pat.id)}
                  title="Revoke token"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inactive tokens (collapsed) */}
      {inactivePats.length > 0 && (
        <details className="group">
          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
            {inactivePats.length} revoked / expired token{inactivePats.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 rounded-lg border border-zinc-800 divide-y divide-zinc-800 overflow-hidden opacity-60">
            {inactivePats.map(pat => (
              <div key={pat.id} className="flex items-center justify-between px-4 py-3 bg-zinc-900/30">
                <div className="flex items-center gap-3 min-w-0">
                  <KeyRoundIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-400 truncate">{pat.name}</p>
                    <p className="text-xs text-zinc-600">
                      {isSuperAdmin && pat.userEmail && (
                        <span className="mr-1.5">{pat.userName ?? pat.userEmail} ·</span>
                      )}
                      Created {formatDate(pat.createdAt)}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs shrink-0 ml-4">
                  {pat.revoked ? 'Revoked' : 'Expired'}
                </Badge>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) handleCloseCreate(); }}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {createdToken ? 'Token Created' : 'Generate Personal Access Token'}
            </DialogTitle>
          </DialogHeader>

          {!createdToken ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="pat-name" className="text-zinc-300">Token name</Label>
                <Input
                  id="pat-name"
                  placeholder="e.g. My Laptop, CI Pipeline"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  className="bg-zinc-900 border-zinc-700 text-white"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Expiration</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="never">No expiration</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-zinc-400">
                Copy this token now — it won't be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-green-400 font-mono break-all select-all">
                  {createdToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-zinc-700 text-zinc-300 hover:text-white"
                  onClick={handleCopy}
                >
                  {copied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <CopyIcon className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                Use this token with <code className="text-zinc-300">itgps-agent config</code> when prompted for a PAT.
              </p>
            </div>
          )}

          <DialogFooter>
            {!createdToken ? (
              <>
                <Button variant="ghost" onClick={handleCloseCreate} className="text-zinc-400">
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
                  {creating ? 'Generating…' : 'Generate Token'}
                </Button>
              </>
            ) : (
              <Button onClick={handleCloseCreate}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
