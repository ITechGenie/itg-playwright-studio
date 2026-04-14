import { useState, useEffect } from 'react';
import { getUserRoles, upsertUserRoles, type MembershipWithRole } from '@/services/user-admin-api-client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export interface RoleDrawerProps {
  apiBasePath: string;
  mode: 'global' | 'project';
  userId: string;
  userEmail?: string;
  open: boolean;
  onClose: () => void;
}

const GLOBAL_ROLES = ['user', 'admin', 'super_admin'];
const PROJECT_ROLES = ['user', 'admin'];

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  admin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  user: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

export function RoleDrawer({ apiBasePath, mode, userId, userEmail, open, onClose }: RoleDrawerProps) {
  const [globalRole, setGlobalRole] = useState<MembershipWithRole | null>(null);
  const [projectRoles, setProjectRoles] = useState<MembershipWithRole[]>([]);
  // Working state uses roleName as value (matches SelectItem values)
  const [pendingGlobalRole, setPendingGlobalRole] = useState<string>('');
  const [pendingProjectRoles, setPendingProjectRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getUserRoles(apiBasePath, userId)
      .then(data => {
        setGlobalRole(data.globalRole ?? null);
        setProjectRoles(data.projectRoles ?? []);
        // Use roleName as the working value so it matches SelectItem values
        setPendingGlobalRole(data.globalRole?.roleName ?? '');
        const initial: Record<string, string> = {};
        (data.projectRoles ?? []).forEach(pr => {
          if (pr.projectId) initial[pr.projectId] = pr.roleName;
        });
        setPendingProjectRoles(initial);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, apiBasePath, userId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === 'global') {
        const projectRolesPayload = Object.entries(pendingProjectRoles).map(([projectId, roleName]) => ({
          projectId,
          roleName,
        }));
        await upsertUserRoles(apiBasePath, userId, {
          globalRoleName: pendingGlobalRole || undefined,
          projectRoles: projectRolesPayload.length > 0 ? projectRolesPayload : undefined,
        });
      } else {
        const roleName = Object.values(pendingProjectRoles)[0] ?? projectRoles[0]?.roleName;
        if (roleName) {
          await upsertUserRoles(apiBasePath, userId, { roleName });
        }
      }
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save roles');
    } finally {
      setSaving(false);
    }
  };

  const roleChanged = () => {
    if (mode === 'global') {
      if (pendingGlobalRole !== (globalRole?.roleName ?? '')) return true;
      for (const pr of projectRoles) {
        if (pr.projectId && pendingProjectRoles[pr.projectId] !== pr.roleName) return true;
      }
      return false;
    }
    const pr = projectRoles[0];
    if (!pr) return false;
    return pendingProjectRoles[pr.projectId ?? ''] !== pr.roleName;
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-[440px] sm:w-[480px] flex flex-col">
        <SheetHeader className="pb-2">
          <SheetTitle>Manage Roles</SheetTitle>
          {userEmail && (
            <p className="text-xs text-muted-foreground font-mono truncate">{userEmail}</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading roles...</p>
          )}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          {!loading && mode === 'global' && (
            <>
              {/* Global role */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Global Role</Label>
                  {globalRole && (
                    <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[globalRole.roleName] ?? ''}`}>
                      current: {globalRole.roleName}
                    </Badge>
                  )}
                </div>
                <Select value={pendingGlobalRole} onValueChange={setPendingGlobalRole}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue placeholder="Select global role" />
                  </SelectTrigger>
                  <SelectContent>
                    {GLOBAL_ROLES.map(r => (
                      <SelectItem key={r} value={r}>
                        <span className="flex items-center gap-2">
                          {r}
                          {r === globalRole?.roleName && (
                            <span className="text-[10px] text-muted-foreground">(current)</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {projectRoles.length > 0 && (
                <>
                  <Separator className="border-zinc-800" />
                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Project Roles</Label>
                    {projectRoles.map(pr => (
                      <div key={pr.projectId} className="space-y-1.5 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-zinc-300">{pr.projectName ?? pr.projectId}</p>
                          <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[pr.roleName] ?? ''}`}>
                            {pr.roleName}
                          </Badge>
                        </div>
                        <Select
                          value={pr.projectId ? (pendingProjectRoles[pr.projectId] ?? pr.roleName) : pr.roleName}
                          onValueChange={val => {
                            if (pr.projectId) {
                              setPendingProjectRoles(prev => ({ ...prev, [pr.projectId!]: val }));
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROJECT_ROLES.map(r => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {!loading && mode === 'project' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Project Role</Label>
                {projectRoles[0] && (
                  <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[projectRoles[0].roleName] ?? ''}`}>
                    current: {projectRoles[0].roleName}
                  </Badge>
                )}
              </div>
              {projectRoles.length > 0 ? (
                projectRoles.map(pr => (
                  <Select
                    key={pr.projectId}
                    value={pr.projectId ? (pendingProjectRoles[pr.projectId] ?? pr.roleName) : pr.roleName}
                    onValueChange={val => {
                      if (pr.projectId) {
                        setPendingProjectRoles(prev => ({ ...prev, [pr.projectId!]: val }));
                      }
                    }}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_ROLES.map(r => (
                        <SelectItem key={r} value={r}>
                          <span className="flex items-center gap-2">
                            {r}
                            {r === pr.roleName && (
                              <span className="text-[10px] text-muted-foreground">(current)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No project membership found.</p>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="pt-4 border-t border-zinc-800 flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-zinc-700">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || !roleChanged()}
            className="bg-blue-600 hover:bg-blue-500"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
