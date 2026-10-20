import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StickyNote,
  Network,
  KeyRound,
  Plus,
  Trash2,
  Pin,
  Search,
  CheckSquare,
  Square,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  Star,
  RefreshCw,
  ShieldCheck,
  GitBranch,
  Check,
  FolderKanban,
  Lock,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Quote,
  Minus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layout,
  Share2,
  FileText,
  Sliders,
  Flame,
  Target,
  Download,
  ChevronDown,
  MoveUp,
  MoveDown,
  GripVertical,
  Timer,
  ThumbsUp,
  Undo2,
  Redo2,
  Cloud,
  Type,
  Play,
  Pause,
  HelpCircle,
  Layers,
  PenTool,
  ArrowRight,
  ChevronUp,
  Smile,
  Rocket,
  Menu,
  ListTree,
  Folder,
  FolderPlus,
  FolderOpen,
  ArrowLeft,
  Octagon,
  Diamond,
  Circle,
  Hexagon,
  Link2,
  Unlink,
  MousePointer,
  Edit2,
  X,
  Printer,
  FileDown,
  Image as ImageIcon,
  FileUp,
  Save,
  Grid,
  Unlock,
  Scan,
  Hand,
  Heart,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';

export type BlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'callout'
  | 'quote'
  | 'code'
  | 'divider';

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  icon?: string;
  color?: string;
}

function parseContentToBlocks(raw: string): NoteBlock[] {
  if (!raw || !raw.trim()) {
    return [{ id: 'b_1', type: 'text', content: '' }];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type) {
      return parsed;
    }
  } catch {}

  // Parse legacy plain text / markdown into structured blocks
  const lines = raw.split('\n');
  const blocks: NoteBlock[] = [];
  lines.forEach((line, idx) => {
    const id = `b_leg_${idx}_${Date.now()}`;
    if (line.startsWith('# ')) {
      blocks.push({ id, type: 'h1', content: line.slice(2) });
    } else if (line.startsWith('## ')) {
      blocks.push({ id, type: 'h2', content: line.slice(3) });
    } else if (line.startsWith('### ')) {
      blocks.push({ id, type: 'h3', content: line.slice(4) });
    } else if (line.startsWith('[ ] ') || line.startsWith('[x] ')) {
      blocks.push({ id, type: 'todo', content: line.slice(4), checked: line.startsWith('[x] ') });
    } else if (line.startsWith('• ') || line.startsWith('- ')) {
      blocks.push({ id, type: 'bullet', content: line.replace(/^[•-]\s*/, '') });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ id, type: 'numbered', content: line.replace(/^\d+\.\s*/, '') });
    } else if (line.startsWith('> 💡 ') || line.startsWith('> ')) {
      blocks.push({ id, type: 'callout', content: line.replace(/^>\s*(💡\s*)?/, ''), icon: '💡' });
    } else if (line.startsWith('> ')) {
      blocks.push({ id, type: 'quote', content: line.slice(2) });
    } else if (line.trim() === '---') {
      blocks.push({ id, type: 'divider', content: '' });
    } else {
      blocks.push({ id, type: 'text', content: line });
    }
  });
  return blocks.length > 0 ? blocks : [{ id: 'b_1', type: 'text', content: '' }];
}

function serializeBlocksToText(blocks: NoteBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h1':
          return `# ${b.content}`;
        case 'h2':
          return `## ${b.content}`;
        case 'h3':
          return `### ${b.content}`;
        case 'todo':
          return `[${b.checked ? 'x' : ' '}] ${b.content}`;
        case 'bullet':
          return `• ${b.content}`;
        case 'numbered':
          return `1. ${b.content}`;
        case 'callout':
          return `> ${b.icon || '💡'} ${b.content}`;
        case 'quote':
          return `> ${b.content}`;
        case 'code':
          return `\`\`\`\n${b.content}\n\`\`\``;
        case 'divider':
          return `---`;
        default:
          return b.content;
      }
    })
    .join('\n');
}

const CALLOUT_EMOJIS = ['💡', '🔥', '⚠️', '📌', '🎯', '⭐', '🚀', '✅'];

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string;
  icon?: string;
  cover?: string;
  pinned: boolean;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export type LucidShapeType =
  | 'cloud'
  | 'capsule'
  | 'octagon'
  | 'diamond'
  | 'sticky'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'frame'
  | 'image'
  | 'drawing'
  | 'stamp';

export interface NodeConnection {
  targetId: string;
  label?: string;
}

export interface MindmapNode {
  id: string;
  label: string;
  parentId?: string | null;
  connections?: NodeConnection[];
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  icon?: string;
  notes?: string;
  shape?: LucidShapeType;
  lineLabel?: string;
  locked?: boolean;
  zIndex?: number;
  groupId?: string;
  imageUrl?: string;
  fontSize?: number;
  pathData?: string;
  strokeWidth?: number;
}

export interface BoardEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  color?: string;
}

export function getBoardEdges(nodes: MindmapNode[]): BoardEdge[] {
  const edges: BoardEdge[] = [];
  if (!Array.isArray(nodes)) return edges;
  const edgeSet = new Set<string>();

  nodes.forEach((node) => {
    // 1. Conexões livres M:N explícitas
    if (node.connections && Array.isArray(node.connections)) {
      node.connections.forEach((conn, idx) => {
        const key = `${node.id}->${conn.targetId}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({
            id: `edge_${node.id}_${conn.targetId}_${idx}`,
            sourceId: node.id,
            targetId: conn.targetId,
            label: conn.label || '',
            color: node.color,
          });
        }
      });
    }

    // 2. Conexões herdadas via parentId (retrocompatibilidade)
    if (node.parentId) {
      const key = `${node.parentId}->${node.id}`;
      const revKey = `${node.id}->${node.parentId}`;
      if (!edgeSet.has(key) && !edgeSet.has(revKey)) {
        edgeSet.add(key);
        edges.push({
          id: `edge_leg_${node.parentId}_${node.id}`,
          sourceId: node.parentId,
          targetId: node.id,
          label: node.lineLabel || '',
          color: node.color,
        });
      }
    }
  });

  return edges;
}

export const LUCID_FAN_PALETTES = [
  {
    name: 'Purples & Pinks',
    colors: ['#5b21b6', '#7c3aed', '#8b5cf6', '#a855f7', '#c084fc', '#d946ef', '#f472b6', '#fbcfe8'],
  },
  {
    name: 'Reds & Yellows',
    colors: ['#b91c1c', '#dc2626', '#ea580c', '#f97316', '#fb923c', '#f59e0b', '#facc15', '#fef08a'],
  },
  {
    name: 'Teals & Blues',
    colors: ['#047857', '#10b981', '#14b8a6', '#06b6d4', '#0284c7', '#2563eb', '#3b82f6', '#93c5fa'],
  },
  {
    name: 'Earth & Grays',
    colors: ['#57534e', '#78716c', '#a8a29e', '#1e293b', '#334155', '#64748b', '#94a3b8', '#f8fafc'],
  },
];

export const LUCID_SHAPES: { type: LucidShapeType; label: string; desc: string }[] = [
  { type: 'sticky', label: 'Post-it', desc: 'Nota rápida adesiva colorida' },
  { type: 'rectangle', label: 'Cartão', desc: 'Bloco estruturado' },
  { type: 'circle', label: 'Círculo', desc: 'Início ou fim de fluxo' },
  { type: 'cloud', label: 'Nuvem', desc: 'Ideia central e pensamentos' },
  { type: 'capsule', label: 'Cápsula', desc: 'Conceito e objetivos' },
  { type: 'diamond', label: 'Losango', desc: 'Decisão ou dilema' },
  { type: 'octagon', label: 'Octógono', desc: 'Questão crítica ou parada' },
  { type: 'text', label: 'Texto Livre', desc: 'Texto limpo sem moldura' },
  { type: 'frame', label: 'Área / Frame', desc: 'Agrupador de seção com título' },
];

interface MindmapBoard {
  id: string;
  title: string;
  description: string;
  nodes: MindmapNode[];
  theme?: string;
  connectorStyle?: 'curved' | 'straight' | 'elbow';
  createdAt: string;
  updatedAt: string;
}

interface VaultItem {
  id: string;
  title: string;
  category: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTE_CATEGORIES = [
  { id: 'ideias', label: 'Ideias', color: '#a855f7' },
  { id: 'financas', label: 'Finanças', color: '#10b981' },
  { id: 'projetos', label: 'Projetos', color: '#38bdf8' },
  { id: 'estudos', label: 'Estudos', color: '#f59e0b' },
  { id: 'pessoal', label: 'Pessoal', color: '#ec4899' },
];

const NOTE_ICONS = ['📝', '💡', '🚀', '💰', '🎯', '🧠', '🔥', '⭐', '📊', '⚡', '📚', '🛠️', '✨'];

const NOTE_COVERS = [
  { id: 'cov_purple', label: 'Roxo Cyber', class: 'from-purple-900/60 via-fuchsia-900/30 to-transparent' },
  { id: 'cov_emerald', label: 'Esmeralda', class: 'from-emerald-900/60 via-teal-900/30 to-transparent' },
  { id: 'cov_cyan', label: 'Oceano', class: 'from-cyan-900/60 via-blue-900/30 to-transparent' },
  { id: 'cov_amber', label: 'Pôr do Sol', class: 'from-amber-900/60 via-orange-900/30 to-transparent' },
  { id: 'cov_rose', label: 'Rosa Neon', class: 'from-rose-900/60 via-pink-900/30 to-transparent' },
];

const VAULT_CATEGORIES = [
  { id: 'bancos', label: 'Bancos e Corretoras', color: '#10b981' },
  { id: 'cartoes', label: 'Cartões e Aplicativos', color: '#8b5cf6' },
  { id: 'redes_sociais', label: 'Redes Sociais', color: '#38bdf8' },
  { id: 'trabalho', label: 'Trabalho e Negócios', color: '#f59e0b' },
  { id: 'email', label: 'E-mails e Acessos', color: '#ec4899' },
  { id: 'outros', label: 'Outros Registros', color: '#94a3b8' },
];

const NODE_COLORS = ['#a855f7', '#10b981', '#38bdf8', '#f59e0b', '#ec4899', '#ef4444', '#6366f1', '#14b8a6'];

const ToolsViewInner: React.FC = () => {
  const { currentView, setCurrentView, showToast, refreshGame } = useFinancial();

  const activeTool: 'notes' | 'mindmap' | 'vault' =
    currentView === 'tools_mindmap'
      ? 'mindmap'
      : currentView === 'tools_vault'
      ? 'vault'
      : 'notes';

  // =========================================================
  // 1. ANOTAÇÕES ESTILO NOTION
  // =========================================================
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState('');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<string>('all');
  const [newCheckItemText, setNewCheckItemText] = useState('');

  // =========================================================
  // 2. QUADRO VISUAL INTERATIVO ESTILO LUCIDSPARK
  // =========================================================
  const [mindmaps, setMindmaps] = useState<MindmapBoard[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [newMapTitle, setNewMapTitle] = useState('');
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [connectorStyle, setConnectorStyle] = useState<'curved' | 'straight' | 'elbow'>('curved');
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Estados de navegação por pastas e documentos (Hub inicial estilo Lucidspark)
  const [lucidViewMode, setLucidViewMode] = useState<'folders' | 'canvas'>('folders');
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [folders, setFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pigo_lucid_folders');
      return saved ? JSON.parse(saved) : ['Geral', 'Estratégia', 'Finanças', 'Projetos', 'Estudos'];
    } catch {
      return ['Geral', 'Estratégia', 'Finanças', 'Projetos', 'Estudos'];
    }
  });
  const [folderSearch, setFolderSearch] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderModalOpen, setNewFolderModalOpen] = useState<boolean>(false);

  // Estados de conexões livres entre nós
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Estados específicos estilo Lucidspark
  const [lucidStickyDrawerOpen, setLucidStickyDrawerOpen] = useState(false);
  const [lucidShapesMenuOpen, setLucidShapesMenuOpen] = useState(false);
  const [lucidActiveColor, setLucidActiveColor] = useState<string>('#6366f1');
  const [lucidStickyInput, setLucidStickyInput] = useState<string>('');
  const [lucidBatchInput, setLucidBatchInput] = useState<string>('');
  const [lucidBatchModalOpen, setLucidBatchModalOpen] = useState<boolean>(false);
  const [lucidOutlineOpen, setLucidOutlineOpen] = useState<boolean>(false);
  const [lucidTimerOpen, setLucidTimerOpen] = useState<boolean>(false);
  const [lucidTimerSeconds, setLucidTimerSeconds] = useState<number>(300); // 5 min
  const [lucidTimerActive, setLucidTimerActive] = useState<boolean>(false);

  // Novos Estados: Seleção Múltipla, Histórico (Undo/Redo), Clipboard & Grid Snap
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [clipboardNodes, setClipboardNodes] = useState<MindmapNode[] | null>(null);
  const [undoStack, setUndoStack] = useState<MindmapNode[][]>([]);
  const [redoStack, setRedoStack] = useState<MindmapNode[][]>([]);
  const [gridSnap, setGridSnap] = useState<boolean>(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados da Barra de Ferramentas de Quadro Branco (Whiteboard Lucidspark)
  const [whiteboardTool, setWhiteboardTool] = useState<
    'select' | 'pan' | 'sticky' | 'shape' | 'text' | 'pen' | 'line' | 'frame' | 'stamp'
  >('select');
  const [penColor, setPenColor] = useState<string>('#6366f1');
  const [penWidth, setPenWidth] = useState<number>(3);
  const [penDrawerOpen, setPenDrawerOpen] = useState<boolean>(false);
  const [currentDrawingPath, setCurrentDrawingPath] = useState<{ x: number; y: number }[] | null>(null);
  const [stampDrawerOpen, setStampDrawerOpen] = useState<boolean>(false);
  const [activeStampType, setActiveStampType] = useState<
    'star' | 'check' | 'flame' | 'bulb' | 'heart' | 'alert'
  >('star');
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // =========================================================
  // 3. COFRE DE SENHAS CRIPTOGRAFADO
  // =========================================================
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultCategoryFilter, setVaultCategoryFilter] = useState<string>('all');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [editingVault, setEditingVault] = useState<Partial<VaultItem> | null>(null);

  const loadAllTools = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const [loadedNotes, loadedMaps, loadedVault] = await Promise.all([
        window.electronAPI.getNotes ? window.electronAPI.getNotes() : [],
        window.electronAPI.getMindmaps ? window.electronAPI.getMindmaps() : [],
        window.electronAPI.getVaultItems ? window.electronAPI.getVaultItems() : [],
      ]);
      setNotes(loadedNotes || []);
      if (loadedNotes?.length > 0 && !selectedNoteId) {
        setSelectedNoteId(loadedNotes[0].id);
      }
      setMindmaps(loadedMaps || []);
      if (loadedMaps?.length > 0 && !selectedMapId) {
        setSelectedMapId(loadedMaps[0].id);
      }
      setVaultItems(loadedVault || []);
    } catch (err) {
      console.error('Erro ao carregar ferramentas:', err);
    }
  }, [selectedNoteId, selectedMapId]);

  useEffect(() => {
    loadAllTools();
  }, [loadAllTools]);

  // --- NOTION-STYLE NOTES HANDLERS ---
  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  const handleCreateNote = async () => {
    if (!window.electronAPI?.createNote) return;
    const created = await window.electronAPI.createNote({
      title: 'Sem Título',
      content: JSON.stringify([{ id: `b_${Date.now()}_1`, type: 'text', content: '' }]),
      category: noteCategoryFilter !== 'all' ? noteCategoryFilter : 'ideias',
      color: '#a855f7',
      icon: '💡',
      cover: NOTE_COVERS[0].class,
      pinned: false,
      checklist: [],
    });
    const updated = await window.electronAPI.getNotes();
    setNotes(updated);
    if (created?.id) setSelectedNoteId(created.id);
    await refreshGame();
    showToast('Nova página criada no Segundo Cérebro!', 'success');
  };

  const handleUpdateNote = async (id: string, patch: Partial<NoteItem>) => {
    if (!window.electronAPI?.updateNote) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    await window.electronAPI.updateNote(id, patch);
    await refreshGame();
  };

  const handleDeleteNote = async (id: string) => {
    if (!window.electronAPI?.deleteNote) return;
    await window.electronAPI.deleteNote(id);
    const updated = await window.electronAPI.getNotes();
    setNotes(updated);
    setSelectedNoteId(updated[0]?.id || null);
    showToast('Anotação removida.', 'info');
  };

  const currentBlocks: NoteBlock[] = selectedNote
    ? parseContentToBlocks(selectedNote.content)
    : [];

  const handleUpdateBlocks = (nextBlocks: NoteBlock[]) => {
    if (!selectedNote) return;
    handleUpdateNote(selectedNote.id, { content: JSON.stringify(nextBlocks) });
  };

  const handleBlockChange = (blockId: string, patch: Partial<NoteBlock>) => {
    const next = currentBlocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
    handleUpdateBlocks(next);
  };

  const handleAddBlockBelow = (afterId?: string, type: BlockType = 'text') => {
    const newBlock: NoteBlock = {
      id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type,
      content: '',
      checked: false,
      icon: type === 'callout' ? '💡' : undefined,
    };
    if (!afterId) {
      handleUpdateBlocks([...currentBlocks, newBlock]);
      return newBlock.id;
    }
    const idx = currentBlocks.findIndex((b) => b.id === afterId);
    if (idx === -1) {
      handleUpdateBlocks([...currentBlocks, newBlock]);
    } else {
      const next = [...currentBlocks];
      next.splice(idx + 1, 0, newBlock);
      handleUpdateBlocks(next);
    }
    return newBlock.id;
  };

  const handleRemoveBlock = (blockId: string) => {
    if (currentBlocks.length <= 1) {
      handleBlockChange(blockId, { content: '', type: 'text' });
      return;
    }
    const next = currentBlocks.filter((b) => b.id !== blockId);
    handleUpdateBlocks(next);
  };

  const handleMoveBlock = (blockId: string, dir: 'up' | 'down') => {
    const idx = currentBlocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentBlocks.length) return;
    const next = [...currentBlocks];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    handleUpdateBlocks(next);
  };

  const handleChangeBlockType = (blockId: string, type: BlockType) => {
    handleBlockChange(blockId, {
      type,
      icon: type === 'callout' ? '💡' : undefined,
      checked: type === 'todo' ? false : undefined,
    });
  };

  const handleAddChecklistItem = async () => {
    if (!selectedNote || !newCheckItemText.trim()) return;
    const nextList: ChecklistItem[] = [
      ...(selectedNote.checklist || []),
      { id: `chk_${Date.now()}`, text: newCheckItemText.trim(), done: false },
    ];
    setNewCheckItemText('');
    await handleUpdateNote(selectedNote.id, { checklist: nextList });
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    if (!selectedNote) return;
    const nextList = (selectedNote.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    await handleUpdateNote(selectedNote.id, { checklist: nextList });
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    if (!selectedNote) return;
    const nextList = (selectedNote.checklist || []).filter((item) => item.id !== itemId);
    await handleUpdateNote(selectedNote.id, { checklist: nextList });
  };

  // --- MINDMASTER MINDMAP HANDLERS ---
  const selectedMap = mindmaps.find((m) => m.id === selectedMapId) || null;
  const selectedNode =
    selectedMap?.nodes.find((n) => n.id === selectedNodeId) ||
    selectedMap?.nodes[0] ||
    null;

  const saveMapNodes = async (
    mapId: string,
    nextNodes: MindmapNode[],
    nextTitle?: string,
    recordHistory: boolean = true
  ) => {
    if (recordHistory && selectedMap) {
      setUndoStack((prev) => [...prev.slice(-30), selectedMap.nodes]);
      setRedoStack([]);
    }

    setMindmaps((prev) =>
      prev.map((m) =>
        m.id === mapId
          ? { ...m, nodes: nextNodes, title: nextTitle !== undefined ? nextTitle : m.title }
          : m
      )
    );

    if (window.electronAPI?.updateMindmap) {
      await window.electronAPI.updateMindmap(mapId, {
        nodes: nextNodes,
        ...(nextTitle !== undefined ? { title: nextTitle } : {}),
      });
    }
    await refreshGame();
  };

  const handleUndo = () => {
    if (!selectedMap || undoStack.length === 0) {
      showToast('Nenhuma ação para desfazer.', 'info');
      return;
    }
    const prevNodes = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, selectedMap.nodes]);
    saveMapNodes(selectedMap.id, prevNodes, undefined, false);
    showToast('Ação desfeita (Ctrl+Z).', 'info');
  };

  const handleRedo = () => {
    if (!selectedMap || redoStack.length === 0) {
      showToast('Nenhuma ação para refazer.', 'info');
      return;
    }
    const nextNodes = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, selectedMap.nodes]);
    saveMapNodes(selectedMap.id, nextNodes, undefined, false);
    showToast('Ação refeita (Ctrl+Y).', 'info');
  };

  // Timer countdown do Lucidspark
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (lucidTimerActive && lucidTimerSeconds > 0) {
      interval = setInterval(() => {
        setLucidTimerSeconds((s) => {
          if (s <= 1) {
            setLucidTimerActive(false);
            showToast('⏱️ O tempo do Brainstorming no Lucidspark terminou!', 'info');
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lucidTimerActive, lucidTimerSeconds, showToast]);

  // Gestão de Pastas estilo Lucidspark
  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    if (folders.includes(trimmed)) {
      showToast('Esta pasta já existe.', 'info');
      return;
    }
    const next = [...folders, trimmed];
    setFolders(next);
    localStorage.setItem('pigo_lucid_folders', JSON.stringify(next));
    setActiveFolder(trimmed);
    setNewFolderName('');
    setNewFolderModalOpen(false);
    showToast(`Pasta "${trimmed}" criada!`, 'success');
  };

  const handleDeleteFolder = (folderName: string) => {
    if (folderName === 'Geral') {
      showToast('A pasta Geral é o repositório padrão e não pode ser removida.', 'info');
      return;
    }
    const next = folders.filter((f) => f !== folderName);
    setFolders(next);
    localStorage.setItem('pigo_lucid_folders', JSON.stringify(next));
    if (activeFolder === folderName) setActiveFolder('all');
    showToast(`Pasta "${folderName}" removida.`, 'info');
  };

  const handleCreateBoardInFolder = async (folderName?: string) => {
    if (!window.electronAPI?.createMindmap) return;
    const targetFolder = folderName || (activeFolder !== 'all' ? activeFolder : 'Geral');
    const title = `Quadro #${mindmaps.length + 1}`;
    const defaultNodes: MindmapNode[] = [
      { id: 'n1', label: 'Ideia Central', x: 500, y: 260, color: '#6366f1', shape: 'cloud', connections: [{ targetId: 'n2', label: 'Estratégia' }, { targetId: 'n3', label: 'Ação' }] },
      { id: 'n2', label: 'Estratégia Principal', x: 250, y: 150, color: '#8b5cf6', shape: 'capsule', connections: [] },
      { id: 'n3', label: 'Plano de Execução', x: 750, y: 150, color: '#0ea5e9', shape: 'capsule', connections: [] },
    ];

    const created = await window.electronAPI.createMindmap({
      title,
      description: targetFolder,
      nodes: defaultNodes,
    });
    const updated = await window.electronAPI.getMindmaps();
    setMindmaps(updated);
    if (created?.id) {
      setSelectedMapId(created.id);
      setSelectedNodeId('n1');
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setLucidViewMode('canvas');
    }
    await refreshGame();
    showToast(`Quadro criado na pasta "${targetFolder}"!`, 'success');
  };

  const handleDeleteMindmap = async (id: string) => {
    if (!window.electronAPI?.deleteMindmap) return;
    await window.electronAPI.deleteMindmap(id);
    const updated = await window.electronAPI.getMindmaps();
    setMindmaps(updated);
    setSelectedMapId(updated[0]?.id || null);
    showToast('Quadro excluído.', 'info');
  };

  // Conectar dois nós livremente (M:N Graph)
  const handleConnectNodes = (sourceId: string, targetId: string) => {
    if (!selectedMap || sourceId === targetId) return;
    const sourceNode = selectedMap.nodes.find((n) => n.id === sourceId);
    if (!sourceNode) return;

    const existing = (sourceNode.connections || []).some((c) => c.targetId === targetId);
    if (existing) {
      showToast('Esses elementos já estão conectados.', 'info');
      setConnectingFromNodeId(null);
      return;
    }

    const nextNodes = selectedMap.nodes.map((n) => {
      if (n.id === sourceId) {
        return {
          ...n,
          connections: [...(n.connections || []), { targetId, label: '' }],
        };
      }
      return n;
    });

    saveMapNodes(selectedMap.id, nextNodes);
    setConnectingFromNodeId(null);
    showToast('Conexão estabelecida com sucesso!', 'success');
  };

  // Remover conexão entre dois nós
  const handleDisconnect = (sourceId: string, targetId: string) => {
    if (!selectedMap || !Array.isArray(selectedMap.nodes)) return;
    const nextNodes = selectedMap.nodes.map((n) => {
      let updated = { ...n };
      if (n.id === sourceId) {
        updated.connections = (n.connections || []).filter((c) => c.targetId !== targetId);
        if (n.parentId === targetId) updated.parentId = null;
      }
      if (n.id === targetId) {
        updated.connections = (n.connections || []).filter((c) => c.targetId !== sourceId);
        if (n.parentId === sourceId) updated.parentId = null;
      }
      return updated;
    });
    saveMapNodes(selectedMap.id, nextNodes);
    setSelectedEdgeId(null);
    showToast('Conexão excluída com sucesso.', 'info');
  };

  // Atualizar rótulo de texto na linha de conexão
  const handleUpdateEdgeLabel = (sourceId: string, targetId: string, label: string) => {
    if (!selectedMap) return;
    const nextNodes = selectedMap.nodes.map((n) => {
      if (n.id === sourceId) {
        const conns = (n.connections || []).map((c) =>
          c.targetId === targetId ? { ...c, label } : c
        );
        return { ...n, connections: conns, lineLabel: n.parentId === targetId ? label : n.lineLabel };
      }
      if (n.id === targetId && n.parentId === sourceId) {
        return { ...n, lineLabel: label };
      }
      return n;
    });
    saveMapNodes(selectedMap.id, nextNodes);
  };

  // Criar Post-it na posição do clique
  const handleAddStickyAt = (clickX: number, clickY: number) => {
    if (!selectedMap) return;
    const newNode: MindmapNode = {
      id: `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: 'Nota adesiva',
      x: clickX,
      y: clickY,
      color: lucidActiveColor,
      shape: 'sticky',
      connections: [],
      notes: '',
    };
    saveMapNodes(selectedMap.id, [...selectedMap.nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds([newNode.id]);
    showToast('Post-it adicionado no quadro!', 'info');
  };

  // Criar Caixa de Texto Livre na posição do clique
  const handleAddTextAt = (clickX: number, clickY: number) => {
    if (!selectedMap) return;
    const newNode: MindmapNode = {
      id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: 'Digite seu texto...',
      x: clickX,
      y: clickY,
      color: '#f8fafc',
      shape: 'text',
      connections: [],
      notes: '',
    };
    saveMapNodes(selectedMap.id, [...selectedMap.nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds([newNode.id]);
    showToast('Texto livre adicionado!', 'info');
  };

  // Criar Forma Geométrica na posição do clique
  const handleAddShapeAt = (clickX: number, clickY: number, shape: LucidShapeType = 'rectangle') => {
    if (!selectedMap) return;
    const newNode: MindmapNode = {
      id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: shape === 'frame' ? 'Área de Trabalho' : 'Elemento',
      x: clickX,
      y: clickY,
      color: lucidActiveColor,
      shape,
      connections: [],
      notes: '',
    };
    saveMapNodes(selectedMap.id, [...selectedMap.nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds([newNode.id]);
    showToast(`Elemento (${shape}) adicionado!`, 'info');
  };

  // Carimbar Reação no Canvas
  const handleAddStampAt = (clickX: number, clickY: number) => {
    if (!selectedMap) return;
    const stampColors: Record<string, string> = {
      star: '#f59e0b',
      check: '#10b981',
      flame: '#ef4444',
      bulb: '#a855f7',
      heart: '#ec4899',
      alert: '#f97316',
    };
    const newNode: MindmapNode = {
      id: `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: activeStampType,
      x: clickX,
      y: clickY,
      color: stampColors[activeStampType] || '#f59e0b',
      shape: 'stamp',
      connections: [],
      notes: '',
    };
    saveMapNodes(selectedMap.id, [...selectedMap.nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setSelectedNodeIds([newNode.id]);
    showToast('Carimbo aplicado no quadro!', 'info');
  };

  // Criar elemento livremente ao dar clique duplo no canvas
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && (e.target as HTMLElement).tagName !== 'svg') return;
    if (!selectedMap || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = Math.round((e.clientX - rect.left - panOffset.x) / zoom);
    const clickY = Math.round((e.clientY - rect.top - panOffset.y) / zoom);

    handleAddStickyAt(clickX, clickY);
  };

  // Subtópico conectado
  const handleAddChildNode = (shape?: LucidShapeType) => {
    if (!selectedMap) return;
    const parent = selectedNode || selectedMap.nodes[0];
    if (!parent) return;

    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const newX = parent.x + 220 + (Math.random() * 40 - 20);
    const newY = parent.y + (Math.random() * 80 - 40);

    const newNode: MindmapNode = {
      id: newNodeId,
      label: 'Novo Tópico',
      x: newX,
      y: newY,
      color: lucidActiveColor || parent.color || '#6366f1',
      shape: shape || parent.shape || 'cloud',
      connections: [],
      notes: '',
    };

    const nextNodes = selectedMap.nodes.map((n) =>
      n.id === parent.id
        ? { ...n, connections: [...(n.connections || []), { targetId: newNodeId, label: '' }] }
        : n
    );

    saveMapNodes(selectedMap.id, [...nextNodes, newNode]);
    setSelectedNodeId(newNodeId);
  };

  const handleAddSiblingNode = () => {
    handleAddChildNode();
  };

  // Criar post-it do leque
  const handleAddStickyFromDrawer = () => {
    if (!selectedMap || !lucidStickyInput.trim()) return;
    const newNode: MindmapNode = {
      id: `sticky_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label: lucidStickyInput.trim(),
      x: (selectedNode ? selectedNode.x + 180 : 500) + (Math.random() * 40 - 20),
      y: (selectedNode ? selectedNode.y + 40 : 280) + (Math.random() * 40 - 20),
      color: lucidActiveColor,
      shape: 'sticky',
      connections: [],
      notes: '',
    };
    saveMapNodes(selectedMap.id, [...selectedMap.nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setLucidStickyInput('');
    showToast('Post-it adicionado ao quadro!', 'success');
  };

  // Criar em lote
  const handleBatchAddStickies = () => {
    if (!selectedMap || !lucidBatchInput.trim()) return;
    const lines = lucidBatchInput
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const startX = 260;
    const startY = 220;
    const perRow = 3;
    const newNodes: MindmapNode[] = lines.map((line, idx) => {
      const col = idx % perRow;
      const row = Math.floor(idx / perRow);
      return {
        id: `sticky_batch_${Date.now()}_${idx}`,
        label: line,
        x: startX + col * 170,
        y: startY + row * 150,
        color: lucidActiveColor,
        shape: 'sticky',
        connections: [],
        notes: '',
      };
    });

    saveMapNodes(selectedMap.id, [...selectedMap.nodes, ...newNodes]);
    setLucidBatchInput('');
    setLucidBatchModalOpen(false);
    showToast(`${newNodes.length} post-its adicionados em lote!`, 'success');
  };

  // Adicionar forma rápida
  const handleAddShape = (shape: LucidShapeType) => {
    if (!selectedMap) return;
    const newNode: MindmapNode = {
      id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      label:
        shape === 'cloud'
          ? 'Ideia Central'
          : shape === 'capsule'
          ? 'Objetivo'
          : shape === 'octagon'
          ? 'Alerta Crítico'
          : shape === 'diamond'
          ? 'Decisão'
          : 'Novo Bloco',
      x: (selectedNode ? selectedNode.x + 200 : 500) + (Math.random() * 40 - 20),
      y: (selectedNode ? selectedNode.y + 40 : 280) + (Math.random() * 60 - 30),
      color: lucidActiveColor,
      shape,
      connections: [],
      notes: '',
    };
    saveMapNodes(selectedMap.id, [...selectedMap.nodes, newNode]);
    setSelectedNodeId(newNode.id);
    setLucidShapesMenuOpen(false);
    showToast(`Forma "${shape}" adicionada!`, 'success');
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedMap || !selectedNode) return;
    if (selectedMap.nodes.length <= 1) {
      showToast('O quadro precisa conter pelo menos um nó.', 'info');
      return;
    }
    const nodeId = selectedNode.id;
    const nextNodes = selectedMap.nodes
      .filter((n) => n.id !== nodeId)
      .map((n) => ({
        ...n,
        connections: (n.connections || []).filter((c) => c.targetId !== nodeId),
        parentId: n.parentId === nodeId ? null : n.parentId,
      }));
    saveMapNodes(selectedMap.id, nextNodes);
    setSelectedNodeId(nextNodes[0]?.id || 'root');
  };

  const handleAutoLayout = () => {
    if (!selectedMap) return;
    const root = selectedMap.nodes.find((n) => n.parentId === null);
    if (!root) return;

    const rootX = 460;
    const rootY = 270;
    const children = selectedMap.nodes.filter((n) => n.parentId === root.id);
    const leftChildren = children.slice(0, Math.ceil(children.length / 2));
    const rightChildren = children.slice(Math.ceil(children.length / 2));

    const nextNodes: MindmapNode[] = selectedMap.nodes.map((n) => {
      if (n.id === root.id) return { ...n, x: rootX, y: rootY };
      return n;
    });

    const layoutBranch = (branchList: MindmapNode[], isLeft: boolean) => {
      const stepY = 110;
      const startY = rootY - ((branchList.length - 1) * stepY) / 2;
      branchList.forEach((child, idx) => {
        const cX = isLeft ? rootX - 250 : rootX + 250;
        const cY = startY + idx * stepY;
        const cNodeIdx = nextNodes.findIndex((x) => x.id === child.id);
        if (cNodeIdx !== -1) nextNodes[cNodeIdx] = { ...nextNodes[cNodeIdx], x: cX, y: cY };

        // Sub-filhos
        const subChildren = selectedMap.nodes.filter((x) => x.parentId === child.id);
        subChildren.forEach((sub, sIdx) => {
          const subX = isLeft ? cX - 220 : cX + 220;
          const subY = cY + (sIdx - (subChildren.length - 1) / 2) * 60;
          const sNodeIdx = nextNodes.findIndex((x) => x.id === sub.id);
          if (sNodeIdx !== -1) nextNodes[sNodeIdx] = { ...nextNodes[sNodeIdx], x: subX, y: subY };
        });
      });
    };

    layoutBranch(leftChildren, true);
    layoutBranch(rightChildren, false);
    saveMapNodes(selectedMap.id, nextNodes);
    showToast('Layout do mapa auto-organizado com sucesso!', 'success');
  };

  // Exportar Quadro em PDF de Alta Resolução / Impressão
  const handleExportPDF = () => {
    if (!selectedMap || !Array.isArray(selectedMap.nodes) || selectedMap.nodes.length === 0) {
      showToast('O quadro precisa ter ao menos um elemento para exportar.', 'info');
      return;
    }

    const nodes = selectedMap.nodes;
    const minX = Math.min(...nodes.map((n) => n.x)) - 100;
    const minY = Math.min(...nodes.map((n) => n.y)) - 100;
    const maxX = Math.max(...nodes.map((n) => n.x)) + 200;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 150;
    const width = Math.max(900, maxX - minX);
    const height = Math.max(600, maxY - minY);

    const edges = getBoardEdges(nodes);

    const edgesSvg = edges
      .map((edge) => {
        const source = nodes.find((n) => n.id === edge.sourceId);
        const target = nodes.find((n) => n.id === edge.targetId);
        if (!source || !target) return '';
        const sx = source.x - minX;
        const sy = source.y - minY;
        const tx = target.x - minX;
        const ty = target.y - minY;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        let d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
        if (connectorStyle === 'straight') d = `M ${sx} ${sy} L ${tx} ${ty}`;
        else if (connectorStyle === 'elbow') d = `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;

        const labelSvg = edge.label
          ? `<rect x="${mx - 50}" y="${my - 14}" width="100" height="22" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1" />
             <text x="${mx}" y="${my + 2}" text-anchor="middle" fill="#e2e8f0" font-size="10" font-family="system-ui, sans-serif" font-weight="bold">${edge.label}</text>`
          : '';

        return `
          <path d="${d}" stroke="${edge.color || '#6366f1'}" stroke-width="2.5" fill="none" stroke-linecap="round" />
          ${labelSvg}
        `;
      })
      .join('\n');

    const nodesSvg = nodes
      .map((node) => {
        const nx = node.x - minX;
        const ny = node.y - minY;
        const shape = node.shape || 'cloud';
        let shapeSvg = '';

        if (shape === 'drawing' && node.pathData) {
          return `<path d="${node.pathData}" stroke="${node.color || '#6366f1'}" stroke-width="${node.strokeWidth || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${-minX}, ${-minY})" />`;
        }

        if (shape === 'stamp') {
          return `
            <g transform="translate(${nx}, ${ny})">
              <circle r="20" fill="${node.color || '#f59e0b'}" />
              <text y="5" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold" font-family="system-ui, sans-serif">
                ${node.label === 'star' ? '★' : node.label === 'check' ? '✓' : node.label === 'flame' ? '▲' : '●'}
              </text>
            </g>
          `;
        }

        if (shape === 'sticky') {
          shapeSvg = `<rect x="${nx - 60}" y="${ny - 40}" width="120" height="80" rx="4" fill="${node.color}" />`;
        } else if (shape === 'capsule') {
          shapeSvg = `<rect x="${nx - 70}" y="${ny - 25}" width="140" height="50" rx="25" fill="${node.color}" />`;
        } else if (shape === 'diamond') {
          shapeSvg = `<polygon points="${nx},${ny - 35} ${nx + 65},${ny} ${nx},${ny + 35} ${nx - 65},${ny}" fill="${node.color}" />`;
        } else if (shape === 'octagon') {
          shapeSvg = `<polygon points="${nx - 35},${ny - 35} ${nx + 35},${ny - 35} ${nx + 65},${ny} ${nx + 35},${ny + 35} ${nx - 35},${ny + 35} ${nx - 65},${ny}" fill="${node.color}" />`;
        } else if (shape === 'rectangle') {
          shapeSvg = `<rect x="${nx - 65}" y="${ny - 30}" width="130" height="60" rx="10" fill="${node.color}" />`;
        } else {
          shapeSvg = `<rect x="${nx - 75}" y="${ny - 30}" width="150" height="60" rx="24" fill="${node.color}" />`;
        }

        return `
          <g>
            ${shapeSvg}
            <text x="${nx}" y="${ny + 4}" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="bold" font-family="system-ui, sans-serif">
              ${node.label}
            </text>
          </g>
        `;
      })
      .join('\n');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Permita popups para exportar o PDF.', 'info');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedMap.title} - Lucidspark PDF</title>
          <style>
            @page {
              size: landscape;
              margin: 1cm;
            }
            body {
              margin: 0;
              padding: 24px;
              background: #0b0c10;
              color: #ffffff;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .header-bar {
              width: 100%;
              max-width: ${width}px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid rgba(255,255,255,0.1);
              padding-bottom: 14px;
              margin-bottom: 20px;
            }
            .board-title {
              font-size: 22px;
              font-weight: 900;
              letter-spacing: -0.5px;
            }
            .board-meta {
              font-size: 11px;
              color: #94a3b8;
              margin-top: 4px;
            }
            svg {
              background: #0f172a;
              border: 1px solid rgba(255,255,255,0.12);
              border-radius: 20px;
              box-shadow: 0 12px 30px rgba(0,0,0,0.5);
              max-width: 100%;
              height: auto;
            }
            @media print {
              body {
                background: #ffffff !important;
                color: #0f172a !important;
                padding: 0;
              }
              .header-bar {
                border-bottom: 2px solid #e2e8f0;
              }
              .board-title {
                color: #0f172a !important;
              }
              .board-meta {
                color: #64748b !important;
              }
              svg {
                background: #f8fafc !important;
                border: 1px solid #cbd5e1;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="board-title">${selectedMap.title}</div>
              <div class="board-meta">Pasta: ${selectedMap.description || 'Geral'} • ${nodes.length} nós • ${edges.length} conexões</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; font-size: 13px;">PIGO Lucidspark</div>
              <div class="board-meta">${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dotgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,0.08)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotgrid)" />
            ${edgesSvg}
            ${nodesSvg}
          </svg>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast('Visualização de impressão aberta! Escolha "Salvar como PDF".', 'success');
  };

  // Exportar Quadro em Imagem PNG de Alta Resolução (HD / 2x Retina)
  const handleExportPNG = () => {
    if (!selectedMap || !Array.isArray(selectedMap.nodes) || selectedMap.nodes.length === 0) {
      showToast('O quadro precisa ter ao menos um elemento para exportar.', 'info');
      return;
    }
    const nodes = selectedMap.nodes;
    const minX = Math.min(...nodes.map((n) => n.x)) - 100;
    const minY = Math.min(...nodes.map((n) => n.y)) - 100;
    const maxX = Math.max(...nodes.map((n) => n.x + 160)) + 100;
    const maxY = Math.max(...nodes.map((n) => n.y + 100)) + 100;
    const width = Math.max(900, maxX - minX);
    const height = Math.max(600, maxY - minY);

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // Fundo sólido escuro de estúdio
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, width, height);

    // Grade de pontos suaves
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 0; x < width; x += 24) {
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Desenhar Conexões
    const edges = getBoardEdges(nodes);
    edges.forEach((edge) => {
      const source = nodes.find((n) => n.id === edge.sourceId);
      const target = nodes.find((n) => n.id === edge.targetId);
      if (!source || !target) return;
      const sx = source.x - minX;
      const sy = source.y - minY;
      const tx = target.x - minX;
      const ty = target.y - minY;
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;

      ctx.strokeStyle = edge.color || '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (connectorStyle === 'straight') {
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
      } else if (connectorStyle === 'elbow') {
        ctx.moveTo(sx, sy);
        ctx.lineTo(mx, sy);
        ctx.lineTo(mx, ty);
        ctx.lineTo(tx, ty);
      } else {
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(mx, sy, mx, ty, tx, ty);
      }
      ctx.stroke();

      // Seta indicativa no destino
      const angle = Math.atan2(ty - my, tx - mx);
      ctx.fillStyle = edge.color || '#6366f1';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 12 * Math.cos(angle - Math.PI / 7), ty - 12 * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(tx - 12 * Math.cos(angle + Math.PI / 7), ty - 12 * Math.sin(angle + Math.PI / 7));
      ctx.closePath();
      ctx.fill();

      // Rótulo da linha
      if (edge.label) {
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillStyle = '#1e293b';
        const tw = ctx.measureText(edge.label).width;
        ctx.fillRect(mx - tw / 2 - 8, my - 12, tw + 16, 20);
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.label, mx, my - 2);
      }
    });

    // Desenhar Nós
    nodes.forEach((node) => {
      const nx = node.x - minX;
      const ny = node.y - minY;
      const shape = node.shape || 'cloud';

      ctx.save();
      ctx.fillStyle = node.color || '#6366f1';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;

      if (shape === 'drawing' && node.pathData) {
        ctx.save();
        ctx.translate(-minX, -minY);
        ctx.strokeStyle = node.color || '#6366f1';
        ctx.lineWidth = node.strokeWidth || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const p2d = new Path2D(node.pathData);
        ctx.stroke(p2d);
        ctx.restore();
        return;
      } else if (shape === 'stamp') {
        ctx.save();
        ctx.fillStyle = node.color || '#f59e0b';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(nx - 22, ny - 22, 44, 44, 14);
        } else {
          ctx.arc(nx, ny, 22, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const iconSym =
          node.label === 'star' ? '★' : node.label === 'check' ? '✓' : node.label === 'flame' ? '▲' : '●';
        ctx.fillText(iconSym, nx, ny);
        ctx.restore();
        return;
      } else if (shape === 'frame') {
        ctx.strokeStyle = node.color || '#818cf8';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.4)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(nx - 120, ny - 90, 240, 180, 12);
        } else {
          ctx.rect(nx - 120, ny - 90, 240, 180);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = node.color || '#818cf8';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(node.label || 'Área', nx - 110, ny - 70);
        ctx.restore();
        return;
      } else if (shape === 'text') {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, nx, ny);
        ctx.restore();
        return;
      } else if (shape === 'sticky') {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(nx - 60, ny - 40, 120, 80, 6);
        else ctx.rect(nx - 60, ny - 40, 120, 80);
        ctx.fill();
      } else if (shape === 'capsule') {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(nx - 70, ny - 25, 140, 50, 25);
        else ctx.rect(nx - 70, ny - 25, 140, 50);
        ctx.fill();
      } else if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(nx, ny, 38, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(nx, ny - 36);
        ctx.lineTo(nx + 65, ny);
        ctx.lineTo(nx, ny + 36);
        ctx.lineTo(nx - 65, ny);
        ctx.closePath();
        ctx.fill();
      } else if (shape === 'octagon') {
        ctx.beginPath();
        ctx.moveTo(nx - 35, ny - 35);
        ctx.lineTo(nx + 35, ny - 35);
        ctx.lineTo(nx + 65, ny);
        ctx.lineTo(nx + 35, ny + 35);
        ctx.lineTo(nx - 35, ny + 35);
        ctx.lineTo(nx - 65, ny);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(nx - 75, ny - 30, 150, 60, 18);
        else ctx.rect(nx - 75, ny - 30, 150, 60);
        ctx.fill();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, nx, ny);
      ctx.restore();
    });

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${selectedMap.title.replace(/\s+/g, '_')}_lucidspark.png`;
    a.click();
    showToast('Imagem PNG de alta resolução exportada!', 'success');
  };

  // Salvar Como: Exporta o documento editável nativo do projeto (.pigo-board)
  const handleSaveAsProjectFile = () => {
    if (!selectedMap) return;
    const projectDoc = {
      app: 'Pigo Lucidspark Offline Builder',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      project: {
        id: selectedMap.id,
        title: selectedMap.title,
        description: selectedMap.description || 'Geral',
        connectorStyle,
        nodes: selectedMap.nodes,
      },
    };
    const jsonStr = JSON.stringify(projectDoc, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedMap.title.replace(/\s+/g, '_')}.pigo-board`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Projeto editável salvo localmente (.pigo-board)!', 'success');
  };

  // Abrir Projeto: Carrega um arquivo .pigo-board ou .json do computador
  const handleOpenProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const proj = parsed.project || parsed;
        if (!proj || !Array.isArray(proj.nodes)) {
          showToast('Formato de projeto inválido.', 'error');
          return;
        }

        const newId = `map_${Date.now()}`;
        const newTitle = proj.title || file.name.replace(/\.[^/.]+$/, '');
        const importedBoard: MindmapBoard = {
          id: newId,
          title: newTitle,
          description: proj.description || 'Geral',
          nodes: proj.nodes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (window.electronAPI?.createMindmap) {
          await window.electronAPI.createMindmap(importedBoard);
        }
        setMindmaps((prev) => [importedBoard, ...prev]);
        setSelectedMapId(newId);
        setLucidViewMode('canvas');
        showToast(`Projeto "${newTitle}" aberto com sucesso!`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Falha ao ler arquivo de projeto.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Importar Imagem Local do Computador (embutida em base64 para nunca quebrar)
  const handleImportLocalImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMap) return;

    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecione um arquivo de imagem válido (PNG, JPEG, WebP).', 'info');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const newNodeId = `img_${Date.now()}`;
      const newNode: MindmapNode = {
        id: newNodeId,
        label: file.name.replace(/\.[^/.]+$/, ''),
        shape: 'image',
        imageUrl: dataUrl,
        x: (selectedNode ? selectedNode.x + 180 : 450) + (Math.random() * 40 - 20),
        y: (selectedNode ? selectedNode.y + 40 : 250) + (Math.random() * 40 - 20),
        color: '#3b82f6',
        connections: [],
        notes: '',
      };

      saveMapNodes(selectedMap.id, [...selectedMap.nodes, newNode]);
      setSelectedNodeId(newNodeId);
      showToast('Imagem local incorporada ao projeto!', 'success');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Ajustar à Tela (Fit to Content / Zoom to Fit)
  const handleZoomToFit = () => {
    if (!selectedMap || !Array.isArray(selectedMap.nodes) || selectedMap.nodes.length === 0 || !canvasRef.current) return;
    const nodes = selectedMap.nodes;
    const minX = Math.min(...nodes.map((n) => n.x)) - 80;
    const minY = Math.min(...nodes.map((n) => n.y)) - 80;
    const maxX = Math.max(...nodes.map((n) => n.x + 160)) + 80;
    const maxY = Math.max(...nodes.map((n) => n.y + 100)) + 80;

    const contentWidth = Math.max(400, maxX - minX);
    const contentHeight = Math.max(300, maxY - minY);

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const newZoom = Math.min(1.2, Math.max(0.35, Math.min(scaleX, scaleY) * 0.9));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(Number(newZoom.toFixed(2)));
    setPanOffset({
      x: Math.round(rect.width / 2 - centerX * newZoom),
      y: Math.round(rect.height / 2 - centerY * newZoom),
    });
    showToast('Visualização ajustada para exibir todo o conteúdo.', 'info');
  };

  // Centralizar Câmera no Objeto Selecionado
  const handleCenterOnSelection = () => {
    if (!selectedNode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setZoom(1);
    setPanOffset({
      x: Math.round(rect.width / 2 - selectedNode.x),
      y: Math.round(rect.height / 2 - selectedNode.y),
    });
  };

  // Duplicar Elemento(s) Selecionado(s) (Ctrl+D)
  const handleDuplicate = () => {
    if (!selectedMap || !selectedNode) return;
    const targets = selectedNodeIds.length > 0
      ? selectedMap.nodes.filter((n) => selectedNodeIds.includes(n.id))
      : [selectedNode];

    const idMap = new Map<string, string>();
    targets.forEach((n) => {
      idMap.set(n.id, `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    });

    const cloned: MindmapNode[] = targets.map((n) => {
      const newId = idMap.get(n.id)!;
      const remapped = (n.connections || [])
        .filter((c) => idMap.has(c.targetId))
        .map((c) => ({ ...c, targetId: idMap.get(c.targetId)! }));
      return {
        ...n,
        id: newId,
        label: `${n.label} (Cópia)`,
        x: n.x + 40,
        y: n.y + 40,
        connections: remapped,
      };
    });

    saveMapNodes(selectedMap.id, [...selectedMap.nodes, ...cloned]);
    setSelectedNodeIds(cloned.map((c) => c.id));
    if (cloned.length > 0) setSelectedNodeId(cloned[0].id);
    showToast(`${cloned.length} elemento(s) duplicado(s)!`, 'info');
  };

  // Copiar & Colar (Ctrl+C / Ctrl+V)
  const handleCopy = () => {
    if (!selectedMap) return;
    const targets = selectedNodeIds.length > 0
      ? selectedMap.nodes.filter((n) => selectedNodeIds.includes(n.id))
      : selectedNode ? [selectedNode] : [];
    if (targets.length === 0) return;
    setClipboardNodes(targets);
    showToast(`${targets.length} elemento(s) copiado(s)!`, 'info');
  };

  const handlePaste = () => {
    if (!selectedMap || !clipboardNodes || clipboardNodes.length === 0) return;
    const idMap = new Map<string, string>();
    clipboardNodes.forEach((n) => {
      idMap.set(n.id, `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    });

    const pasted: MindmapNode[] = clipboardNodes.map((n) => {
      const newId = idMap.get(n.id)!;
      const remapped = (n.connections || [])
        .filter((c) => idMap.has(c.targetId))
        .map((c) => ({ ...c, targetId: idMap.get(c.targetId)! }));
      return {
        ...n,
        id: newId,
        x: n.x + 50,
        y: n.y + 50,
        connections: remapped,
      };
    });

    saveMapNodes(selectedMap.id, [...selectedMap.nodes, ...pasted]);
    setSelectedNodeIds(pasted.map((p) => p.id));
    if (pasted.length > 0) setSelectedNodeId(pasted[0].id);
    showToast(`${pasted.length} elemento(s) colado(s)!`, 'info');
  };

  // Bloquear / Desbloquear Elemento
  const handleToggleLock = (nodeId: string) => {
    if (!selectedMap) return;
    const nextNodes = selectedMap.nodes.map((n) =>
      n.id === nodeId ? { ...n, locked: !n.locked } : n
    );
    saveMapNodes(selectedMap.id, nextNodes);
    showToast('Status de bloqueio atualizado.', 'info');
  };

  // Ordem de Sobreposição (Trazer para frente / Enviar para trás)
  const handleReorderNode = (nodeId: string, direction: 'forward' | 'backward') => {
    if (!selectedMap) return;
    const idx = selectedMap.nodes.findIndex((n) => n.id === nodeId);
    if (idx === -1) return;
    const next = [...selectedMap.nodes];
    const [removed] = next.splice(idx, 1);
    if (direction === 'forward') {
      next.push(removed);
    } else {
      next.unshift(removed);
    }
    saveMapNodes(selectedMap.id, next);
  };

  // Keyboard navigation & Shortcuts for Mindmap
  useEffect(() => {
    if (activeTool !== 'mindmap') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      // Atalhos com Ctrl / Cmd
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          handleCopy();
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          handlePaste();
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          handleDuplicate();
          return;
        }
        if (key === 's') {
          e.preventDefault();
          handleSaveAsProjectFile();
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          if (selectedMap) setSelectedNodeIds(selectedMap.nodes.map((n) => n.id));
          return;
        }
        if (key === '0') {
          e.preventDefault();
          handleZoomToFit();
          return;
        }
      }

      // Atalhos diretos de ferramentas de Quadro Branco Lucidspark
      const k = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (k === 'v') {
          setWhiteboardTool('select');
        } else if (k === 'h') {
          setWhiteboardTool('pan');
        } else if (k === 's') {
          setWhiteboardTool('sticky');
        } else if (k === 't') {
          setWhiteboardTool('text');
        } else if (k === 'p') {
          setWhiteboardTool('pen');
        } else if (k === 'f') {
          setWhiteboardTool('shape');
        } else if (k === 'l') {
          setWhiteboardTool('line');
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        handleAddChildNode();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSiblingNode();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // Se uma conexão estiver selecionada, exclui APENAS a conexão!
        if (selectedEdgeId) {
          const edges = getBoardEdges(selectedMap?.nodes || []);
          const edge = edges.find((ed) => ed.id === selectedEdgeId);
          if (edge) {
            handleDisconnect(edge.sourceId, edge.targetId);
            return;
          }
        }
        handleDeleteSelectedNode();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomToFit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, selectedMap, selectedNode, selectedEdgeId, selectedNodeIds, clipboardNodes, undoStack, redoStack, whiteboardTool]);

  // Pan & Drag Handlers do Quadro Branco
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && (e.target as HTMLElement).tagName !== 'svg') return;
    if (!canvasRef.current || !selectedMap) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = Math.round((e.clientX - rect.left - panOffset.x) / zoom);
    const clickY = Math.round((e.clientY - rect.top - panOffset.y) / zoom);

    if (whiteboardTool === 'pan' || e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (whiteboardTool === 'pen') {
      setCurrentDrawingPath([{ x: clickX, y: clickY }]);
      setSelectedEdgeId(null);
      setSelectedNodeId('');
      setSelectedNodeIds([]);
      return;
    }

    if (whiteboardTool === 'sticky') {
      handleAddStickyAt(clickX, clickY);
      setWhiteboardTool('select');
      return;
    }

    if (whiteboardTool === 'text') {
      handleAddTextAt(clickX, clickY);
      setWhiteboardTool('select');
      return;
    }

    if (whiteboardTool === 'shape') {
      handleAddShapeAt(clickX, clickY, 'rectangle');
      setWhiteboardTool('select');
      return;
    }

    if (whiteboardTool === 'frame') {
      handleAddShapeAt(clickX, clickY, 'frame');
      setWhiteboardTool('select');
      return;
    }

    if (whiteboardTool === 'stamp') {
      handleAddStampAt(clickX, clickY);
      return;
    }

    // Ferramenta Selecionar Padrão: Marquee Selection Box
    setMarqueeBox({ startX: clickX, startY: clickY, currentX: clickX, currentY: clickY });
    setSelectedEdgeId(null);
    setSelectedNodeId('');
    setSelectedNodeIds([]);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const curX = Math.round((e.clientX - rect.left - panOffset.x) / zoom);
    const curY = Math.round((e.clientY - rect.top - panOffset.y) / zoom);

    if (currentDrawingPath) {
      setCurrentDrawingPath((prev) => (prev ? [...prev, { x: curX, y: curY }] : null));
      return;
    }

    if (marqueeBox) {
      setMarqueeBox((prev) => (prev ? { ...prev, currentX: curX, currentY: curY } : null));
      return;
    }

    if (!draggingNodeId || !selectedMap) return;
    const draggingNode = selectedMap.nodes.find((n) => n.id === draggingNodeId);
    if (draggingNode?.locked) return;

    const newX = gridSnap ? Math.round(curX / 20) * 20 : curX;
    const newY = gridSnap ? Math.round(curY / 20) * 20 : curY;

    const deltaX = newX - (draggingNode?.x || newX);
    const deltaY = newY - (draggingNode?.y || newY);

    setMindmaps((prev) =>
      prev.map((m) =>
        m.id === selectedMap.id
          ? {
              ...m,
              nodes: m.nodes.map((n) => {
                if (n.locked) return n;
                if (selectedNodeIds.includes(draggingNodeId) && selectedNodeIds.includes(n.id)) {
                  return { ...n, x: n.x + deltaX, y: n.y + deltaY };
                }
                if (n.id === draggingNodeId) {
                  return { ...n, x: newX, y: newY };
                }
                return n;
              }),
            }
          : m
      )
    );
  };

  const handleCanvasMouseUp = async () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Concluir traço de caneta livre
    if (currentDrawingPath && currentDrawingPath.length > 1 && selectedMap) {
      const d = currentDrawingPath.reduce(
        (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
        ''
      );
      const drawId = `draw_${Date.now()}`;
      const drawNode: MindmapNode = {
        id: drawId,
        label: 'Desenho',
        shape: 'drawing',
        pathData: d,
        color: penColor,
        strokeWidth: penWidth,
        x: currentDrawingPath[0].x,
        y: currentDrawingPath[0].y,
        connections: [],
      };
      saveMapNodes(selectedMap.id, [...selectedMap.nodes, drawNode]);
      setCurrentDrawingPath(null);
      return;
    }
    setCurrentDrawingPath(null);

    // Concluir seleção por retângulo (Marquee Selection)
    if (marqueeBox && selectedMap) {
      const minX = Math.min(marqueeBox.startX, marqueeBox.currentX);
      const maxX = Math.max(marqueeBox.startX, marqueeBox.currentX);
      const minY = Math.min(marqueeBox.startY, marqueeBox.currentY);
      const maxY = Math.max(marqueeBox.startY, marqueeBox.currentY);

      if (Math.abs(maxX - minX) > 8 || Math.abs(maxY - minY) > 8) {
        const hits = selectedMap.nodes.filter(
          (n) => n.x >= minX - 70 && n.x <= maxX + 70 && n.y >= minY - 50 && n.y <= maxY + 50
        );
        setSelectedNodeIds(hits.map((h) => h.id));
        if (hits.length > 0) setSelectedNodeId(hits[0].id);
      }
      setMarqueeBox(null);
      return;
    }
    setMarqueeBox(null);

    if (!draggingNodeId || !selectedMap) return;
    const draggedId = draggingNodeId;
    setDraggingNodeId(null);
    const currentMap = mindmaps.find((m) => m.id === selectedMap.id);
    if (currentMap) {
      saveMapNodes(currentMap.id, currentMap.nodes, undefined, true);
    }
    setSelectedNodeId(draggedId);
  };

  // --- PASSWORD VAULT HANDLERS ---
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=?';
    let pass = '';
    for (let i = 0; i < 20; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setEditingVault((prev) => (prev ? { ...prev, password: pass } : prev));
    showToast('Senha forte de 20 caracteres gerada!', 'info');
  };

  const handleSaveVaultItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVault || !window.electronAPI) return;
    if (!editingVault.title?.trim()) {
      showToast('Informe o nome do serviço ou aplicativo.', 'error');
      return;
    }
    try {
      if (editingVault.id) {
        await window.electronAPI.updateVaultItem(editingVault.id, editingVault);
        showToast('Credencial atualizada no Cofre!', 'success');
      } else {
        await window.electronAPI.createVaultItem(editingVault);
        showToast('Nova senha blindada salva no Cofre!', 'success');
      }
      setEditingVault(null);
      const updated = await window.electronAPI.getVaultItems();
      setVaultItems(updated);
      await refreshGame();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar no Cofre.', 'error');
    }
  };

  const handleDeleteVaultItem = async (id: string) => {
    if (!window.electronAPI?.deleteVaultItem) return;
    await window.electronAPI.deleteVaultItem(id);
    const updated = await window.electronAPI.getVaultItems();
    setVaultItems(updated);
    showToast('Credencial removida do Cofre.', 'info');
  };

  const handleToggleFavoriteVault = async (item: VaultItem) => {
    if (!window.electronAPI?.updateVaultItem) return;
    await window.electronAPI.updateVaultItem(item.id, { favorite: !item.favorite });
    const updated = await window.electronAPI.getVaultItems();
    setVaultItems(updated);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copiado!`, 'success');
  };

  // Filtered lists
  const filteredNotes = notes.filter((n) => {
    const matchesCat = noteCategoryFilter === 'all' || n.category === noteCategoryFilter;
    const q = noteSearch.toLowerCase().trim();
    return !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const filteredVault = vaultItems.filter((v) => {
    const matchesCat = vaultCategoryFilter === 'all' || v.category === vaultCategoryFilter;
    const q = vaultSearch.toLowerCase().trim();
    return !q || v.title.toLowerCase().includes(q) || v.username.toLowerCase().includes(q) || v.url.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Liquid Glass Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Pigo Ferramentas & Segundo Cérebro
              </h1>
              <p className="text-xs text-slate-400">
                Anotações completas estilo Notion, quadro branco visual estilo Lucidspark e cofre de senhas blindado.
              </p>
            </div>
          </div>
        </div>

        {/* Liquid Glass Tool Switcher */}
        <div className="liquid-glass-well p-1.5 rounded-2xl flex items-center gap-1 self-start">
          {[
            { id: 'tools_notes', key: 'notes', label: 'Anotações (Notion)', icon: StickyNote, count: notes.length },
            { id: 'tools_mindmap', key: 'mindmap', label: 'Quadro Branco (Lucidspark)', icon: Layers, count: mindmaps.length },
            { id: 'tools_vault', key: 'vault', label: 'Cofre de Senhas', icon: KeyRound, count: vaultItems.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTool === tab.key;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id as any)}
                style={{ '--tab-glow': 'rgba(217, 70, 239, 0.35)' } as React.CSSProperties}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-300 ${
                  isActive ? 'liquid-glass-tab-active text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-fuchsia-300' : ''}`} />
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.08] text-slate-300">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================
          ABA 1: ANOTAÇÕES ESTILO NOTION
         ========================================================= */}
      {activeTool === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px]">
          {/* Left Column: Notion Pages Sidebar */}
          <div className="lg:col-span-4 bg-slate-900/80 border border-white/[0.07] rounded-3xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar páginas e notas..."
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-400"
                />
              </div>
              <button
                onClick={handleCreateNote}
                className="liquid-glass-cta px-3.5 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-500 text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Página</span>
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <button
                onClick={() => setNoteCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition ${
                  noteCategoryFilter === 'all'
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Todas ({notes.length})
              </button>
              {NOTE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setNoteCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition ${
                    noteCategoryFilter === cat.id
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Notes List */}
            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
              {filteredNotes.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                  <StickyNote className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-300">Nenhuma página encontrada</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Crie notas financeiras, resumos de livros, atas de reunião e planos no Notion do Pigo.
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = note.id === selectedNoteId;
                  const catObj = NOTE_CATEGORIES.find((c) => c.id === note.category) || NOTE_CATEGORIES[0];
                  const doneCount = (note.checklist || []).filter((c) => c.done).length;
                  const totalCheck = (note.checklist || []).length;
                  return (
                    <button
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-fuchsia-500/50 shadow-lg'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">{note.icon || '📝'}</span>
                          <h3 className="text-xs font-extrabold text-white truncate">
                            {note.title || 'Sem título'}
                          </h3>
                        </div>
                        {note.pinned && (
                          <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400/20" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                        {note.content ? note.content.slice(0, 90) : 'Página em branco...'}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.04] text-[10px] text-slate-500">
                        <span>{catObj.label}</span>
                        {totalCheck > 0 && (
                          <span className="text-emerald-400 font-bold">
                            ✓ {doneCount}/{totalCheck}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Notion-Style Full Editor & Viewer */}
          <div className="lg:col-span-8 bg-slate-900/80 border border-white/[0.07] rounded-3xl p-6 flex flex-col overflow-hidden relative">
            {!selectedNote ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/25 flex items-center justify-center text-fuchsia-400 mb-3">
                  <StickyNote className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-white">Segundo Cérebro Estilo Notion</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-4">
                  Crie documentos ricos com blocos, cabeçalhos, destaques e listas de tarefas organizadas.
                </p>
                <button
                  onClick={handleCreateNote}
                  className="liquid-glass-cta px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-500 text-white text-xs font-extrabold flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Primeira Página</span>
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4">
                {/* Notion Cover Banner */}
                <div
                  className={`h-24 -mx-6 -mt-6 bg-gradient-to-r ${selectedNote.cover || NOTE_COVERS[0].class} p-4 flex items-end justify-between border-b border-white/[0.07]`}
                >
                  <div className="flex items-center gap-2">
                    {NOTE_COVERS.map((cov) => (
                      <button
                        key={cov.id}
                        type="button"
                        onClick={() => handleUpdateNote(selectedNote.id, { cover: cov.class })}
                        title={`Capa ${cov.label}`}
                        className={`w-4 h-4 rounded-full border border-white/40 bg-gradient-to-r ${cov.class} transition hover:scale-125`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyToClipboard(serializeBlocksToText(currentBlocks), 'Conteúdo formatado')}
                      className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 text-[11px] font-bold text-slate-200 flex items-center gap-1 backdrop-blur-md transition"
                      title="Copiar texto formatado"
                    >
                      <Copy className="w-3.5 h-3.5 text-fuchsia-300" />
                      <span>Copiar</span>
                    </button>
                    <button
                      onClick={() => handleUpdateNote(selectedNote.id, { pinned: !selectedNote.pinned })}
                      className={`p-1 rounded-lg border backdrop-blur-md ${
                        selectedNote.pinned
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                          : 'bg-black/40 border-white/20 text-slate-300'
                      }`}
                      title="Fixar no topo"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      className="p-1 rounded-lg bg-black/40 hover:bg-rose-500/20 border border-white/20 text-slate-400 hover:text-rose-300 backdrop-blur-md"
                      title="Excluir página"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Notion Title & Emoji Picker */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="relative group">
                    <button
                      type="button"
                      className="text-3xl p-1.5 rounded-xl hover:bg-white/10 transition"
                      title="Alterar emoji da página"
                    >
                      {selectedNote.icon || '📝'}
                    </button>
                    <div className="absolute left-0 top-full mt-1 z-30 hidden group-hover:flex bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl gap-1">
                      {NOTE_ICONS.map((ico) => (
                        <button
                          key={ico}
                          type="button"
                          onClick={() => handleUpdateNote(selectedNote.id, { icon: ico })}
                          className="text-lg hover:scale-125 p-1 transition"
                        >
                          {ico}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => handleUpdateNote(selectedNote.id, { title: e.target.value })}
                    placeholder="Sem título..."
                    className="flex-1 bg-transparent text-2xl font-black text-white focus:outline-none"
                  />

                  <select
                    value={selectedNote.category}
                    onChange={(e) => handleUpdateNote(selectedNote.id, { category: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                  >
                    {NOTE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visual Block Editor (Estilo Notion WYSIWYG) */}
                <div className="w-full flex-1 min-h-[360px] max-h-[460px] bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 overflow-y-auto space-y-2.5 custom-scrollbar">
                  {currentBlocks.map((block, idx) => (
                    <div
                      key={block.id}
                      className="group relative flex items-start gap-2 p-1.5 rounded-xl hover:bg-slate-900/60 transition border border-transparent hover:border-slate-800/80"
                    >
                      {/* Left Block Controls (Hover) */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 pt-1 transition select-none">
                        <select
                          value={block.type}
                          onChange={(e) => handleChangeBlockType(block.id, e.target.value as BlockType)}
                          className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 rounded px-1 py-0.5 focus:outline-none cursor-pointer"
                          title="Alterar tipo de bloco"
                        >
                          <option value="text">Texto</option>
                          <option value="h1">Título 1</option>
                          <option value="h2">Título 2</option>
                          <option value="h3">Título 3</option>
                          <option value="todo">To-Do</option>
                          <option value="bullet">Marcador</option>
                          <option value="numbered">Numerada</option>
                          <option value="callout">Destaque</option>
                          <option value="quote">Citação</option>
                          <option value="code">Código</option>
                          <option value="divider">Divisor</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(block.id, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition"
                          title="Mover acima"
                        >
                          <MoveUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(block.id, 'down')}
                          disabled={idx === currentBlocks.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition"
                          title="Mover abaixo"
                        >
                          <MoveDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlock(block.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Excluir bloco"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Visual Block Content */}
                      <div className="flex-1 min-w-0">
                        {block.type === 'h1' && (
                          <input
                            type="text"
                            value={block.content}
                            onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddBlockBelow(block.id, 'text');
                              } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                e.preventDefault();
                                handleRemoveBlock(block.id);
                              }
                            }}
                            placeholder="Título Grande (H1)..."
                            className="w-full bg-transparent text-xl font-black text-white focus:outline-none placeholder-slate-600 pb-1 border-b border-white/10"
                          />
                        )}

                        {block.type === 'h2' && (
                          <input
                            type="text"
                            value={block.content}
                            onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddBlockBelow(block.id, 'text');
                              } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                e.preventDefault();
                                handleRemoveBlock(block.id);
                              }
                            }}
                            placeholder="Subtítulo (H2)..."
                            className="w-full bg-transparent text-base font-extrabold text-fuchsia-300 focus:outline-none placeholder-fuchsia-400/40"
                          />
                        )}

                        {block.type === 'h3' && (
                          <input
                            type="text"
                            value={block.content}
                            onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddBlockBelow(block.id, 'text');
                              } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                e.preventDefault();
                                handleRemoveBlock(block.id);
                              }
                            }}
                            placeholder="Seção (H3)..."
                            className="w-full bg-transparent text-sm font-bold text-cyan-300 focus:outline-none placeholder-cyan-400/40"
                          />
                        )}

                        {block.type === 'todo' && (
                          <div className="flex items-center gap-2.5 w-full">
                            <button
                              type="button"
                              onClick={() => handleBlockChange(block.id, { checked: !block.checked })}
                              className="shrink-0 text-slate-400 hover:text-emerald-400 transition"
                            >
                              {block.checked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                              )}
                            </button>
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddBlockBelow(block.id, 'todo');
                                } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                  e.preventDefault();
                                  handleRemoveBlock(block.id);
                                }
                              }}
                              placeholder="Item de tarefa To-Do..."
                              className={`w-full bg-transparent text-xs focus:outline-none transition ${
                                block.checked ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}
                            />
                          </div>
                        )}

                        {block.type === 'bullet' && (
                          <div className="flex items-center gap-2.5 w-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-1" />
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddBlockBelow(block.id, 'bullet');
                                } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                  e.preventDefault();
                                  handleRemoveBlock(block.id);
                                }
                              }}
                              placeholder="Item de lista com marcador..."
                              className="w-full bg-transparent text-xs text-slate-200 focus:outline-none placeholder-slate-600"
                            />
                          </div>
                        )}

                        {block.type === 'numbered' && (
                          <div className="flex items-center gap-2.5 w-full">
                            <span className="text-[11px] font-bold text-pink-400 shrink-0 w-4 text-right font-mono">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={block.content}
                              onChange={(e) => handleBlockChange(block.id, { content: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddBlockBelow(block.id, 'numbered');
                                } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                  e.preventDefault();
                                  handleRemoveBlock(block.id);
                                }
                              }}
                              placeholder="Item de lista numerada..."
                              className="w-full bg-transparent text-xs text-slate-200 focus:outline-none placeholder-slate-600"
                            />
                          </div>
                        )}

                        {block.type === 'callout' && (
                          <div className="flex items-start gap-3 w-full p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <button
                              type="button"
                              onClick={() => {
                                const nextEmoji = CALLOUT_EMOJIS[(CALLOUT_EMOJIS.indexOf(block.icon || '💡') + 1) % CALLOUT_EMOJIS.length];
                                handleBlockChange(block.id, { icon: nextEmoji });
                              }}
                              className="text-base shrink-0 select-none hover:scale-125 transition"
                              title="Clique para alternar o ícone"
                            >
                              {block.icon || '💡'}
                            </button>
                            <textarea
                              value={block.content}
                              onChange={(e) => {
                                handleBlockChange(block.id, { content: e.target.value });
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddBlockBelow(block.id, 'text');
                                } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                  e.preventDefault();
                                  handleRemoveBlock(block.id);
                                }
                              }}
                              placeholder="Destaque ou insight importante..."
                              rows={1}
                              className="w-full bg-transparent text-amber-100 text-xs focus:outline-none resize-none overflow-hidden placeholder-amber-200/40 leading-relaxed"
                            />
                          </div>
                        )}

                        {block.type === 'quote' && (
                          <div className="flex items-start gap-3 w-full pl-3 border-l-2 border-fuchsia-500/80 my-0.5">
                            <textarea
                              value={block.content}
                              onChange={(e) => {
                                handleBlockChange(block.id, { content: e.target.value });
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAddBlockBelow(block.id, 'text');
                                } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                  e.preventDefault();
                                  handleRemoveBlock(block.id);
                                }
                              }}
                              placeholder="Citação ou reflexão inspiradora..."
                              rows={1}
                              className="w-full bg-transparent italic text-slate-300 text-xs focus:outline-none resize-none overflow-hidden placeholder-slate-600 leading-relaxed"
                            />
                          </div>
                        )}

                        {block.type === 'code' && (
                          <div className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1.5 border-b border-slate-800/80 mb-1.5">
                              <span className="flex items-center gap-1.5"><Code className="w-3 h-3 text-cyan-400" /> Bloco de Código</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(block.content, 'Código')}
                                className="hover:text-white transition"
                              >
                                Copiar
                              </button>
                            </div>
                            <textarea
                              value={block.content}
                              onChange={(e) => {
                                handleBlockChange(block.id, { content: e.target.value });
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              placeholder="// Digite ou cole seu código ou script..."
                              rows={2}
                              className="w-full bg-transparent text-cyan-200 font-mono text-xs focus:outline-none resize-none placeholder-slate-600"
                            />
                          </div>
                        )}

                        {block.type === 'divider' && (
                          <div className="w-full py-2">
                            <hr className="border-t border-slate-800" />
                          </div>
                        )}

                        {block.type === 'text' && (
                          <textarea
                            value={block.content}
                            onChange={(e) => {
                              handleBlockChange(block.id, { content: e.target.value });
                              e.target.style.height = 'auto';
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddBlockBelow(block.id, 'text');
                              } else if (e.key === 'Backspace' && block.content === '' && currentBlocks.length > 1) {
                                e.preventDefault();
                                handleRemoveBlock(block.id);
                              }
                            }}
                            placeholder="Digite algo ou aperte Enter para nova linha..."
                            rows={1}
                            className="w-full bg-transparent text-slate-100 text-xs leading-relaxed focus:outline-none resize-none overflow-hidden placeholder-slate-600/70"
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Quick Add Block Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Adicionar:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'text')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <span>¶</span> <span>Texto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'h1')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Heading1 className="w-3 h-3 text-fuchsia-400" /> <span>H1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'h2')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Heading2 className="w-3 h-3 text-purple-400" /> <span>H2</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'h3')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Heading3 className="w-3 h-3 text-cyan-400" /> <span>H3</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'todo')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <CheckSquare className="w-3 h-3 text-emerald-400" /> <span>To-Do</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'bullet')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <List className="w-3 h-3 text-amber-400" /> <span>Marcador</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'numbered')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <ListOrdered className="w-3 h-3 text-pink-400" /> <span>Numerada</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'callout')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" /> <span>Destaque</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'quote')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Quote className="w-3 h-3 text-slate-400" /> <span>Citação</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'code')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Code className="w-3 h-3 text-cyan-300" /> <span>Código</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlockBelow(undefined, 'divider')}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Minus className="w-3 h-3 text-slate-500" /> <span>Divisor</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Notion Checklist Footer */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-fuchsia-400" />
                      <span>Tarefas Rápidas da Página</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {(selectedNote.checklist || []).filter((i) => i.done).length}/
                      {(selectedNote.checklist || []).length} concluídas
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar tarefa e pressionar Enter..."
                      value={newCheckItemText}
                      onChange={(e) => setNewCheckItemText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddChecklistItem();
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-3 py-1.5 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/35 text-fuchsia-200 text-xs font-bold transition"
                    >
                      + Adicionar
                    </button>
                  </div>

                  {(selectedNote.checklist || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto custom-scrollbar">
                      {(selectedNote.checklist || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleChecklistItem(item.id)}
                            className="flex items-center gap-1.5 text-left"
                          >
                            {item.done ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            )}
                            <span className={item.done ? 'line-through text-slate-500' : 'text-slate-200'}>
                              {item.text}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="text-slate-500 hover:text-rose-400 ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          ABA 2: QUADRO VISUAL DE IDEIAS ESTILO LUCIDSPARK
         ========================================================= */}
      {activeTool === 'mindmap' && (
        <div className="w-full">
          {/* =======================================================
              MODO 1: HUB DE PASTAS E DOCUMENTOS ESTILO LUCIDSPARK
             ======================================================= */}
          {lucidViewMode === 'folders' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Header do Hub de Documentos */}
              <div className="p-5 rounded-3xl bg-slate-900/90 border border-white/[0.08] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xl">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                      <span>Documentos e Quadros Lucidspark</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Organize seus projetos, estratégias e sessões de brainstorming estruturados em pastas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar quadros..."
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewFolderModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Nova Pasta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateBoardInFolder()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition transform hover:scale-105"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo Quadro</span>
                  </button>
                </div>
              </div>

              {/* Grid Principal: Sidebar de Pastas + Cards de Quadros */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Coluna Esquerda: Navegador de Pastas */}
                <div className="lg:col-span-3 space-y-2">
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/[0.08] shadow-lg space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-3 py-1 block">
                      Pastas de Organização
                    </span>

                    {/* Todos os Quadros */}
                    <button
                      type="button"
                      onClick={() => setActiveFolder('all')}
                      className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition ${
                        activeFolder === 'all'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Layers className="w-4 h-4 shrink-0" />
                        <span className="truncate">Todos os Quadros</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-mono">{mindmaps.length}</span>
                    </button>

                    {/* Lista de Pastas Individuais */}
                    {folders.map((folder) => {
                      const count = mindmaps.filter((m) => (m.description || 'Geral') === folder).length;
                      const isActive = activeFolder === folder;
                      return (
                        <div
                          key={folder}
                          className={`group w-full px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-slate-300 hover:bg-slate-800/80'
                          }`}
                          onClick={() => setActiveFolder(folder)}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Folder className="w-4 h-4 shrink-0 text-indigo-400 group-hover:text-white" />
                            <span className="text-xs font-bold truncate">{folder}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] opacity-75 font-mono">{count}</span>
                            {folder !== 'Geral' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(folder);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-300 p-0.5 transition"
                                title="Excluir Pasta"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setNewFolderModalOpen(true)}
                      className="w-full mt-2 px-3 py-2 rounded-xl text-left text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-600/10 flex items-center gap-2 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar Nova Pasta</span>
                    </button>
                  </div>
                </div>

                {/* Coluna Direita: Cards de Quadros da Pasta */}
                <div className="lg:col-span-9 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-bold flex items-center gap-1.5 text-slate-200">
                      <Folder className="w-4 h-4 text-indigo-400" />
                      <span>Pasta Atual:</span>
                      <span className="text-indigo-300">
                        {activeFolder === 'all' ? 'Todos os Quadros' : activeFolder}
                      </span>
                    </span>
                    <span>
                      {
                        mindmaps.filter(
                          (m) =>
                            (activeFolder === 'all' || (m.description || 'Geral') === activeFolder) &&
                            (!folderSearch || m.title.toLowerCase().includes(folderSearch.toLowerCase()))
                        ).length
                      }{' '}
                      quadros encontrados
                    </span>
                  </div>

                  {/* Grid de Quadros */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {mindmaps
                      .filter(
                        (m) =>
                          (activeFolder === 'all' || (m.description || 'Geral') === activeFolder) &&
                          (!folderSearch || m.title.toLowerCase().includes(folderSearch.toLowerCase()))
                      )
                      .map((board) => {
                        const boardNodes = Array.isArray(board.nodes) ? board.nodes : [];
                        const edges = getBoardEdges(boardNodes);
                        return (
                          <div
                            key={board.id}
                            className="group p-4 rounded-3xl bg-slate-900/85 border border-white/[0.08] hover:border-indigo-500/50 shadow-xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-1"
                          >
                            <div>
                              {/* Miniatura Visual Estilizada do Quadro */}
                              <div
                                onClick={() => {
                                  setSelectedMapId(board.id);
                                  setSelectedNodeId(boardNodes[0]?.id || 'root');
                                  setLucidViewMode('canvas');
                                }}
                                className="h-32 w-full rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-3 relative overflow-hidden cursor-pointer group-hover:border-indigo-500/30"
                                style={{
                                  backgroundImage:
                                    'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
                                  backgroundSize: '16px 16px',
                                }}
                              >
                                <div className="flex flex-wrap items-center justify-center gap-1.5 opacity-80 pointer-events-none">
                                  {boardNodes.slice(0, 4).map((n) => (
                                    <span
                                      key={n.id}
                                      style={{ backgroundColor: n.color }}
                                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow truncate max-w-[100px]"
                                    >
                                      {n.label}
                                    </span>
                                  ))}
                                </div>
                                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-1 shadow-lg">
                                    <span>Abrir Quadro</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </span>
                                </div>
                              </div>

                              {/* Título e Pasta */}
                              <div className="pt-3.5 space-y-1">
                                <h4 className="text-sm font-black text-white truncate">{board.title}</h4>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold flex items-center gap-1">
                                    <Folder className="w-3 h-3 text-indigo-400" />
                                    <span>{board.description || 'Geral'}</span>
                                  </span>
                                  <span>•</span>
                                  <span>{boardNodes.length} nós</span>
                                  <span>•</span>
                                  <span>{edges.length} conexões</span>
                                </div>
                              </div>
                            </div>

                            {/* Ações do Card */}
                            <div className="pt-4 flex items-center justify-between border-t border-slate-800/80 mt-3">
                              <select
                                value={board.description || 'Geral'}
                                onChange={(e) => {
                                  if (window.electronAPI?.updateMindmap) {
                                    window.electronAPI.updateMindmap(board.id, {
                                      description: e.target.value,
                                    });
                                    setMindmaps((prev) =>
                                      prev.map((b) =>
                                        b.id === board.id ? { ...b, description: e.target.value } : b
                                      )
                                    );
                                    showToast(`Quadro movido para a pasta "${e.target.value}".`, 'success');
                                  }
                                }}
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                                title="Mover para outra pasta"
                              >
                                {folders.map((f) => (
                                  <option key={f} value={f}>
                                    Pasta: {f}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => handleDeleteMindmap(board.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Excluir Quadro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {/* Card de Adição Rápida */}
                    <div
                      onClick={() => handleCreateBoardInFolder()}
                      className="p-6 rounded-3xl border-2 border-dashed border-slate-800 hover:border-indigo-500/60 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] transition-all group"
                    >
                      <div className="p-3 rounded-2xl bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition mb-2 shadow">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white">
                        Criar Novo Quadro em Branco
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1">
                        Inicie um quadro 100% livre na pasta atual
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal de Criação de Nova Pasta */}
              {newFolderModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <FolderPlus className="w-4 h-4 text-indigo-400" />
                        <span>Criar Nova Pasta</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setNewFolderModalOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Nome da pasta (ex: Estratégia 2026)..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateFolder();
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setNewFolderModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                      >
                        Criar Pasta
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =======================================================
              MODO 2: EDITOR CANVAS 100% DA ALTURA ESTILO LUCIDSPARK
             ======================================================= */}
          {lucidViewMode === 'canvas' && selectedMap && (
            <div className="relative w-full h-[calc(100vh-100px)] min-h-[720px] rounded-3xl bg-[#0b0c10] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden select-none animate-in fade-in duration-150">
              {/* Top Lucidspark Header Bar */}
              <div className="h-14 px-4 bg-slate-900/90 border-b border-white/[0.08] flex items-center justify-between z-20 backdrop-blur-md shrink-0">
                {/* Botão de Retorno para Pastas + Título + Status */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLucidViewMode('folders')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700/80 transition shadow"
                    title="Retornar para o Hub de Pastas e Documentos"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Pastas</span>
                  </button>

                  <div className="h-4 w-px bg-white/10" />

                  <input
                    type="text"
                    value={selectedMap.title}
                    onChange={(e) => saveMapNodes(selectedMap.id, selectedMap.nodes, e.target.value)}
                    className="bg-transparent text-sm font-black text-white focus:outline-none focus:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-transparent focus:border-indigo-500/50 transition max-w-[220px]"
                    title="Renomear este quadro"
                  />

                  {/* Seletor de Pasta do Quadro Atual */}
                  <select
                    value={selectedMap.description || 'Geral'}
                    onChange={(e) => {
                      if (window.electronAPI?.updateMindmap) {
                        window.electronAPI.updateMindmap(selectedMap.id, {
                          description: e.target.value,
                        });
                        setMindmaps((prev) =>
                          prev.map((b) =>
                            b.id === selectedMap.id ? { ...b, description: e.target.value } : b
                          )
                        );
                        showToast(`Quadro associado à pasta "${e.target.value}".`, 'info');
                      }
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none hidden sm:inline"
                    title="Alterar pasta deste quadro"
                  >
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        Pasta: {f}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <Save className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Salvo Localmente (Offline)</span>
                  </div>

                  {/* Indicador de Conexão Ativa */}
                  {connectingFromNodeId && (
                    <div className="px-2.5 py-1 rounded-xl bg-indigo-600/30 border border-indigo-400 text-indigo-200 text-xs font-bold animate-pulse flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Modo Conectar: Clique no elemento de destino</span>
                      <button
                        type="button"
                        onClick={() => setConnectingFromNodeId(null)}
                        className="ml-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Header: Desfazer, Refazer, Conexões, Grade, Fit, Salvar Como, Abrir, PNG, PDF */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {/* Desfazer / Refazer */}
                  <div className="flex items-center rounded-xl bg-slate-950 p-0.5 border border-slate-800">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className={`p-1.5 rounded-lg transition ${
                        undoStack.length > 0 ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
                      }`}
                      title="Desfazer (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                      className={`p-1.5 rounded-lg transition ${
                        redoStack.length > 0 ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
                      }`}
                      title="Refazer (Ctrl+Y)"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Seletor de Estilo de Conexão */}
                  <div className="flex items-center rounded-xl bg-slate-950 p-0.5 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setConnectorStyle('curved')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg transition ${
                        connectorStyle === 'curved' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                      }`}
                      title="Conexões Curvas Bézier"
                    >
                      Curva
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectorStyle('elbow')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg transition ${
                        connectorStyle === 'elbow' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                      }`}
                      title="Conexões Angulares 90°"
                    >
                      Angular
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectorStyle('straight')}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg transition ${
                        connectorStyle === 'straight' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                      }`}
                      title="Conexões Retas"
                    >
                      Reta
                    </button>
                  </div>

                  {/* Grade Snap */}
                  <button
                    type="button"
                    onClick={() => setGridSnap((v) => !v)}
                    className={`p-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 ${
                      gridSnap
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                    title="Alternar Encaixe na Grade (Snap to Grid)"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span className="text-[10px] hidden xl:inline">Grade</span>
                  </button>

                  {/* Ajustar à Tela (Fit to View) */}
                  <button
                    type="button"
                    onClick={handleZoomToFit}
                    className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
                    title="Ajustar Todo Conteúdo à Tela (Ctrl+0)"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  </button>

                  {/* Auto-Organizar */}
                  <button
                    type="button"
                    onClick={handleAutoLayout}
                    className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
                    title="Auto-organizar layout"
                  >
                    <Layout className="w-3.5 h-3.5 text-indigo-400" />
                  </button>

                  {/* Timer de Brainstorming */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLucidTimerOpen((v) => !v)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                        lucidTimerActive
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                      title="Timer de Sessão"
                    >
                      <Timer className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-mono text-[11px]">
                        {Math.floor(lucidTimerSeconds / 60)}:{(lucidTimerSeconds % 60).toString().padStart(2, '0')}
                      </span>
                    </button>

                    {lucidTimerOpen && (
                      <div className="absolute right-0 top-full mt-2 w-60 p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-50 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>Timer de Sessão</span>
                          <span className="font-mono text-amber-400 text-sm">
                            {Math.floor(lucidTimerSeconds / 60)}:{(lucidTimerSeconds % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[60, 180, 300, 600].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => {
                                setLucidTimerSeconds(sec);
                                setLucidTimerActive(false);
                              }}
                              className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300"
                            >
                              {sec / 60}m
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLucidTimerActive((v) => !v)}
                            className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition"
                          >
                            {lucidTimerActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{lucidTimerActive ? 'Pausar' : 'Iniciar'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLucidTimerSeconds(300);
                              setLucidTimerActive(false);
                            }}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Resetar 5 min"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-4 w-px bg-slate-800 mx-0.5 hidden sm:block" />

                  {/* Abrir Projeto Local (.pigo-board / .json) */}
                  <button
                    type="button"
                    onClick={() => projectFileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition shadow"
                    title="Abrir arquivo de projeto salvo no computador (.pigo-board ou .json)"
                  >
                    <FileUp className="w-3.5 h-3.5 text-sky-400" />
                    <span className="hidden lg:inline">Abrir</span>
                  </button>

                  {/* Salvar Como (.pigo-board) */}
                  <button
                    type="button"
                    onClick={handleSaveAsProjectFile}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition shadow"
                    title="Salvar cópia editável do projeto no computador (.pigo-board)"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden lg:inline">Salvar Como</span>
                  </button>

                  {/* Exportar PNG (2x Retina) */}
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition shadow"
                    title="Exportar Imagem PNG de Alta Resolução"
                  >
                    <FileDown className="w-3.5 h-3.5 text-amber-400" />
                    <span>PNG</span>
                  </button>

                  {/* Exportar PDF */}
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
                    title="Exportar Quadro em PDF Vetorial de Alta Resolução"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              {/* Hidden File Inputs for Local Image Import & Project File Opening */}
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImportLocalImage}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={projectFileInputRef}
                onChange={handleOpenProjectFile}
                accept=".json,.pigo-board"
                className="hidden"
              />

              {/* Barra de Ferramentas Primária Flutuante do Lucidspark (Whiteboard Toolbar) */}
              <div className="absolute left-4 top-20 z-20 flex flex-col items-center bg-slate-900/95 border border-white/[0.08] rounded-2xl p-1.5 shadow-2xl space-y-1 backdrop-blur-xl">
                {/* 1. Selecionar (V) */}
                <button
                  type="button"
                  onClick={() => {
                    setWhiteboardTool('select');
                    setPenDrawerOpen(false);
                    setStampDrawerOpen(false);
                    setLucidShapesMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl transition ${
                    whiteboardTool === 'select'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Selecionar / Mover (V) - Arraste no vazio para seleção em lote"
                >
                  <MousePointer className="w-5 h-5" />
                </button>

                {/* 2. Mão / Pan (H) */}
                <button
                  type="button"
                  onClick={() => {
                    setWhiteboardTool('pan');
                    setPenDrawerOpen(false);
                    setStampDrawerOpen(false);
                    setLucidShapesMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl transition ${
                    whiteboardTool === 'pan'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Navegar / Mão (H) - Arraste a tela livremente"
                >
                  <Hand className="w-5 h-5" />
                </button>

                {/* 3. Post-it (S) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setWhiteboardTool('sticky');
                      setLucidStickyDrawerOpen((v) => !v);
                      setPenDrawerOpen(false);
                      setStampDrawerOpen(false);
                      setLucidShapesMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl transition relative ${
                      whiteboardTool === 'sticky' || lucidStickyDrawerOpen
                        ? 'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/30'
                        : 'text-amber-400 hover:bg-amber-400/20'
                    }`}
                    title="Notas Adesivas / Post-its (S)"
                  >
                    <StickyNote className="w-5 h-5" />
                    <span
                      style={{ backgroundColor: lucidActiveColor }}
                      className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border border-slate-900"
                    />
                  </button>
                </div>

                {/* 4. Formas Geométricas (F) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setWhiteboardTool('shape');
                      setLucidShapesMenuOpen((v) => !v);
                      setLucidStickyDrawerOpen(false);
                      setPenDrawerOpen(false);
                      setStampDrawerOpen(false);
                    }}
                    className={`p-2.5 rounded-xl transition ${
                      whiteboardTool === 'shape' || lucidShapesMenuOpen
                        ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Formas: Retângulo, Círculo, Losango, Nuvem, Cápsula, Octógono (F)"
                  >
                    <Square className="w-5 h-5 text-cyan-400" />
                  </button>

                  {lucidShapesMenuOpen && (
                    <div className="absolute left-full top-0 ml-3 w-60 p-2 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-40 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-2 block">
                        Inserir Forma
                      </span>
                      {LUCID_SHAPES.map((shape) => (
                        <button
                          key={shape.type}
                          type="button"
                          onClick={() => {
                            handleAddShape(shape.type);
                            setLucidShapesMenuOpen(false);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-800 text-left text-xs font-bold text-slate-200 flex items-center gap-2.5 transition"
                        >
                          <span className="p-1 rounded bg-slate-800 text-indigo-400">
                            {shape.type === 'cloud' && <Cloud className="w-3.5 h-3.5" />}
                            {shape.type === 'capsule' && <Circle className="w-3.5 h-3.5" />}
                            {shape.type === 'octagon' && <Octagon className="w-3.5 h-3.5" />}
                            {shape.type === 'diamond' && <Diamond className="w-3.5 h-3.5" />}
                            {shape.type === 'sticky' && <StickyNote className="w-3.5 h-3.5" />}
                            {shape.type === 'rectangle' && <Square className="w-3.5 h-3.5" />}
                            {shape.type === 'circle' && <Circle className="w-3.5 h-3.5" />}
                            {shape.type === 'text' && <Type className="w-3.5 h-3.5" />}
                            {shape.type === 'frame' && <Scan className="w-3.5 h-3.5" />}
                          </span>
                          <div>
                            <div>{shape.label}</div>
                            <span className="text-[10px] font-normal text-slate-400">{shape.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Texto Livre (T) */}
                <button
                  type="button"
                  onClick={() => {
                    setWhiteboardTool('text');
                    setPenDrawerOpen(false);
                    setStampDrawerOpen(false);
                    setLucidShapesMenuOpen(false);
                    setLucidStickyDrawerOpen(false);
                  }}
                  className={`p-2.5 rounded-xl transition ${
                    whiteboardTool === 'text'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Texto Livre (T) - Clique no quadro para digitar"
                >
                  <Type className="w-5 h-5 text-indigo-300" />
                </button>

                {/* 6. Caneta / Desenho Livre (P) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setWhiteboardTool('pen');
                      setPenDrawerOpen((v) => !v);
                      setStampDrawerOpen(false);
                      setLucidShapesMenuOpen(false);
                      setLucidStickyDrawerOpen(false);
                    }}
                    className={`p-2.5 rounded-xl transition ${
                      whiteboardTool === 'pen'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Caneta / Desenho Livre (P) - Desenhe na lousa à mão livre"
                  >
                    <PenTool className="w-5 h-5 text-purple-400" />
                  </button>

                  {/* Gaveta Flutuante de Caneta */}
                  {penDrawerOpen && (
                    <div className="absolute left-full top-0 ml-3 w-56 p-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-40 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between text-xs font-bold text-white pb-1 border-b border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <PenTool className="w-3.5 h-3.5 text-purple-400" />
                          <span>Caneta do Quadro</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPenDrawerOpen(false)}
                          className="text-slate-500 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Cor da Caneta
                        </span>
                        <div className="flex items-center gap-1.5">
                          {['#ffffff', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setPenColor(c);
                                setWhiteboardTool('pen');
                              }}
                              style={{ backgroundColor: c }}
                              className={`w-6 h-6 rounded-full transition ${
                                penColor === c
                                  ? 'ring-2 ring-white scale-110 shadow-md'
                                  : 'opacity-80 hover:opacity-100'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Espessura do Traço
                        </span>
                        <div className="flex items-center gap-1.5">
                          {[
                            { label: 'Fina', w: 2 },
                            { label: 'Média', w: 4 },
                            { label: 'Marcador', w: 8 },
                          ].map((item) => (
                            <button
                              key={item.w}
                              type="button"
                              onClick={() => {
                                setPenWidth(item.w);
                                setWhiteboardTool('pen');
                              }}
                              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${
                                penWidth === item.w
                                  ? 'bg-purple-600 text-white shadow'
                                  : 'bg-slate-800 text-slate-300 hover:text-white'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. Conexões / Linhas (L) */}
                <button
                  type="button"
                  onClick={() => {
                    setWhiteboardTool('line');
                    if (selectedNode) {
                      setConnectingFromNodeId(selectedNode.id);
                      showToast('Clique no elemento de destino para criar a conexão.', 'info');
                    } else {
                      showToast('Selecione primeiro um elemento e clique para conectar.', 'info');
                    }
                  }}
                  className={`p-2.5 rounded-xl transition ${
                    connectingFromNodeId || whiteboardTool === 'line'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Conectar Elementos Livremente (L)"
                >
                  <Link2 className="w-5 h-5 text-indigo-400" />
                </button>

                {/* 8. Área / Frame */}
                <button
                  type="button"
                  onClick={() => {
                    setWhiteboardTool('frame');
                    showToast('Clique em qualquer ponto do quadro para posicionar o Frame!', 'info');
                  }}
                  className={`p-2.5 rounded-xl transition ${
                    whiteboardTool === 'frame'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Criar Área de Organização / Frame"
                >
                  <Scan className="w-5 h-5 text-indigo-400" />
                </button>

                {/* 9. Carimbos de Reação (Stamps) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setStampDrawerOpen((v) => !v);
                      setPenDrawerOpen(false);
                      setLucidShapesMenuOpen(false);
                      setLucidStickyDrawerOpen(false);
                    }}
                    className={`p-2.5 rounded-xl transition ${
                      whiteboardTool === 'stamp' || stampDrawerOpen
                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Carimbos e Reações Visuais de Votação"
                  >
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400/60" />
                  </button>

                  {/* Gaveta de Carimbos */}
                  {stampDrawerOpen && (
                    <div className="absolute left-full top-0 ml-3 w-56 p-3 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-40 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between text-xs font-bold text-white pb-1 border-b border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span>Carimbos de Reação</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setStampDrawerOpen(false)}
                          className="text-slate-500 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {[
                          { type: 'star', label: 'Estrela', icon: Star, color: 'text-amber-400 fill-amber-400' },
                          { type: 'check', label: 'Aprovado', icon: Check, color: 'text-emerald-400' },
                          { type: 'flame', label: 'Fogo', icon: Flame, color: 'text-rose-400' },
                          { type: 'bulb', label: 'Ideia', icon: Sparkles, color: 'text-purple-400' },
                          { type: 'heart', label: 'Amei', icon: Heart, color: 'text-pink-400 fill-pink-400' },
                          { type: 'alert', label: 'Atenção', icon: AlertCircle, color: 'text-orange-400' },
                        ].map((st) => {
                          const Icon = st.icon;
                          const isSel = activeStampType === st.type && whiteboardTool === 'stamp';
                          return (
                            <button
                              key={st.type}
                              type="button"
                              onClick={() => {
                                setActiveStampType(st.type as any);
                                setWhiteboardTool('stamp');
                                setStampDrawerOpen(false);
                                showToast(`Carimbo "${st.label}" ativo. Clique no quadro para carimbar!`, 'info');
                              }}
                              className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                                isSel
                                  ? 'bg-indigo-600/30 border-indigo-500 shadow'
                                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${st.color}`} />
                              <span className="text-[9px] text-slate-300 font-bold">{st.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-6 h-px bg-slate-800 my-0.5" />

                {/* Inserir Imagem Local do Computador */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
                  title="Inserir Imagem do Computador (100% Offline)"
                >
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                </button>

                {/* Criar em Lote */}
                <button
                  type="button"
                  onClick={() => setLucidBatchModalOpen(true)}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
                  title="Criar Post-its em Lote (Colar Lista)"
                >
                  <ListOrdered className="w-5 h-5 text-pink-400" />
                </button>
              </div>

              {/* Gaveta de Leques de Cores do Lucidspark (Sem Emojis) */}
              {lucidStickyDrawerOpen && (
                <div className="absolute left-20 top-20 z-30 w-88 bg-slate-900/98 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl space-y-3.5 select-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <StickyNote className="w-4 h-4 text-amber-400" />
                      <span>Adicionar Post-its ao Quadro</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setLucidStickyDrawerOpen(false)}
                      className="text-slate-500 hover:text-white text-xs p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 4 Linhas de Leques */}
                  <div className="space-y-2 py-1">
                    {LUCID_FAN_PALETTES.map((palette, pIdx) => (
                      <div key={pIdx} className="flex items-center justify-center gap-1">
                        {palette.colors.map((c) => {
                          const isChosen = lucidActiveColor === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setLucidActiveColor(c)}
                              style={{ backgroundColor: c }}
                              className={`w-7 h-10 rounded-md transition-all flex items-center justify-center ${
                                isChosen
                                  ? 'scale-115 ring-2 ring-white shadow-xl -translate-y-1 z-10'
                                  : 'hover:scale-105 opacity-85 hover:opacity-100'
                              }`}
                              title={c}
                            >
                              {isChosen && <Check className="w-3.5 h-3.5 text-white drop-shadow font-black" />}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Digitar e Enter */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-bold text-slate-300 block">
                      Digite e pressione Enter para criar post-it:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Escreva sua ideia aqui..."
                        value={lucidStickyInput}
                        onChange={(e) => setLucidStickyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddStickyFromDrawer();
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={handleAddStickyFromDrawer}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                      >
                        Criar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setLucidStickyDrawerOpen(false);
                        setLucidBatchModalOpen(true);
                      }}
                      className="w-full text-left text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 pt-1 transition"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Colar listas ou parágrafos para criar em lote</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Modal de Criação em Lote */}
              {lucidBatchModalOpen && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <ListOrdered className="w-4 h-4 text-indigo-400" />
                        <span>Criar Post-its em Lote</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setLucidBatchModalOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Cole sua lista de ideias ou parágrafos. Cada linha será transformada em um post-it separado na cor selecionada.
                    </p>

                    <textarea
                      rows={6}
                      value={lucidBatchInput}
                      onChange={(e) => setLucidBatchInput(e.target.value)}
                      placeholder="Primeira ideia&#10;Segunda ideia&#10;Terceira reflexão..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 custom-scrollbar resize-none"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setLucidBatchModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleBatchAddStickies}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Gerar Post-its</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Canvas 100% da Altura com Grade de Pontos do Quadro Branco */}
              <div
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onDoubleClick={handleCanvasDoubleClick}
                className={`relative w-full flex-1 overflow-hidden select-none ${
                  whiteboardTool === 'pan'
                    ? isPanning
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                    : whiteboardTool === 'pen'
                    ? 'cursor-crosshair'
                    : whiteboardTool === 'sticky' ||
                      whiteboardTool === 'text' ||
                      whiteboardTool === 'shape' ||
                      whiteboardTool === 'stamp' ||
                      whiteboardTool === 'frame'
                    ? 'cursor-copy'
                    : 'cursor-default'
                }`}
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.18) 1.5px, transparent 1.5px)',
                  backgroundSize: '28px 28px',
                }}
              >
                <div
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  {/* Conexões e Traços Vetoriais de Desenho do Quadro */}
                  <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
                    {/* Traços Vetoriais de Desenho Livre da Caneta */}
                    {selectedMap.nodes
                      .filter((n) => n.shape === 'drawing' && n.pathData)
                      .map((drawNode) => {
                        const isSelected =
                          selectedNodeIds.includes(drawNode.id) || selectedNodeId === drawNode.id;
                        return (
                          <g
                            key={drawNode.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNodeId(drawNode.id);
                              setSelectedNodeIds([drawNode.id]);
                              setSelectedEdgeId(null);
                            }}
                            className="cursor-pointer pointer-events-auto"
                          >
                            {isSelected && (
                              <path
                                d={drawNode.pathData}
                                stroke="#818cf8"
                                strokeWidth={(drawNode.strokeWidth || 3) + 8}
                                strokeOpacity={0.5}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="animate-pulse"
                              />
                            )}
                            <path
                              d={drawNode.pathData}
                              stroke={drawNode.color || '#6366f1'}
                              strokeWidth={drawNode.strokeWidth || 3}
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                        );
                      })}

                    {/* Traço em Tempo Real enquanto o usuário desenha */}
                    {currentDrawingPath && currentDrawingPath.length > 1 && (
                      <path
                        d={currentDrawingPath.reduce(
                          (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
                          ''
                        )}
                        stroke={penColor}
                        strokeWidth={penWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Conexões e Linhas M:N */}
                    {getBoardEdges(selectedMap.nodes).map((edge) => {
                      const source = selectedMap.nodes.find((n) => n.id === edge.sourceId);
                      const target = selectedMap.nodes.find((n) => n.id === edge.targetId);
                      if (!source || !target) return null;

                      const midX = (source.x + target.x) / 2;
                      const midY = (source.y + target.y) / 2;

                      let pathData = '';
                      if (connectorStyle === 'straight') {
                        pathData = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
                      } else if (connectorStyle === 'elbow') {
                        pathData = `M ${source.x} ${source.y} L ${midX} ${source.y} L ${midX} ${target.y} L ${target.x} ${target.y}`;
                      } else {
                        // Curved Bézier
                        pathData = `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;
                      }

                      const isEdgeSelected = selectedEdgeId === edge.id;

                      return (
                        <g key={edge.id}>
                          {/* 1. Trilha invisível larga (28px) para clique fácil em qualquer resolução */}
                          <path
                            d={pathData}
                            stroke="transparent"
                            strokeWidth={28}
                            fill="none"
                            className="cursor-pointer pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId('');
                            }}
                          />

                          {/* 2. Halo de seleção luminoso */}
                          {isEdgeSelected && (
                            <path
                              d={pathData}
                              stroke="#818cf8"
                              strokeWidth={8}
                              strokeOpacity={0.6}
                              fill="none"
                              strokeLinecap="round"
                              className="pointer-events-none animate-pulse"
                            />
                          )}

                          {/* 3. Traço visível da conexão */}
                          <path
                            d={pathData}
                            stroke={isEdgeSelected ? '#ffffff' : edge.color || '#6366f1'}
                            strokeWidth={isEdgeSelected ? 3.5 : 2.5}
                            strokeOpacity={isEdgeSelected ? 1 : 0.8}
                            strokeDasharray={isEdgeSelected ? '6 3' : undefined}
                            fill="none"
                            strokeLinecap="round"
                            className="cursor-pointer pointer-events-auto hover:stroke-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEdgeId(edge.id);
                              setSelectedNodeId('');
                            }}
                          />

                          {/* 4. Rótulo da Linha & Barra Flutuante de Exclusão da Conexão */}
                          {isEdgeSelected ? (
                            <foreignObject
                              x={midX - 110}
                              y={midY - 22}
                              width={220}
                              height={44}
                              className="overflow-visible pointer-events-auto z-40"
                            >
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded-2xl bg-slate-900 border-2 border-indigo-400 shadow-2xl flex items-center gap-1.5 backdrop-blur-2xl ring-4 ring-indigo-500/25"
                              >
                                <input
                                  type="text"
                                  placeholder="Rótulo da linha..."
                                  value={edge.label || ''}
                                  onChange={(e) =>
                                    handleUpdateEdgeLabel(edge.sourceId, edge.targetId, e.target.value)
                                  }
                                  className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-[11px] font-bold text-white focus:outline-none focus:border-indigo-400 flex-1 min-w-0"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDisconnect(edge.sourceId, edge.targetId);
                                  }}
                                  className="px-2 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 transition shadow shrink-0"
                                  title="Excluir somente esta conexão (ou pressione Del)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Excluir</span>
                                </button>
                              </div>
                            </foreignObject>
                          ) : edge.label ? (
                            <foreignObject
                              x={midX - 60}
                              y={midY - 14}
                              width={120}
                              height={28}
                              className="overflow-visible pointer-events-auto"
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEdgeId(edge.id);
                                  setSelectedNodeId('');
                                }}
                                className="px-2 py-0.5 rounded-lg bg-slate-900/95 border border-slate-700/80 text-[10px] font-bold text-slate-300 shadow cursor-pointer hover:border-indigo-400 hover:text-white transition text-center truncate backdrop-blur-md"
                                title="Clique para selecionar e editar esta conexão"
                              >
                                {edge.label}
                              </div>
                            </foreignObject>
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Caixa de Seleção por Arraste (Marquee Drag Selection) */}
                  {marqueeBox && (
                    <div
                      style={{
                        left: Math.min(marqueeBox.startX, marqueeBox.currentX),
                        top: Math.min(marqueeBox.startY, marqueeBox.currentY),
                        width: Math.abs(marqueeBox.currentX - marqueeBox.startX),
                        height: Math.abs(marqueeBox.currentY - marqueeBox.startY),
                      }}
                      className="absolute border-2 border-indigo-500 bg-indigo-500/20 rounded pointer-events-none z-50 backdrop-blur-[0.5px]"
                    />
                  )}

                  {/* Elementos e Formas do Quadro Branco (exceto desenhos SVG) */}
                  {selectedMap.nodes
                    .filter((n) => n.shape !== 'drawing')
                    .map((node) => {
                    const isSelected = node.id === selectedNode?.id;
                    const shape: LucidShapeType = node.shape || 'cloud';

                    return (
                      <div
                        key={node.id}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (connectingFromNodeId && connectingFromNodeId !== node.id) {
                            handleConnectNodes(connectingFromNodeId, node.id);
                          } else {
                            setSelectedNodeId(node.id);
                            setSelectedEdgeId(null);
                            setDraggingNodeId(node.id);
                          }
                        }}
                        style={{
                          left: `${node.x}px`,
                          top: `${node.y}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className={`group absolute cursor-grab active:cursor-grabbing transition-transform ${
                          connectingFromNodeId && connectingFromNodeId !== node.id
                            ? 'ring-4 ring-indigo-400 animate-pulse cursor-pointer'
                            : ''
                        }`}
                      >
                        {/* 4 Âncoras de Conexão Livre (Top, Right, Bottom, Left) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (connectingFromNodeId && connectingFromNodeId !== node.id) {
                              handleConnectNodes(connectingFromNodeId, node.id);
                            } else {
                              setConnectingFromNodeId(node.id);
                              showToast('Modo Conectar: Clique no nó de destino.', 'info');
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-500 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center text-[10px] font-black shadow-lg cursor-pointer transition z-30"
                          title="Conectar por cima"
                        >
                          +
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (connectingFromNodeId && connectingFromNodeId !== node.id) {
                              handleConnectNodes(connectingFromNodeId, node.id);
                            } else {
                              setConnectingFromNodeId(node.id);
                              showToast('Modo Conectar: Clique no nó de destino.', 'info');
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-500 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center text-[10px] font-black shadow-lg cursor-pointer transition z-30"
                          title="Conectar pela direita"
                        >
                          +
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (connectingFromNodeId && connectingFromNodeId !== node.id) {
                              handleConnectNodes(connectingFromNodeId, node.id);
                            } else {
                              setConnectingFromNodeId(node.id);
                              showToast('Modo Conectar: Clique no nó de destino.', 'info');
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-500 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center text-[10px] font-black shadow-lg cursor-pointer transition z-30"
                          title="Conectar por baixo"
                        >
                          +
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (connectingFromNodeId && connectingFromNodeId !== node.id) {
                              handleConnectNodes(connectingFromNodeId, node.id);
                            } else {
                              setConnectingFromNodeId(node.id);
                              showToast('Modo Conectar: Clique no nó de destino.', 'info');
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-500 hover:bg-white text-white hover:text-slate-900 flex items-center justify-center text-[10px] font-black shadow-lg cursor-pointer transition z-30"
                          title="Conectar pela esquerda"
                        >
                          +
                        </div>

                        {/* Indicador de Bloqueio se o Nó estiver trancado */}
                        {node.locked && (
                          <div
                            className="absolute -top-2.5 -right-2.5 p-1 rounded-full bg-amber-500 text-slate-900 shadow-xl z-30 pointer-events-none"
                            title="Elemento bloqueado contra edição e movimentação"
                          >
                            <Lock className="w-3 h-3" />
                          </div>
                        )}

                        {/* Barra de Ações Rápidas Flutuante sobre o Nó Selecionado */}
                        {isSelected && (
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl flex items-center gap-1.5 z-40 select-none animate-in fade-in duration-100"
                          >
                            <select
                              value={shape}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id
                                    ? { ...n, shape: e.target.value as LucidShapeType }
                                    : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="text-[10px] bg-slate-950 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                              title="Alterar forma"
                            >
                              <option value="cloud">Nuvem</option>
                              <option value="capsule">Cápsula</option>
                              <option value="octagon">Octógono</option>
                              <option value="diamond">Losango</option>
                              <option value="sticky">Post-it</option>
                              <option value="rectangle">Cartão</option>
                              <option value="circle">Círculo</option>
                              <option value="text">Texto Livre</option>
                              <option value="frame">Área / Frame</option>
                            </select>

                            <input
                              type="color"
                              value={node.color}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, color: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                              title="Alterar cor"
                            />

                            {/* Bloquear / Desbloquear */}
                            <button
                              type="button"
                              onClick={() => handleToggleLock(node.id)}
                              className={`p-1 rounded transition ${
                                node.locked
                                  ? 'text-amber-400 bg-amber-400/20'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title={node.locked ? 'Desbloquear elemento' : 'Bloquear elemento'}
                            >
                              {node.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>

                            {/* Ordem de Sobreposição */}
                            <button
                              type="button"
                              onClick={() => handleReorderNode(node.id, 'forward')}
                              className="p-1 rounded text-slate-400 hover:text-white"
                              title="Trazer para frente"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderNode(node.id, 'backward')}
                              className="p-1 rounded text-slate-400 hover:text-white"
                              title="Enviar para trás"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Duplicar Elemento */}
                            <button
                              type="button"
                              onClick={handleDuplicate}
                              className="p-1 rounded text-slate-400 hover:text-white"
                              title="Duplicar elemento (Ctrl+D)"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setConnectingFromNodeId(node.id);
                                showToast('Clique no nó de destino para estabelecer a conexão.', 'info');
                              }}
                              className="p-1 rounded text-slate-400 hover:text-indigo-300"
                              title="Conectar a outro nó"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Gerenciador de conexões ativas deste nó */}
                            {(node.connections || []).length > 0 && (
                              <div className="relative group/conns">
                                <button
                                  type="button"
                                  className="flex items-center gap-1 text-[10px] text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700 hover:border-indigo-400 transition"
                                  title="Conexões ativas deste nó (clique no lixo para remover apenas a conexão)"
                                >
                                  <Link2 className="w-3 h-3 text-indigo-400" />
                                  <span>{(node.connections || []).length}</span>
                                </button>
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover/conns:flex flex-col bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl min-w-[170px] z-50 animate-in fade-in duration-100">
                                  <span className="text-[9px] uppercase font-bold text-slate-400 px-1 mb-1">
                                    Conectado com:
                                  </span>
                                  {(node.connections || []).map((conn) => {
                                    const targetNode = selectedMap.nodes.find((n) => n.id === conn.targetId);
                                    return (
                                      <div
                                        key={conn.targetId}
                                        className="flex items-center justify-between text-xs px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-200"
                                      >
                                        <span className="truncate max-w-[100px] font-medium">
                                          {targetNode?.label || 'Nó'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDisconnect(node.id, conn.targetId);
                                          }}
                                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition ml-1"
                                          title="Excluir somente esta conexão"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleAddChildNode()}
                              className="p-1 rounded text-slate-400 hover:text-emerald-400"
                              title="Adicionar nó conectado"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={handleDeleteSelectedNode}
                              className="p-1 rounded text-slate-400 hover:text-rose-400"
                              title="Excluir nó"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* FORMA 1: NUVEM (CLOUD) */}
                        {shape === 'cloud' && (
                          <div className="relative flex items-center justify-center min-w-[150px] max-w-[210px] min-h-[95px] p-6">
                            <svg
                              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible drop-shadow-xl"
                              preserveAspectRatio="none"
                              viewBox="0 0 160 100"
                            >
                              <path
                                d="M 28,75 A 20,20 0 0,1 18,38 A 26,26 0 0,1 65,16 A 35,35 0 0,1 122,20 A 24,24 0 0,1 146,48 A 20,20 0 0,1 138,76 A 16,16 0 0,1 115,86 L 45,86 A 18,18 0 0,1 28,75 Z"
                                fill={node.color}
                                stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.25)'}
                                strokeWidth={isSelected ? 3 : 1.5}
                              />
                            </svg>
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="relative z-10 bg-transparent text-white font-extrabold text-xs text-center leading-snug w-full focus:outline-none select-text"
                            />
                          </div>
                        )}

                        {/* FORMA 2: CÁPSULA (PILL) */}
                        {shape === 'capsule' && (
                          <div
                            style={{
                              backgroundColor: node.color,
                              borderColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)',
                            }}
                            className={`rounded-full px-5 py-3 border-2 shadow-2xl flex items-center justify-center min-w-[140px] max-w-[220px] text-center ${
                              isSelected ? 'ring-4 ring-white/30 scale-105' : ''
                            }`}
                          >
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="bg-transparent text-white font-bold text-xs leading-snug w-full text-center focus:outline-none select-text"
                            />
                          </div>
                        )}

                        {/* FORMA 3: OCTÓGONO */}
                        {shape === 'octagon' && (
                          <div
                            style={{
                              backgroundColor: node.color,
                              clipPath:
                                'polygon(28% 0%, 72% 0%, 100% 28%, 100% 72%, 72% 100%, 28% 100%, 0% 72%, 0% 28%)',
                              outline: isSelected ? '3px solid #ffffff' : 'none',
                            }}
                            className="w-[145px] h-[100px] shadow-2xl flex items-center justify-center p-4 text-center"
                          >
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="bg-transparent text-white font-bold text-xs leading-snug w-full text-center focus:outline-none select-text px-1"
                            />
                          </div>
                        )}

                        {/* FORMA 4: LOSANGO (DIAMOND) */}
                        {shape === 'diamond' && (
                          <div
                            style={{
                              backgroundColor: node.color,
                              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                              outline: isSelected ? '3px solid #ffffff' : 'none',
                            }}
                            className="w-[140px] h-[100px] shadow-2xl flex items-center justify-center p-5 text-center"
                          >
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="bg-transparent text-white font-bold text-[11px] leading-tight w-full text-center focus:outline-none select-text"
                            />
                          </div>
                        )}

                        {/* FORMA 5: POST-IT (STICKY NOTE) */}
                        {shape === 'sticky' && (
                          <div
                            style={{
                              backgroundColor: node.color,
                              borderColor: isSelected ? '#ffffff' : 'rgba(0,0,0,0.15)',
                            }}
                            className={`w-[145px] min-h-[115px] p-3 rounded-sm shadow-2xl flex flex-col justify-between text-left border-2 transform rotate-[-0.5deg] ${
                              isSelected ? 'ring-4 ring-amber-400/50 scale-105' : ''
                            }`}
                          >
                            <textarea
                              rows={3}
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className={`bg-transparent font-semibold text-xs leading-snug w-full resize-none focus:outline-none select-text ${
                                node.color === '#ffffff' ||
                                node.color.endsWith('8a') ||
                                node.color.endsWith('e8') ||
                                node.color.endsWith('fa')
                                  ? 'text-slate-900'
                                  : 'text-white'
                              }`}
                            />
                            {node.notes && (
                              <span
                                className={`text-[10px] truncate pt-1 opacity-75 ${
                                  node.color === '#ffffff' ||
                                  node.color.endsWith('8a') ||
                                  node.color.endsWith('e8')
                                    ? 'text-slate-700'
                                    : 'text-slate-200'
                                }`}
                              >
                                {node.notes}
                              </span>
                            )}
                          </div>
                        )}

                        {/* FORMA 6: CARTÃO (RECTANGLE) */}
                        {shape === 'rectangle' && (
                          <div
                            style={{
                              backgroundColor: node.color,
                              borderColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.25)',
                            }}
                            className={`rounded-2xl px-4 py-3 border-2 shadow-2xl flex items-center justify-center min-w-[140px] max-w-[210px] text-center ${
                              isSelected ? 'ring-4 ring-white/30 scale-105' : ''
                            }`}
                          >
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="bg-transparent text-white font-bold text-xs leading-snug w-full text-center focus:outline-none select-text"
                            />
                          </div>
                        )}

                        {/* FORMA 7: CÍRCULO */}
                        {shape === 'circle' && (
                          <div
                            style={{
                              backgroundColor: node.color,
                              borderColor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)',
                            }}
                            className={`w-28 h-28 rounded-full border-2 shadow-2xl flex items-center justify-center p-3 text-center ${
                              isSelected ? 'ring-4 ring-white/30 scale-105' : ''
                            }`}
                          >
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="bg-transparent text-white font-bold text-xs leading-snug w-full text-center focus:outline-none select-text"
                            />
                          </div>
                        )}

                        {/* FORMA 8: TEXTO LIVRE */}
                        {shape === 'text' && (
                          <div
                            style={{
                              color: node.color && node.color !== '#1e293b' ? node.color : '#f8fafc',
                            }}
                            className={`min-w-[120px] max-w-[280px] p-2 text-left rounded-lg transition ${
                              isSelected ? 'outline-dashed outline-2 outline-indigo-400 bg-indigo-500/10' : ''
                            }`}
                          >
                            <textarea
                              rows={2}
                              value={node.label}
                              onChange={(e) => {
                                const nextNodes = selectedMap.nodes.map((n) =>
                                  n.id === node.id ? { ...n, label: e.target.value } : n
                                );
                                saveMapNodes(selectedMap.id, nextNodes);
                              }}
                              className="bg-transparent font-bold text-sm leading-snug w-full resize-none focus:outline-none select-text"
                              placeholder="Digite seu texto..."
                            />
                          </div>
                        )}

                        {/* FORMA 9: ÁREA / FRAME */}
                        {shape === 'frame' && (
                          <div
                            style={{
                              borderColor: node.color,
                              backgroundColor: `${node.color}15`,
                            }}
                            className={`w-72 min-h-[180px] rounded-3xl border-2 border-dashed p-3 flex flex-col justify-between shadow-lg backdrop-blur-xs ${
                              isSelected ? 'ring-4 ring-indigo-400/50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5 pb-2 border-b border-white/10">
                              <Scan className="w-3.5 h-3.5 text-indigo-400" />
                              <input
                                type="text"
                                value={node.label}
                                onChange={(e) => {
                                  const nextNodes = selectedMap.nodes.map((n) =>
                                    n.id === node.id ? { ...n, label: e.target.value } : n
                                  );
                                  saveMapNodes(selectedMap.id, nextNodes);
                                }}
                                className="bg-transparent text-white font-black text-xs uppercase tracking-wider w-full focus:outline-none select-text"
                              />
                            </div>
                            <div className="flex-1 flex items-center justify-center p-4">
                              <span className="text-[11px] text-slate-400/60 font-medium italic pointer-events-none">
                                Área de organização (Frame)
                              </span>
                            </div>
                          </div>
                        )}

                        {/* FORMA 10: IMAGEM LOCAL */}
                        {shape === 'image' && (
                          <div
                            className={`rounded-2xl overflow-hidden shadow-2xl border-2 max-w-[280px] bg-slate-900 ${
                              isSelected ? 'border-white ring-4 ring-indigo-400/50' : 'border-slate-700'
                            }`}
                          >
                            {node.imageUrl ? (
                              <img
                                src={node.imageUrl}
                                alt={node.label}
                                className="w-full max-h-56 object-contain pointer-events-none select-none bg-slate-950"
                              />
                            ) : (
                              <div className="w-48 h-32 flex items-center justify-center text-slate-500">
                                <ImageIcon className="w-8 h-8" />
                              </div>
                            )}
                            <div className="p-2 bg-slate-900/90 text-center">
                              <input
                                type="text"
                                value={node.label}
                                onChange={(e) => {
                                  const nextNodes = selectedMap.nodes.map((n) =>
                                    n.id === node.id ? { ...n, label: e.target.value } : n
                                  );
                                  saveMapNodes(selectedMap.id, nextNodes);
                                }}
                                className="bg-transparent text-white text-xs font-semibold text-center w-full focus:outline-none select-text"
                              />
                            </div>
                          </div>
                        )}

                        {/* FORMA 11: CARIMBO DE REAÇÃO (STAMP) */}
                        {shape === 'stamp' && (
                          <div
                            style={{ backgroundColor: node.color || '#f59e0b' }}
                            className={`p-3.5 rounded-2xl shadow-xl flex items-center justify-center transition-transform cursor-pointer ${
                              isSelected ? 'ring-4 ring-white/60 scale-110' : 'hover:scale-105'
                            }`}
                            title={`Carimbo: ${node.label}`}
                          >
                            {node.label === 'check' && <Check className="w-6 h-6 text-white stroke-[3]" />}
                            {node.label === 'star' && <Star className="w-6 h-6 text-white fill-white" />}
                            {node.label === 'flame' && <Flame className="w-6 h-6 text-white" />}
                            {node.label === 'bulb' && <Sparkles className="w-6 h-6 text-white" />}
                            {node.label === 'heart' && <Heart className="w-6 h-6 text-white fill-white" />}
                            {node.label === 'alert' && <AlertCircle className="w-6 h-6 text-white" />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Controles Flutuantes Inferiores (Zoom, Outline, Atalhos) */}
              <div className="absolute right-4 bottom-4 z-20 flex items-center gap-1.5 bg-slate-900/95 border border-white/[0.08] rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setLucidOutlineOpen((v) => !v)}
                  className={`p-2 rounded-xl transition ${
                    lucidOutlineOpen ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Estrutura de Ideias (Outline)"
                >
                  <ListTree className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))}
                  className="p-2 rounded-xl text-slate-400 hover:text-white transition"
                  title="Afastar (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <span
                  onClick={() => {
                    setZoom(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="px-2 py-1 text-xs font-mono font-bold text-slate-200 cursor-pointer hover:text-indigo-400 select-none"
                  title="Resetar 100%"
                >
                  {Math.round(zoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(2))))}
                  className="p-2 rounded-xl text-slate-400 hover:text-white transition"
                  title="Aproximar (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white transition"
                  title="Centralizar Visualização"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    showToast(
                      'Dicas: Clique duas vezes no canvas para criar livremente. Clique nos pontos nas bordas dos nós para conectá-los.',
                      'info'
                    );
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white transition"
                  title="Dicas de Uso"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Gaveta de Outline Retrátil */}
              {lucidOutlineOpen && (
                <div className="absolute right-4 top-16 bottom-16 z-30 w-72 bg-slate-900/98 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl flex flex-col select-none animate-in fade-in slide-in-from-right-4 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <ListTree className="w-4 h-4 text-indigo-400" />
                      <span>Estrutura do Quadro ({selectedMap.nodes.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setLucidOutlineOpen(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 custom-scrollbar pr-1">
                    {selectedMap.nodes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => setSelectedNodeId(n.id)}
                        className={`p-2 rounded-xl flex items-center justify-between cursor-pointer text-xs font-bold transition ${
                          n.id === selectedNode?.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-950/70 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: n.color }}
                          />
                          <span className="truncate">{n.label}</span>
                        </div>
                        <span className="text-[10px] opacity-75 shrink-0 uppercase font-mono">
                          {n.shape || 'cloud'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          ABA 3: COFRE DE SENHAS CRIPTOGRAFADO (AES-256)
         ========================================================= */}
      {activeTool === 'vault' && (
        <div className="space-y-4">
          {/* Security Banner & Top Controls */}
          <div className="p-4 rounded-3xl bg-slate-900/85 border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Cofre Local Criptografado (AES-256-GCM)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Suas senhas são embaralhadas com criptografia militar no seu computador e nunca ficam expostas em texto puro.
                </p>
              </div>
            </div>

            <button
              onClick={() =>
                setEditingVault({
                  title: '',
                  category: 'bancos',
                  username: '',
                  password: '',
                  url: '',
                  notes: '',
                  favorite: false,
                })
              }
              className="liquid-glass-cta px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Nova Senha</span>
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setVaultCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  vaultCategoryFilter === 'all'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todas ({vaultItems.length})
              </button>
              {VAULT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setVaultCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    vaultCategoryFilter === cat.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar serviço ou login..."
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Modal / Form for Creating or Editing a Password */}
          {editingVault && (
            <form
              onSubmit={handleSaveVaultItem}
              className="p-5 rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>{editingVault.id ? 'Editar Credencial' : 'Guardar Nova Senha no Cofre'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingVault(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Serviço / Banco / App *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Nubank, Gov.br, Gmail..."
                    value={editingVault.title || ''}
                    onChange={(e) => setEditingVault((p) => ({ ...p, title: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Categoria</label>
                  <select
                    value={editingVault.category || 'bancos'}
                    onChange={(e) => setEditingVault((p) => ({ ...p, category: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    {VAULT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Login / E-mail / CPF
                  </label>
                  <input
                    type="text"
                    placeholder="seu@email.com ou CPF"
                    value={editingVault.username || ''}
                    onChange={(e) => setEditingVault((p) => ({ ...p, username: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Senha ou PIN *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Digite ou gere uma senha forte"
                      value={editingVault.password || ''}
                      onChange={(e) => setEditingVault((p) => ({ ...p, password: e.target.value }))}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={generateStrongPassword}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 flex items-center gap-1 shrink-0 transition"
                      title="Gerar senha aleatória de 20 caracteres"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Gerar Forte</span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Site / URL (Opcional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editingVault.url || ''}
                    onChange={(e) => setEditingVault((p) => ({ ...p, url: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Vault Credentials Grid */}
          {filteredVault.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900/60 border border-white/[0.06] text-center">
              <KeyRound className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-black text-white">Seu Cofre de Senhas está vazio</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Guarde senhas de bancos, corretoras, cartões e acessos importantes com criptografia AES-256 local.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVault.map((item) => {
                const isRevealed = Boolean(revealedIds[item.id]);
                const catObj = VAULT_CATEGORIES.find((c) => c.id === item.category) || VAULT_CATEGORIES[5];
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-900/85 border border-white/[0.07] hover:border-white/[0.15] transition flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">{catObj.label}</span>
                          <h4 className="text-sm font-black text-white mt-0.5">{item.title}</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleFavoriteVault(item)}
                          className="p-1 text-slate-500 hover:text-amber-400 transition"
                        >
                          <Star className={`w-4 h-4 ${item.favorite ? 'text-amber-400 fill-amber-400' : ''}`} />
                        </button>
                      </div>

                      {item.username && (
                        <div className="mt-3 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[9px] uppercase font-bold text-slate-500 block">
                              Usuário / Login
                            </span>
                            <span className="text-xs text-slate-200 truncate block">{item.username}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.username, 'Login')}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                            title="Copiar login"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="mt-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-slate-500 block">
                            Senha Criptografada
                          </span>
                          <span className="text-xs font-mono text-emerald-300 truncate block">
                            {isRevealed ? item.password : '••••••••••••'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setRevealedIds((p) => ({ ...p, [item.id]: !p[item.id] }))}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                            title={isRevealed ? 'Ocultar senha' : 'Revelar senha'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.password, 'Senha')}
                            className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded-lg"
                            title="Copiar senha"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] text-[11px]">
                      <button
                        type="button"
                        onClick={() => setEditingVault(item)}
                        className="text-slate-400 hover:text-white font-semibold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVaultItem(item.id)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ToolsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ToolsView error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-slate-900/90 border border-slate-800 rounded-3xl max-w-lg mx-auto my-12 text-slate-200 shadow-2xl backdrop-blur-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
            <X className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">Ops! Ocorreu um problema ao carregar as Ferramentas.</h3>
          <p className="text-xs text-slate-400 mb-5 font-mono bg-slate-950/80 p-2.5 rounded-xl border border-white/5 break-words">
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ToolsView: React.FC = () => (
  <ToolsErrorBoundary>
    <ToolsViewInner />
  </ToolsErrorBoundary>
);

