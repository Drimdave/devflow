import { Node } from "reactflow";
import { ProNodeData } from "./nodes/ProNode";
import { X, Settings2, Trash2, Save, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/Toast";

interface NodeConfigPanelProps {
    node: Node<ProNodeData> | null;
    onClose: () => void;
    onUpdateNode: (id: string, data: Partial<ProNodeData>) => void;
    onDeleteNode: (id: string) => void;
}

export default function NodeConfigPanel({ node, onClose, onUpdateNode, onDeleteNode }: NodeConfigPanelProps) {
    const [label, setLabel] = useState("");
    const [description, setDescription] = useState("");
    const [config, setConfig] = useState<Record<string, any>>({});

    // Sync state when selected node changes
    useEffect(() => {
        if (node) {
            setLabel(node.data.label || "");
            setDescription(node.data.description || "");
            setConfig(node.data.config ? { ...node.data.config } : {});
        }
    }, [node]);

    if (!node) return null;

    const handleSave = () => {
        onUpdateNode(node.id, {
            ...node.data,
            label,
            description,
            config,
        });
        showToast("Node settings saved", "success");
    };

    const updateConfigField = (key: string, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const removeConfigField = (key: string) => {
        setConfig(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const handleAddField = () => {
        const key = window.prompt("Enter new field name (e.g. 'timeout', 'headers'):");
        if (key && key.trim()) {
            const safeKey = key.trim().replace(/\s+/g, '_').toLowerCase();
            if (!config[safeKey]) {
                updateConfigField(safeKey, "");
            } else {
                showToast("Field already exists", "error");
            }
        }
    };

    return (
        <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-card border-l border-border shadow-2xl flex flex-col z-30 animate-in slide-in-from-right-8 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Node Settings</h3>
                </div>
                <button
                    onClick={onClose}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            Node Name
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                            placeholder="e.g. Fetch Users"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                            placeholder="What does this node do?"
                        />
                    </div>
                </div>

                {/* Configuration Fields */}
                <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                            Configuration
                        </label>
                    </div>

                    {Object.keys(config).length === 0 ? (
                        <div className="text-center py-4 bg-muted/30 rounded-md border border-dashed border-border flex items-center justify-center">
                            <button
                                onClick={handleAddField}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add first field
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(config).map(([key, value]) => (
                                <div key={key} className="group relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-medium text-muted-foreground capitalize">
                                            {key.replace(/_/g, ' ')}
                                        </label>
                                        <button
                                            onClick={() => removeConfigField(key)}
                                            className="text-muted-foreground/0 group-hover:text-red-500/70 hover:!text-red-500 transition-all"
                                            title="Remove Field"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        onChange={(e) => updateConfigField(key, e.target.value)}
                                        className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors font-mono text-[13px]"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {Object.keys(config).length > 0 && (
                        <button
                            onClick={handleAddField}
                            className="w-full mt-2 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Field
                        </button>
                    )}
                </div>

                {/* System Info */}
                <div className="pt-4 border-t border-border/50">
                    <div className="flex justify-between text-[11px] text-muted-foreground/70">
                        <span>Node Type: <span className="uppercase text-muted-foreground">{node.data.type}</span></span>
                        <span>ID: {node.id.substring(0, 8)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between gap-2">
                <button
                    onClick={() => onDeleteNode(node.id)}
                    className="flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    title="Delete Node"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 flex items-center gap-1.5 shadow-sm bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
