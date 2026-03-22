"use client";

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
    Folder,
    File,
    Home,
    UploadIcon,
    FolderPlus,
    ChevronDownIcon,
    FileTextIcon,
    MoreHorizontalIcon,
    XIcon,
    Edit3Icon,
    FolderOpenIcon,
    Trash2Icon,
    DownloadIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Editor, { DiffEditor } from "@monaco-editor/react";

import FileManagerPagination from "./pagination";

export type FileItem = any;

export interface FileManagerProps {
    files: FileItem[];
    basePath?: string;
    title?: string;
    actions?: React.ReactNode;
}

function getFileIcon(iconType: string) {
    switch (iconType) {
        case "folder":
            return <Folder className="h-5 w-5 text-yellow-600" />;
        case "figma":
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-purple-500 text-xs font-bold text-white">
                    F
                </div>
            );
        case "sketch":
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-yellow-500 text-xs font-bold text-white">
                    S
                </div>
            );
        case "word":
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
                    W
                </div>
            );
        case "illustrator":
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-orange-600 text-xs font-bold text-white">
                    Ai
                </div>
            );
        case "photoshop":
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-800 text-xs font-bold text-white">
                    Ps
                </div>
            );
        case "pdf":
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
                    <FileTextIcon className="size-3" />
                </div>
            );
        case "audio":
            return (
                <div className="flex h-5 w-5 items-center justify-center rounded bg-green-600 text-xs font-bold text-white">
                    ♪
                </div>
            );
        default:
            return <File className="h-5 w-5 text-gray-500" />;
    }
}

type SortOption = "name" | "date" | "size";
type SortDirection = "asc" | "desc";

export function FileManager({ files = [], basePath = "", title = "File Manager", actions }: FileManagerProps) {
    const navigate = useNavigate();
    const params = useParams();
    // '*' captures everything after the matched route, e.g. "login-flow/subfolder/file.ts"
    const splatPath: string = (params as any)["*"] || "";
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
    const [showMobileDetails, setShowMobileDetails] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isEditing, setIsEditing] = useState(false);
    const [isReviewingDiff, setIsReviewingDiff] = useState(false);
    const [originalContent, setOriginalContent] = useState("");
    const [currentContent, setCurrentContent] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const editorRef = useRef<any>(null);

    const currentPath = splatPath;  // e.g. "login-flow" or "login-flow/subfolder"
    const pathSegments = currentPath ? currentPath.split("/").filter(Boolean) : [];

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;
    };

    const handleFormat = () => {
        editorRef.current?.getAction('editor.action.formatDocument')?.run();
    };

    const isMobile = useIsMobile();

    const parseFileSize = (sizeStr: string): number => {
        const size = Number.parseFloat(sizeStr);
        if (sizeStr.includes("GB")) return size * 1024 * 1024 * 1024;
        if (sizeStr.includes("MB")) return size * 1024 * 1024;
        if (sizeStr.includes("KB")) return size * 1024;
        return size;
    };

    const parseDate = (dateStr: string): number => {
        const [day, month, year] = dateStr.split(".");
        return new Date(
            2000 + Number.parseInt(year),
            Number.parseInt(month) - 1,
            Number.parseInt(day)
        ).getTime();
    };

    const sortItems = (items: FileItem[]): FileItem[] => {
        return [...items].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "date":
                    comparison = parseDate(a.date) - parseDate(b.date);
                    break;
                case "size":
                    comparison = parseFileSize(a.size) - parseFileSize(b.size);
                    break;
            }

            return sortDirection === "asc" ? comparison : -comparison;
        });
    };

    const getCurrentFolderItems = () => {
        if (!currentPath) {
            return files.filter((item: any) => !item.parentPath);
        }

        const parentFolder = files.find(
            (item: any) => item.name === pathSegments[pathSegments.length - 1]
        );
        return parentFolder?.children || [];
    };

    const currentItems = getCurrentFolderItems();
    const filteredItems = currentItems.filter((item: any) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const sortedAndFilteredItems = sortItems(filteredItems);

    useEffect(() => {
        setSelectedItem(null);
        setShowMobileDetails(false);
        setIsEditing(false);
    }, [currentPath]);

    const handleSortChange = (option: SortOption) => {
        if (sortBy === option) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortBy(option);
            setSortDirection("asc");
        }
    };

    const getSortLabel = () => {
        const directionIcon = sortDirection === "asc" ? "↑" : "↓";
        switch (sortBy) {
            case "name":
                return `Name ${directionIcon}`;
            case "date":
                return `Date ${directionIcon}`;
            case "size":
                return `Size ${directionIcon}`;
        }
    };

    const handleItemClick = (item: FileItem) => {
        if (item.type === "folder") {
            const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            navigate(`${basePath || "/app/project/1/specs"}/${newPath}`);
        } else {
            setSelectedItem(item);
            setShowMobileDetails(true);
        }
    };

    const handleBreadcrumbClick = (index: number) => {
        if (index === -1) {
            // go back to the base specs route
            navigate(basePath || "/app/project/1/specs");
        } else {
            const newPath = pathSegments.slice(0, index + 1).join("/");
            navigate(`${basePath || "/app/project/1/specs"}/${newPath}`);
        }
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === sortedAndFilteredItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(sortedAndFilteredItems.map((item) => item.id)));
        }
    };

    const toggleItemSelection = (itemId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const newSelectedItems = new Set(selectedItems);
        if (newSelectedItems.has(itemId)) {
            newSelectedItems.delete(itemId);
        } else {
            newSelectedItems.add(itemId);
        }
        setSelectedItems(newSelectedItems);
    };

    const FileDetailContent = ({ selectedItem }: { selectedItem: FileItem }) => {
        return (
            <div className="space-y-6 px-4">
                <div className="flex flex-col items-center py-4">
                    <div className="flex items-center mb-8 mt-2">
                        <div className="scale-[3]">{getFileIcon(selectedItem.icon)}</div>
                    </div>
                    <h2 className="text-foreground text-center font-bold mb-4">{selectedItem.name}</h2>

                    <div className="flex items-center justify-center gap-2 w-full mb-2">
                        {selectedItem.type !== "folder" ? (
                            <Button size="sm" variant="default" className="flex-1" onClick={() => {
                                const initialCode = `// Editing ${selectedItem.name}\n\n`;
                                setOriginalContent(initialCode);
                                setCurrentContent(initialCode);
                                setIsReviewingDiff(false);
                                setSaveMessage("");
                                setIsEditing(true);
                            }}>
                                <Edit3Icon className="w-4 h-4 mr-2" /> Edit
                            </Button>
                        ) : (
                            <Button size="sm" variant="default" className="flex-1" onClick={() => {
                                const newPath = currentPath ? `${currentPath}/${selectedItem.name}` : selectedItem.name;
                                navigate(`${basePath || "/app/project/1/specs"}/${newPath}`);
                            }}>
                                <FolderOpenIcon className="w-4 h-4 mr-2" /> Open
                            </Button>
                        )}
                        <Button size="sm" variant="outline" className="px-3" title="Download">
                            <DownloadIcon className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700" title="Delete">
                            <Trash2Icon className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div>
                    <h3 className="text-foreground mb-4 font-semibold tracking-wider uppercase">
                        Info
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <span className="text-foreground capitalize">{selectedItem.type}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Size</span>
                            <span className="text-foreground">{selectedItem.size}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Owner</span>
                            <span className="text-foreground">ArtTemplate</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Location</span>
                            <span>
                                {currentPath ? `My Files/${currentPath}` : "My Files"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Modified</span>
                            <span className="text-foreground">Sep 17, 2020 4:25</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span className="text-foreground">Sep 10, 2020 2:25</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-foreground mb-4 font-semibold tracking-wider uppercase">
                        Settings
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-foreground">File Sharing</span>
                            <Switch checked={true} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-foreground">Backup</span>
                            <Switch />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-foreground">Sync</span>
                            <Switch />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (isEditing && selectedItem) {
        if (isReviewingDiff) {
            return (
                <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[500px] w-full bg-background rounded-lg border shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsReviewingDiff(false)}>
                                <XIcon className="h-4 w-4" />
                            </Button>
                            <h2 className="text-sm font-semibold">Review Changes: {selectedItem.name}</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <Input
                                value={saveMessage}
                                onChange={(e) => setSaveMessage(e.target.value)}
                                placeholder="Commit message (Optional)..."
                                className="h-8 w-64 text-sm"
                            />
                            <Button size="sm" onClick={() => {
                                setIsReviewingDiff(false);
                                setIsEditing(false);
                            }}>Cancel</Button>
                            <Button size="sm" onClick={() => {
                                setIsReviewingDiff(false);
                                setIsEditing(false);
                            }}>Confirm Save</Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden bg-[#1e1e1e] relative">
                        <DiffEditor
                            height="100%"
                            language={selectedItem.name.endsWith('.ts') ? 'typescript' : 'javascript'}
                            original={originalContent}
                            modified={currentContent}
                            theme="vs-dark"
                            options={{
                                renderSideBySide: true,
                                minimap: { enabled: false },
                                fontSize: 14,
                                padding: { top: 16 },
                            }}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[500px] w-full bg-background rounded-lg border shadow-sm">
                <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsEditing(false)}>
                            <XIcon className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold truncate">{selectedItem.name}</span>
                            <span className="text-xs text-muted-foreground truncate">{currentPath ? `My Files/${currentPath}` : "My Files"}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleFormat}>Format</Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Close</Button>
                        <Button size="sm" onClick={() => setIsReviewingDiff(true)}>Save</Button>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden bg-[#1e1e1e] relative">
                    <Editor
                        height="100%"
                        defaultLanguage={selectedItem.name.endsWith('.ts') ? 'typescript' : 'javascript'}
                        value={currentContent}
                        onChange={(val) => setCurrentContent(val || "")}
                        onMount={handleEditorDidMount}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            padding: { top: 16 },
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex p-4">
            <div className="border-border min-w-0 flex-1 space-y-4">
                {/* Breadcrumb Navigation */}
                <div className="flex justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold tracking-tight">{title}</h1>
                        {pathSegments.length > 0 && (
                            <>
                                <Separator
                                    orientation="vertical"
                                    className="mx-2 data-[orientation=vertical]:h-4"
                                />
                                <div className="border-border/50 bg-muted/20 flex items-center overflow-x-auto">
                                    <Breadcrumb>
                                        <BreadcrumbList>
                                            <BreadcrumbItem
                                                className="cursor-pointer"
                                                onClick={() => handleBreadcrumbClick(-1)}>
                                                <Home className="h-4 w-4" />
                                            </BreadcrumbItem>
                                            <BreadcrumbSeparator />
                                            {pathSegments.map((segment, i) => (
                                                <>
                                                    <BreadcrumbItem
                                                        className="cursor-pointer"
                                                        key={i}
                                                        onClick={() => handleBreadcrumbClick(i)}>
                                                        {segment}
                                                    </BreadcrumbItem>
                                                    {i < pathSegments.length - 1 && <BreadcrumbSeparator />}
                                                </>
                                            ))}
                                        </BreadcrumbList>
                                    </Breadcrumb>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="border-border flex items-center justify-between gap-2">
                        {actions}
                    </div>
                </div>

                <div className="flex border-t">
                    {/* File List */}
                    <div className="min-w-0 grow">
                        {sortedAndFilteredItems.map((item) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "hover:bg-muted flex cursor-pointer items-center justify-between border-b px-4 py-2.5 text-sm",
                                    selectedItem?.id === item.id && "bg-muted"
                                )}
                                onClick={() => handleItemClick(item)}>
                                <div className="flex min-w-0 items-center space-x-4">
                                    <Checkbox
                                        defaultChecked={selectedItem?.id === item.id}
                                        checked={selectedItems.has(item.id)}
                                        onClick={(e) => toggleItemSelection(item.id, e)}
                                    />
                                    <div className="shrink-0">{getFileIcon(item.icon)}</div>
                                    <div className="min-w-0 truncate">{item.name}</div>
                                </div>

                                <div className="text-muted-foreground flex items-center space-x-4">
                                    <span className="hidden w-16 text-right lg:inline">{item.date}</span>
                                    <span className="hidden w-16 text-right lg:inline">{item.size}</span>
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={item.owner.avatar || "/placeholder.svg"} />
                                        <AvatarFallback className="text-xs">{item.owner.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontalIcon />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                                setSelectedItem(item);
                                                const initialCode = `// Editing ${item.name}\n\n`;
                                                setOriginalContent(initialCode);
                                                setCurrentContent(initialCode);
                                                setIsReviewingDiff(false);
                                                setSaveMessage("");
                                                setIsEditing(true);
                                            }}>
                                                <span className="font-semibold text-primary">Edit File</span>
                                            </DropdownMenuItem>
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

                        {sortedAndFilteredItems.length === 0 && searchQuery && (
                            <div className="text-muted-foreground flex items-center justify-center p-8 text-center">
                                No files or folders found matching &#34;{searchQuery}&#34;
                            </div>
                        )}

                        {sortedAndFilteredItems.length === 0 && !searchQuery && currentPath && (
                            <div className="flex h-[calc(100vh-var(--header-height)-3rem)] flex-col items-center justify-center">
                                <div className="mx-auto max-w-md space-y-4 text-center">
                                    <FolderPlus className="mx-auto size-14 opacity-50" />
                                    <h2 className="text-muted-foreground">This folder is empty.</h2>
                                    <div>
                                        <Button>
                                            <UploadIcon />
                                            Upload
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {pathSegments.length === 0 && (
                            <div className="mt-4">
                                <FileManagerPagination />
                            </div>
                        )}
                    </div>

                    {/* Desktop Right Panel - Details */}
                    {selectedItem && !isMobile ? (
                        <div className="relative w-80 border-s py-6">
                            <Button
                                onClick={() => setSelectedItem(null)}
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-0">
                                <XIcon />
                            </Button>
                            <FileDetailContent selectedItem={selectedItem} />
                        </div>
                    ) : null}
                </div>
            </div>

            {selectedItem && isMobile && (
                <Sheet open={showMobileDetails} onOpenChange={setShowMobileDetails}>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>File Details</SheetTitle>
                        </SheetHeader>
                        <FileDetailContent selectedItem={selectedItem} />
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
}