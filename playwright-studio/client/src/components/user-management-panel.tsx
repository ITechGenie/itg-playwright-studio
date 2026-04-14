import { useState, useEffect, useCallback } from 'react';
import { listUsers, type PaginatedUsersResponse } from '@/services/user-admin-api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { RoleDrawer } from './role-drawer';

export interface UserManagementPanelProps {
  apiBasePath: string;
  mode: 'global' | 'project';
}

export function UserManagementPanel({ apiBasePath, mode }: UserManagementPanelProps) {
  const [data, setData] = useState<PaginatedUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [drawerUserEmail, setDrawerUserEmail] = useState<string>('');

  const fetchUsers = useCallback(async (p: number, search: string) => {
    setLoading(true);
    setError(null);
    try {
      // Determine if search looks like an email or providerId
      const isEmail = search.includes('@');
      const opts = {
        page: p,
        limit: 20,
        ...(search ? (isEmail ? { email: search } : { providerId: search }) : {}),
      };
      const result = await listUsers(apiBasePath, opts);
      setData(result);
    } catch (e: any) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    fetchUsers(page, activeSearch);
  }, [page, activeSearch, fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    setActiveSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by email or provider ID (exact match)..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>Search</Button>
        {activeSearch && (
          <Button variant="ghost" onClick={() => { setSearchInput(''); setActiveSearch(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              {mode === 'global' && <TableHead>Provider</TableHead>}
              {mode === 'global' && <TableHead>Created</TableHead>}
              {mode === 'project' && <TableHead>Role</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={mode === 'global' ? 5 : 4} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={mode === 'global' ? 5 : 4} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              data?.users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-sm">{user.email}</TableCell>
                  <TableCell>{user.name ?? '—'}</TableCell>
                  {mode === 'global' && (
                    <TableCell>
                      {user.provider ? <Badge variant="outline">{user.provider}</Badge> : '—'}
                    </TableCell>
                  )}
                  {mode === 'global' && (
                    <TableCell className="text-muted-foreground text-sm">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </TableCell>
                  )}
                  {mode === 'project' && (
                    <TableCell>
                      <Badge variant="secondary">member</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => { setDrawerUserId(user.id); setDrawerUserEmail(user.email); }}>
                      View Roles
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} of {data.total} users
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Role Drawer */}
      {drawerUserId && (
        <RoleDrawer
          apiBasePath={apiBasePath}
          mode={mode}
          userId={drawerUserId}
          userEmail={drawerUserEmail}
          open={!!drawerUserId}
          onClose={() => { setDrawerUserId(null); setDrawerUserEmail(''); fetchUsers(page, activeSearch); }}
        />
      )}
    </div>
  );
}
