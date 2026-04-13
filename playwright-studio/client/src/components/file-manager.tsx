"use client";

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
    Folder,
    File,
    Home,
    FolderPlus,
    ChevronDownIcon,
    ChevronRightIcon,
    FileTextIcon,
    MoreHorizontalIcon,
    XIcon,
    Edit3Icon,
    FolderOpenIcon,
    DownloadIcon,
    EyeIcon,
    GitBranchIcon,
    UserIcon,
    FolderPlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import Editor, { DiffEditor } from "@monaco-editor/react";

import FileManagerPagination from "./pagination";
import { apiClient } from "@/services/api-client";

export type FileItem = any;

export interface FileManagerProps {
    basePath?: string;
    title?: string;
    actions?: React.ReactNode;
    /** Called when user requests to run tests for a specific file/folder path */
    onRunFile?: (relativePath: string) => void;
    /** Called whenever the set of selected files changes */
    onSelectionChange?: (paths: string[]) => void;
}

function getFileIcon(iconType: string, size: "sm" | "md" = "sm") {
    const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
    switch (iconType) {
        case "folder":
            return <Folder className={cn(dim, "text-yellow-500")} />;
        case "figma":
            return <div className={cn("flex items-center justify-center rounded bg-purple-500 text-white font-bold", size === "sm" ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs")}>F</div>;
        case "pdf":
            return <div className={cn("flex items-center justify-center rounded bg-red-600 text-white", size === "sm" ? "h-4 w-4" : "h-5 w-5")}><FileTextIcon className={size === "sm" ? "size-2.5" : "size-3"} /></div>;
        default:
            return <File className={cn(dim, "text-gray-400")} />;
    }
}

// ── Left-pane tree item ──
interface TreeItemProps {
    item: FileItem;
    depth: number;
    pathSegments: string[];
    BASE: string;
    projectId: string;
    navigate: (path: string) => void;
    setSelectedFile: (f: FileItem) => void;
    refreshTrigger?: number;
}

function LeftTreeItem({ item, depth, pathSegments, BASE, projectId, navigate, setSelectedFile, refreshTrigger = 0 }: TreeItemProps) {
    const isFolder = item.type === "folder";
    const isExpanded = pathSegments[depth] === item.name;
    const isActive = pathSegments.length - 1 === depth && pathSegments[depth] === item.name;

    const [children, setChildren] = useState<FileItem[]>(item.children || []);
    const [loading, setLoading] = useState(false);
    const prevRefreshRef = useRef(refreshTrigger);

    useEffect(() => {
        const needsRefresh = prevRefreshRef.current !== refreshTrigger;
        if (isFolder && isExpanded && (children.length === 0 || needsRefresh) && !loading) {
            setLoading(true);
            apiClient.getProjectFiles(projectId, item.id || item.name)
                .then(data => {
                    setChildren(data);
                    prevRefreshRef.current = refreshTrigger;
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isExpanded, projectId, item.id, item.name, refreshTrigger]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            // If clicking the current path folder, we can treat it as toggle or navigate.
            // Right now it acts as navigate-in for Explorer.
            const targetPath = depth === 0 ? item.name : `${pathSegments.slice(0, depth).join("/")}/${item.name}`;
            navigate(`${BASE}/${targetPath}`);
        } else {
            setSelectedFile(item);
        }
    };

    return (
        <div>
            <div
                className={cn(
                    "group flex items-center gap-1.5 py-1 cursor-pointer rounded-sm text-xs transition-colors select-none",
                    "hover:bg-muted/60",
                    isActive && "bg-accent text-accent-foreground font-medium"
                )}
                style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: "8px" }}
                onClick={handleClick}
            >
                {isFolder ? (
                    isExpanded
                        ? <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                        : <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                    <span className="w-3 shrink-0" />
                )}
                {loading ? <span className="animate-spin h-3 w-3 shrink-0 border-2 border-primary border-t-transparent rounded-full" /> : <span className="shrink-0">{getFileIcon(item.icon)}</span>}
                <span className="truncate">{item.name}</span>
            </div>
            {isFolder && isExpanded &&
                children.map((child: FileItem) => (
                    <LeftTreeItem
                        key={child.id}
                        item={child}
                        depth={depth + 1}
                        pathSegments={pathSegments}
                        BASE={BASE}
                        projectId={projectId}
                        navigate={navigate}
                        setSelectedFile={setSelectedFile}
                        refreshTrigger={refreshTrigger}
                    />
                ))
            }
        </div>
    );
}

type SortOption = "name" | "date" | "size";
type SortDirection = "asc" | "desc";

export function FileManager({ basePath = "", title = "File Manager", actions, onRunFile, onSelectionChange }: FileManagerProps) {
    const navigate = useNavigate();
    const params = useParams();
    const splatPath: string = (params as any)["*"] || "";
    const projectId = params.id || "";

    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // Sync selections back to parent
    useEffect(() => {
        if (onSelectionChange) {
            onSelectionChange(Array.from(selectedItems));
        }
    }, [selectedItems, onSelectionChange]);
    const [isEditing, setIsEditing] = useState(false);
    const [isViewingMode, setIsViewingMode] = useState(false);
    const [isReviewingDiff, setIsReviewingDiff] = useState(false);
    const [originalContent, setOriginalContent] = useState("");
    const [currentContent, setCurrentContent] = useState("");
    const editorRef = useRef<any>(null);

    const currentPath = splatPath;
    const pathSegments = currentPath ? currentPath.split("/").filter(Boolean) : [];
    const BASE = basePath || `/app/project/${projectId}/specs`;

    const handleEditorDidMount = (editor: any) => { editorRef.current = editor; };
    const handleFormat = () => { editorRef.current?.getAction("editor.action.formatDocument")?.run(); };
    const isMobile = useIsMobile();

    // ── API State ────────────────────────────────────────────────────────────
    const [rootItems, setRootItems] = useState<FileItem[]>([]);
    const [currentFolderItems, setCurrentFolderItems] = useState<FileItem[]>([]);
    const [loadingRoot, setLoadingRoot] = useState(true);
    const [loadingFolder, setLoadingFolder] = useState(false);

    // Fetch root directory items
    useEffect(() => {
        if (!projectId) return;
        setLoadingRoot(true);
        apiClient.getProjectFiles(projectId)
            .then(data => setRootItems(data))
            .catch(err => console.error(err))
            .finally(() => setLoadingRoot(false));
    }, [projectId, refreshTrigger]);

    // Fetch dynamic path items for right pane
    useEffect(() => {
        if (!projectId) return;
        setLoadingFolder(true);
        const folderPath = pathSegments.join("/");
        apiClient.getProjectFiles(projectId, folderPath)
            .then(data => setCurrentFolderItems(data))
            .catch(err => console.error(err))
            .finally(() => setLoadingFolder(false));

        setSelectedFile(null);
        setIsEditing(false);
    }, [currentPath, projectId, refreshTrigger]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const parseFileSize = (s: string) => {
        const n = Number.parseFloat(s);
        if (s.includes("GB")) return n * 1073741824;
        if (s.includes("MB")) return n * 1048576;
        if (s.includes("KB")) return n * 1024;
        return n;
    };

    const parseDate = (d: string) => {
        const [day, month, year] = d.split(".");
        return new Date(2000 + +year, +month - 1, +day).getTime();
    };

    const sortItems = (items: FileItem[]) =>
        [...items].sort((a, b) => {
            let cmp = 0;
            if (sortBy === "name") cmp = a.name.localeCompare(b.name);
            else if (sortBy === "date") cmp = parseDate(a.date) - parseDate(b.date);
            else cmp = parseFileSize(a.size) - parseFileSize(b.size);
            return sortDirection === "asc" ? cmp : -cmp;
        });

    const sortedCurrentItems = sortItems(currentFolderItems);

    const handleSortChange = (opt: SortOption) => {
        if (sortBy === opt) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        else { setSortBy(opt); setSortDirection("asc"); }
    };

    const handleItemClick = (item: FileItem) => {
        if (item.type === "folder") {
            const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            navigate(`${BASE}/${newPath}`);
        } else {
            setSelectedFile(item);
        }
    };

    const handleBreadcrumbClick = (index: number) => {
        if (index === -1) navigate(BASE);
        else navigate(`${BASE}/${pathSegments.slice(0, index + 1).join("/")}`);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === sortedCurrentItems.length && sortedCurrentItems.length > 0)
            setSelectedItems(new Set());
        else setSelectedItems(new Set(sortedCurrentItems.map((i) => i.id)));
    };

    const toggleItemSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(selectedItems);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedItems(next);
    };

    const [isLoadingEditor, setIsLoadingEditor] = useState(false);
    const [projectRepoUrl, setProjectRepoUrl] = useState<string | null>(null);

    // Commit message dialog state
    const [commitDialogOpen, setCommitDialogOpen] = useState(false);
    const [commitMessage, setCommitMessage] = useState("");
    const [gitPushStatus, setGitPushStatus] = useState<{ pushed: boolean; error?: string } | null>(null);

    // Folder creation state
    const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        const parentPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
        setCreatingFolder(true);
        try {
            await apiClient.createFolder(projectId, parentPath);
            setNewFolderDialogOpen(false);
            setNewFolderName("");
            setRefreshTrigger(t => t + 1);
        } catch (e) {
            console.error("Failed to create folder", e);
        } finally {
            setCreatingFolder(false);
        }
    };

    // Fetch project Git config
    useEffect(() => {
        if (!projectId) return;
        apiClient.getProjects().then((projects: any[]) => {
            const proj = projects.find((p: any) => p.id === projectId);
            setProjectRepoUrl(proj?.repoUrl ?? null);
        }).catch(() => {});
    }, [projectId]);

    const openEditor = async (item: FileItem) => {
        setSelectedFile(item);
        setIsEditing(true);
        setIsViewingMode(false);
        setIsLoadingEditor(true);
        
        try {
            const data = await apiClient.getFileContent(projectId, item.id);
            setOriginalContent(data.content);
            setCurrentContent(data.content);
        } catch (e) {
            console.error("Failed to load file content", e);
            setOriginalContent("// Failed to load content");
            setCurrentContent("// Failed to load content");
        }
        
        setIsReviewingDiff(false);
        setGitPushStatus(null);
        setIsLoadingEditor(false);
    };

    const openViewer = async (item: FileItem) => {
        setSelectedFile(item);
        setIsEditing(true);
        setIsViewingMode(true);
        setIsLoadingEditor(true);
        
        try {
            const data = await apiClient.getFileContent(projectId, item.id);
            setOriginalContent(data.content);
            setCurrentContent(data.content);
        } catch (e) {
            console.error("Failed to load file content", e);
            setOriginalContent("// Failed to load content");
            setCurrentContent("// Failed to load content");
        }
        
        setIsReviewingDiff(false);
        setGitPushStatus(null);
        setIsLoadingEditor(false);
    };

    const FileDetailPanel = ({ item }: { item: FileItem }) => (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <span className="text-sm font-semibold truncate pr-2">{item.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedFile(null)}>
                    <XIcon className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-5">
                    <div className="flex flex-col items-center pt-2 pb-1 gap-4">
                        <div className="scale-[2.5] mt-1">{getFileIcon(item.icon, "md")}</div>
                        <div className="flex items-center gap-2 w-full mt-2">
                            {item.type !== "folder" ? (
                                <>
                                    <Button size="sm" className="flex-1" variant="outline" onClick={() => openViewer(item)}>
                                        <EyeIcon className="w-3.5 h-3.5 mr-1.5" /> View
                                    </Button>
                                    <Button size="sm" className="flex-1" onClick={() => openEditor(item)}>
                                        <Edit3Icon className="w-3.5 h-3.5 mr-1.5" /> Edit
                                    </Button>
                                </>
                            ) : (
                                <Button size="sm" className="flex-1" onClick={() => handleItemClick(item)}>
                                    <FolderOpenIcon className="w-3.5 h-3.5 mr-1.5" /> Open
                                </Button>
                            )}
                            <Button size="sm" variant="outline" className="px-2.5">
                                <DownloadIcon className="w-3.5 h-3.5" />
                            </Button>
                            {/* Hidden for now
                            <Button size="sm" variant="outline" className="px-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
                                <Trash2Icon className="w-3.5 h-3.5" />
                            </Button>
                            */}
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Info</p>
                        <div className="space-y-2.5 text-sm">
                            {([
                                ["Type", <span className="capitalize">{item.type}</span>],
                                ["Size", item.size ?? "--"],
                                ["Owner", item.owner?.name ?? "—"],
                                ["Location", currentPath ? `/${currentPath}` : "/"],
                                ["Modified", item.date ?? "—"],
                            ] as [string, React.ReactNode][]).map(([label, val]) => (
                                <div key={label} className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground shrink-0">{label}</span>
                                    <span className="text-foreground text-right truncate text-xs">{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Settings section hidden for now */}
                    {/* <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Settings</p>
                        <div className="space-y-3">
                            {([["File Sharing", true], ["Backup", false], ["Sync", false]] as [string, boolean][]).map(
                                ([label, def]) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-sm">{label}</span>
                                        <Switch defaultChecked={def} />
                                    </div>
                                )
                            )}
                        </div>
                    </div> */}
                </div>
            </div>
        </div>
    );

    if (isEditing && selectedFile) {
        const doSave = async (msg?: string) => {
            try {
                const result = await apiClient.updateFileContent(projectId, selectedFile.id, currentContent, msg);
                setOriginalContent(currentContent);
                setIsReviewingDiff(false);
                setIsEditing(false);
                if (result?.gitPushed !== undefined) {
                    setGitPushStatus({ pushed: result.gitPushed, error: result.gitError });
                    setTimeout(() => setGitPushStatus(null), 5000);
                }
            } catch (e) {
                console.error("Failed to save", e);
                alert("Failed to save file");
            }
        };

        const handleConfirmSave = () => {
            if (projectRepoUrl) {
                setCommitMessage("");
                setCommitDialogOpen(true);
            } else {
                doSave();
            }
        };

        if (isReviewingDiff) {
            return (
                <>
                    <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[500px] w-full bg-background rounded-lg border shadow-sm">
                        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
                            <div className="flex items-center gap-3">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsReviewingDiff(false)}>
                                    <XIcon className="h-4 w-4" />
                                </Button>
                                <h2 className="text-sm font-semibold">Review Changes: {selectedFile.name}</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button size="sm" variant="ghost" onClick={() => { setIsReviewingDiff(false); setIsEditing(false); }}>Cancel</Button>
                                <Button size="sm" onClick={handleConfirmSave}>
                                    {projectRepoUrl ? <><GitBranchIcon className="h-3.5 w-3.5 mr-1.5" />Save & Push</> : "Confirm Save"}
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
                            <DiffEditor height="100%" language={selectedFile.name.endsWith(".ts") ? "typescript" : "javascript"} original={originalContent} modified={currentContent} theme="vs-dark" options={{ renderSideBySide: true, minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }} />
                        </div>
                    </div>
                    <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Push to Git</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                                <Label htmlFor="commit-msg" className="text-xs font-bold uppercase text-zinc-400">Commit Message</Label>
                                <Input
                                    id="commit-msg"
                                    placeholder="e.g. Update test spec"
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => { setCommitDialogOpen(false); doSave(); }}>
                                    Save Locally Only
                                </Button>
                                <Button disabled={!commitMessage.trim()} onClick={() => { setCommitDialogOpen(false); doSave(commitMessage.trim()); }}>
                                    <GitBranchIcon className="h-3.5 w-3.5 mr-1.5" /> Save & Push
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            );
        }

        return (
            <>
                <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[500px] w-full bg-background rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                                <XIcon className="h-4 w-4" />
                            </Button>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold truncate">
                                    {isViewingMode ? "Viewing: " : "Editing: "}{selectedFile.name}
                                </span>
                                <span className="text-xs text-muted-foreground">{currentPath ? `/${currentPath}` : "/"}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {gitPushStatus && (
                                <span className={cn("text-xs font-medium", gitPushStatus.pushed ? "text-green-500" : "text-zinc-400")}>
                                    {gitPushStatus.pushed ? "✓ Pushed to Git" : gitPushStatus.error ? `Git: ${gitPushStatus.error}` : "Saved locally"}
                                </span>
                            )}
                            <Button variant="outline" size="sm" onClick={handleFormat}>Format</Button>
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Close</Button>
                            {!isViewingMode && (
                                <Button size="sm" onClick={() => setIsReviewingDiff(true)}>Save</Button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden bg-[#1e1e1e]">
                        {isLoadingEditor ? (
                            <div className="flex items-center justify-center h-full text-zinc-500">Loading editor...</div>
                        ) : (
                            <Editor height="100%" defaultLanguage={selectedFile.name.endsWith(".ts") ? "typescript" : "javascript"} value={currentContent} onChange={(val) => setCurrentContent(val || "")} onMount={handleEditorDidMount} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 }, readOnly: isViewingMode }} />
                        )}
                    </div>
                </div>
                <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Push to Git</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <Label htmlFor="commit-msg" className="text-xs font-bold uppercase text-zinc-400">Commit Message</Label>
                            <Input
                                id="commit-msg"
                                placeholder="e.g. Update test spec"
                                value={commitMessage}
                                onChange={(e) => setCommitMessage(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => { setCommitDialogOpen(false); doSave(); }}>
                                Save Locally Only
                            </Button>
                            <Button disabled={!commitMessage.trim()} onClick={() => { setCommitDialogOpen(false); doSave(commitMessage.trim()); }}>
                                <GitBranchIcon className="h-3.5 w-3.5 mr-1.5" /> Save & Push
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    const sortLabel = (opt: SortOption) => {
        if (sortBy !== opt) return opt === "name" ? "Name" : opt === "date" ? "Date" : "Size";
        return `${opt === "name" ? "Name" : opt === "date" ? "Date" : "Size"} ${sortDirection === "asc" ? "↑" : "↓"}`;
    };

    return (
        <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <h1 className="font-bold tracking-tight text-sm whitespace-nowrap">{title}</h1>
                    {pathSegments.length > 0 && (
                        <>
                            <Separator orientation="vertical" className="h-4" />
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem className="cursor-pointer" onClick={() => handleBreadcrumbClick(-1)}>
                                        <Home className="h-3.5 w-3.5" />
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator />
                                    {pathSegments.map((seg, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                            <BreadcrumbItem className="cursor-pointer text-xs" onClick={() => handleBreadcrumbClick(i)}>
                                                {seg}
                                            </BreadcrumbItem>
                                            {i < pathSegments.length - 1 && <BreadcrumbSeparator />}
                                        </span>
                                    ))}
                                </BreadcrumbList>
                            </Breadcrumb>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {selectedItems.size === 1 && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs font-semibold" 
                            onClick={() => {
                                const id = Array.from(selectedItems)[0];
                                const item = sortedCurrentItems.find(i => i.id === id) || rootItems.find(i => i.id === id);
                                if (item && item.type === 'file') openViewer(item);
                            }}
                        >
                            <EyeIcon className="mr-2 h-3.5 w-3.5" /> View Spec
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-semibold"
                        onClick={() => { setNewFolderName(""); setNewFolderDialogOpen(true); }}
                    >
                        <FolderPlusIcon className="mr-2 h-3.5 w-3.5" /> New Folder
                    </Button>
                    {actions}
                </div>
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
                {!isMobile && (
                    <ResizablePanel id="left-pane" defaultSize={20} minSize={10} className="flex flex-col bg-muted/5 min-w-0">
                        <div className="px-3 py-2 border-b">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                Explorer
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto py-1.5 px-1 min-w-0">
                            {!loadingRoot && rootItems.map((item: FileItem) => (
                                <LeftTreeItem
                                    key={item.id}
                                    item={item}
                                    depth={0}
                                    pathSegments={pathSegments}
                                    BASE={BASE}
                                    projectId={projectId}
                                    navigate={navigate}
                                    setSelectedFile={setSelectedFile}
                                    refreshTrigger={refreshTrigger}
                                />
                            ))}
                            {loadingRoot && (
                                <div className="p-4 flex flex-col items-center justify-center opacity-50 space-y-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    <span className="text-xs">Loading tree...</span>
                                </div>
                            )}
                        </div>
                    </ResizablePanel>
                )}

                {!isMobile && <ResizableHandle withHandle id="pane-handle" />}

                <ResizablePanel id="right-pane" defaultSize={isMobile ? 100 : 80} minSize={10} className="flex flex-col relative overflow-hidden bg-background min-w-0">
                    <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/10 shrink-0 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                checked={selectedItems.size === sortedCurrentItems.length && sortedCurrentItems.length > 0}
                                onCheckedChange={toggleSelectAll}
                                className="h-3.5 w-3.5"
                            />
                            <span
                                className="cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleSortChange("name")}
                            >
                                {sortLabel("name")}
                            </span>
                        </div>
                        <div className="hidden lg:flex items-center gap-4">
                            <span className="cursor-pointer hover:text-foreground w-16 text-right" onClick={() => handleSortChange("date")}>{sortLabel("date")}</span>
                            <span className="cursor-pointer hover:text-foreground w-14 text-right" onClick={() => handleSortChange("size")}>{sortLabel("size")}</span>
                            <span className="w-6" /><span className="w-8" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative min-w-0">
                        <div className={cn(
                            "h-full overflow-y-auto transition-[margin] duration-200 min-w-0",
                            selectedFile && !isMobile ? "mr-72" : ""
                        )}>
                            {loadingFolder && (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground opacity-50">
                                    <span className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                    <p className="text-sm">Loading folder contents...</p>
                                </div>
                            )}

                            {!loadingFolder && sortedCurrentItems.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                                    <FolderPlus className="size-10 opacity-30" />
                                    <p className="text-sm">This folder is empty</p>
                                    {/* Upload hidden for now
                                    <Button size="sm" variant="outline">
                                        <UploadIcon className="h-3.5 w-3.5 mr-1.5" /> Upload
                                    </Button>
                                    */}
                                </div>
                            )}

                            {!loadingFolder && sortedCurrentItems.map((item: FileItem) => (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "flex cursor-pointer items-center justify-between border-b px-4 py-2.5 text-sm transition-colors",
                                        "hover:bg-muted/50",
                                        selectedFile?.id === item.id && "bg-accent/40"
                                    )}
                                    onClick={() => handleItemClick(item)}
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Checkbox
                                            checked={selectedItems.has(item.id)}
                                            onClick={(e) => toggleItemSelection(item.id, e as React.MouseEvent)}
                                            className="h-3.5 w-3.5 shrink-0"
                                        />
                                        <span className="shrink-0">{getFileIcon(item.icon)}</span>
                                        <span className="truncate">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-muted-foreground">
                                        <span className="hidden lg:block w-16 text-right text-xs">{item.date}</span>
                                        <span className="hidden lg:block w-14 text-right text-xs">{item.size}</span>
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={item.owner?.avatar} />
                                            <AvatarFallback className="bg-zinc-800">
                                                <UserIcon className="h-3 w-3 text-zinc-400" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreHorizontalIcon className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditor(item); }}>
                                                    <span className="font-semibold text-primary">Edit File</span>
                                                </DropdownMenuItem>
                                                {onRunFile && item.type === 'file' && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRunFile(item.id); }}>
                                                            <span className="text-green-500 font-medium">▶ Run Tests</span>
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {onRunFile && item.type === 'folder' && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRunFile(item.id); }}>
                                                            <span className="text-green-500 font-medium">▶ Run Folder Tests</span>
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem>Compress</DropdownMenuItem>
                                                <DropdownMenuItem>Archive</DropdownMenuItem>
                                                <DropdownMenuItem>Share</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem>Move</DropdownMenuItem>
                                                <DropdownMenuItem>Copy</DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600!">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}

                            {pathSegments.length === 0 && sortedCurrentItems.length > 0 && (
                                <div className="mt-4 px-4">
                                    <FileManagerPagination />
                                </div>
                            )}
                        </div>

                        {selectedFile && !isMobile && (
                            <div className="absolute top-0 right-0 h-full w-72 border-l bg-background shadow-xl animate-in slide-in-from-right duration-200 overflow-hidden">
                                <FileDetailPanel item={selectedFile} />
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>

            {selectedFile && isMobile && (
                <Sheet open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Details</SheetTitle>
                        </SheetHeader>
                        <FileDetailPanel item={selectedFile} />
                    </SheetContent>
                </Sheet>
            )}

            <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>New Folder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label className="text-xs font-bold uppercase text-zinc-400">
                            Folder name
                            {currentPath && <span className="ml-2 font-normal text-zinc-500 normal-case">in /{currentPath}</span>}
                        </Label>
                        <Input
                            placeholder="e.g. auth-tests"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>Cancel</Button>
                        <Button disabled={!newFolderName.trim() || creatingFolder} onClick={handleCreateFolder}>
                            {creatingFolder ? "Creating..." : "Create Folder"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}