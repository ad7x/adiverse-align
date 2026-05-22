import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useUIStore } from '../../store';

// ─── Types ───────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  type: 'root' | 'category' | 'domain' | 'subject' | 'section' | 'task';
  name: string;
  progress: { completed: number; total: number };
  children: TreeNode[];
  x: number;
  y: number;
  radius: number;
  depth: number;
  // Navigation metadata
  parentSubjectId?: string;
  parentDomainId?: string;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
}

// ─── Deterministic hash for stable random values ─────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49271;
  return x - Math.floor(x);
}

// ─── Component ───────────────────────────────────────────────────────

export function OrganicTree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const domains = useLiveQuery(() => db.domains.orderBy('order').toArray());
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoverNode, setHoverNode] = useState<TreeNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const flatNodesRef = useRef<TreeNode[]>([]);

  // Touch tracking
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });

  const { setActiveView } = useUIStore();

  // ─── Resize ──────────────────────────────────────────────────────

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ─── Build tree (memoized, deterministic) ────────────────────────

  const tree = useMemo(() => {
    if (!categories || !domains || !subjects || !tasks) return null;

    const root: TreeNode = {
      id: 'root', type: 'root', name: 'Workspace',
      progress: { completed: 0, total: 0 },
      children: [], x: 0, y: 0, radius: 0, depth: 0
    };

    const catMap = new Map<string, TreeNode>();
    for (const c of categories) {
      const node: TreeNode = {
        id: c.id, type: 'category', name: c.title,
        progress: { completed: 0, total: 0 },
        children: [], x: 0, y: 0, radius: 0, depth: 1
      };
      catMap.set(c.id, node);
      root.children.push(node);
    }

    const domMap = new Map<string, TreeNode>();
    for (const d of domains) {
      const node: TreeNode = {
        id: d.id, type: 'domain', name: d.title,
        progress: { completed: 0, total: 0 },
        children: [], x: 0, y: 0, radius: 0, depth: 2
      };
      domMap.set(d.id, node);
      const parent = catMap.get(d.categoryId);
      if (parent) parent.children.push(node);
    }

    const subMap = new Map<string, TreeNode>();
    for (const s of subjects) {
      const node: TreeNode = {
        id: s.id, type: 'subject', name: s.title,
        progress: { completed: 0, total: 0 },
        children: [], x: 0, y: 0, radius: 0, depth: 3,
        parentSubjectId: s.id, // subject itself is its own anchor
        parentDomainId: s.domainId,
      };
      subMap.set(s.id, node);
      const parent = domMap.get(s.domainId);
      if (parent) parent.children.push(node);
    }

    const secMap = new Map<string, TreeNode>();
    const allSections = tasks.filter(t => t.type === 'section');
    for (const sec of allSections) {
      const node: TreeNode = {
        id: sec.id, type: 'section', name: sec.title || 'Section',
        progress: { completed: 0, total: 0 },
        children: [], x: 0, y: 0, radius: 0, depth: 4,
        parentSubjectId: sec.subjectId,
      };
      secMap.set(sec.id, node);
      // If the section has a parent section, it's a subsection
      if (sec.parentId && secMap.has(sec.parentId)) {
        const parentSec = secMap.get(sec.parentId)!;
        node.depth = parentSec.depth + 1;
        node.parentSubjectId = parentSec.parentSubjectId;
        parentSec.children.push(node);
      } else {
        const parent = subMap.get(sec.subjectId);
        if (parent) parent.children.push(node);
      }
    }

    const allTasks = tasks.filter(t => t.type === 'task' || t.type === 'youtube');
    for (const t of allTasks) {
      const node: TreeNode = {
        id: t.id, type: 'task', name: t.title || 'Task',
        progress: { completed: t.completed ? 1 : 0, total: 1 },
        children: [], x: 0, y: 0, radius: 0, depth: 5,
        parentSubjectId: t.subjectId,
      };
      if (t.parentId && secMap.has(t.parentId)) {
        const parent = secMap.get(t.parentId)!;
        node.depth = parent.depth + 1;
        node.parentSubjectId = parent.parentSubjectId;
        parent.children.push(node);
      } else {
        const parent = subMap.get(t.subjectId);
        if (parent) parent.children.push(node);
      }
    }

    // Bubble up progress
    const computeProgress = (node: TreeNode) => {
      if (node.children.length === 0) return;
      for (const c of node.children) computeProgress(c);
      node.progress.total = node.children.reduce((a, c) => a + c.progress.total, 0);
      node.progress.completed = node.children.reduce((a, c) => a + c.progress.completed, 0);
    };
    computeProgress(root);

    return root;
  }, [categories, domains, subjects, tasks]);

  // ─── Layout (deterministic, seeded from node IDs) ────────────────

  const layoutTree = useCallback((root: TreeNode, w: number, h: number) => {
    const trunkX = w / 2;
    const trunkY = h - 80;
    root.x = trunkX;
    root.y = trunkY;

    // Count nodes to scale trunk proportionally
    const countNodes = (n: TreeNode): number => 1 + n.children.reduce((sum, c) => sum + countNodes(c), 0);
    const totalNodes = countNodes(root);

    // Trunk top: where all category branches originate
    const sizeScale = Math.min(0.25, Math.log10(Math.max(1, totalNodes)) * 0.1);
    const trunkLength = Math.min(w, h) * (0.12 + sizeScale);
    const trunkTopX = trunkX;
    const trunkTopY = trunkY - trunkLength;
    // Store trunk top on root for drawing
    (root as TreeNode & { trunkTopX?: number; trunkTopY?: number }).trunkTopX = trunkTopX;
    (root as TreeNode & { trunkTopX?: number; trunkTopY?: number }).trunkTopY = trunkTopY;

    const flatNodes: TreeNode[] = [];

    const layout = (node: TreeNode, x: number, y: number, angle: number, spread: number, len: number) => {
      node.x = x;
      node.y = y;
      const depthSizes: Record<string, number> = { root: 16, category: 10, domain: 7, subject: 5, section: 3, task: 3 };
      node.radius = depthSizes[node.type] || 3;
      flatNodes.push(node);

      if (node.children.length === 0) return;

      const n = node.children.length;
      const childSpread = spread * 0.72;
      const childLen = len * (0.78 + seededRandom(hashStr(node.id)) * 0.08);
      const step = n > 1 ? spread / (n - 1) : 0;
      const startAngle = n > 1 ? angle - spread / 2 : angle;

      node.children.forEach((child, i) => {
        const seed = hashStr(child.id + i);
        const jitter = (seededRandom(seed) - 0.5) * 0.08;
        const childAngle = startAngle + step * i + jitter;
        const cLen = childLen * (0.92 + seededRandom(seed + 1) * 0.16);
        const nx = x + Math.cos(childAngle) * cLen;
        const ny = y + Math.sin(childAngle) * cLen;
        
        // Bias the angle for the next level upwards so branches grow up like a real tree
        // -Math.PI / 2 is straight up. We blend 40% of the actual angle and 60% of straight up.
        const nextAngle = childAngle * 0.4 + (-Math.PI / 2) * 0.6;
        layout(child, nx, ny, nextAngle, childSpread, cLen);
      });
    };

    // Layout root at trunkTop position so all branches start from trunk tip
    layout(root, trunkTopX, trunkTopY, -Math.PI / 2, Math.PI * 0.85, Math.min(w, h) * 0.22);
    // But keep root's visual position at the actual bottom
    root.x = trunkX;
    root.y = trunkY;
    flatNodesRef.current = flatNodes;
  }, []);

  // ─── Initialize particles ───────────────────────────────────────

  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        life: Math.random() * 300,
        maxLife: 300 + Math.random() * 200,
        size: 1 + Math.random() * 2
      });
    }
    particlesRef.current = particles;
  }, [dimensions.width, dimensions.height]);

  // ─── Main render loop ──────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tree) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    layoutTree(tree, dimensions.width, dimensions.height);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = dimensions.width + 'px';
    canvas.style.height = dimensions.height + 'px';

    const style = getComputedStyle(document.documentElement);
    let primaryHSL = style.getPropertyValue('--primary').trim() || '217 91% 60%';

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const t = transformRef.current;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);

      // ─── Draw glowing roots ────────────────────────────────
      const rootX = tree.x;
      const rootY = tree.y;
      const treeWithTrunk = tree as TreeNode & { trunkTopX?: number; trunkTopY?: number };
      const trunkTopX = treeWithTrunk.trunkTopX ?? rootX;
      const trunkTopY = treeWithTrunk.trunkTopY ?? rootY - 100;

      const totalNodes = flatNodesRef.current.length;
      const nodeScale = Math.min(1, Math.log10(Math.max(1, totalNodes)) / 2.5); // 0 to ~1

      const rootCount = Math.floor(7 + nodeScale * 15); // 7 to 22 root hairs
      for (let i = 0; i < rootCount; i++) {
        const seed = seededRandom(i * 37);
        const angle = Math.PI * 0.15 + (i / Math.max(1, rootCount - 1)) * Math.PI * 0.7;
        const baseLen = 40 + nodeScale * 50; 
        const len = baseLen + seed * baseLen;
        ctx.beginPath();
        ctx.moveTo(rootX, rootY);
        const ex = rootX + Math.cos(angle) * len;
        const ey = rootY + Math.sin(angle) * len;
        const cx = rootX + Math.cos(angle) * len * 0.5 + (seed - 0.5) * 20;
        const cy = rootY + Math.sin(angle) * len * 0.5;
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.strokeStyle = `hsl(${primaryHSL} / 0.25)`;
        
        const edgeFade = 1 - Math.abs(i - (rootCount - 1) / 2) / ((rootCount - 1) / 2);
        ctx.lineWidth = (3 + nodeScale * 3) * (0.4 + 0.6 * edgeFade) / t.scale;
        ctx.shadowBlur = 12 / t.scale;
        ctx.shadowColor = `hsl(${primaryHSL} / 0.4)`;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ─── Draw main trunk ──────────────────────────────────
      const trunkRatio = tree.progress.total > 0 ? tree.progress.completed / tree.progress.total : 0;
      
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      // Slight organic curve for the trunk too
      ctx.quadraticCurveTo(rootX + 15, (rootY + trunkTopY) / 2, trunkTopX, trunkTopY);
      
      // Relative width: noticeably thicker than normal branches. Scales with tree size.
      const trunkWidth = 14 + Math.min(24, Math.log10(Math.max(1, totalNodes)) * 10);
      ctx.lineWidth = trunkWidth / t.scale;
      ctx.lineCap = 'round';
      if (trunkRatio > 0.05) {
        ctx.strokeStyle = `hsl(${primaryHSL} / ${0.3 + trunkRatio * 0.5})`;
        ctx.shadowBlur = 10 * trunkRatio / t.scale;
        ctx.shadowColor = `hsl(${primaryHSL} / 0.5)`;
      } else {
        ctx.strokeStyle = 'hsl(240 5% 20%)';
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Trunk top knot — a node-like circle at the branching point
      ctx.beginPath();
      ctx.arc(trunkTopX, trunkTopY, 7, 0, Math.PI * 2);
      if (trunkRatio > 0.05) {
        ctx.fillStyle = `hsl(${primaryHSL} / ${0.4 + trunkRatio * 0.4})`;
        ctx.shadowBlur = 12 * trunkRatio;
        ctx.shadowColor = `hsl(${primaryHSL} / 0.6)`;
      } else {
        ctx.fillStyle = 'hsl(240 5% 22%)';
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // ─── Draw branches (connections) ───────────────────────
      // For root's children (categories), draw from trunkTop not from root
      const drawBranches = (node: TreeNode) => {
        const isRoot = node.type === 'root';
        const fromX = isRoot ? trunkTopX : node.x;
        const fromY = isRoot ? trunkTopY : node.y;
        for (const child of node.children) {
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);

          // Slight upward arch — quadratic bezier with control point just above midpoint
          // Very subtle: only 5% of distance above the straight line
          const dist = Math.hypot(child.x - fromX, child.y - fromY);
          const midX = (fromX + child.x) / 2;
          const midY = (fromY + child.y) / 2 - dist * 0.05;

          ctx.quadraticCurveTo(midX, midY, child.x, child.y);

          // Branch thickness in screen-space (doesn't grow on zoom)
          const thickness = Math.max(0.8, 13 - child.depth * 2.0);
          ctx.lineWidth = thickness / t.scale;
          ctx.lineCap = 'round';

          // Color based on progress
          const ratio = node.progress.total > 0 ? node.progress.completed / node.progress.total : 0;
          if (ratio > 0.05) {
            ctx.strokeStyle = `hsl(${primaryHSL} / ${0.15 + ratio * 0.55})`;
            ctx.shadowBlur = 6 * ratio / t.scale;
            ctx.shadowColor = `hsl(${primaryHSL} / 0.5)`;
          } else {
            ctx.strokeStyle = 'hsl(240 5% 18%)';
            ctx.shadowBlur = 0;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

          drawBranches(child);
        }
      };
      drawBranches(tree);


      // ─── Draw nodes (LOD: skip deep nodes when zoomed out) ─
      const zoomThreshold = t.scale;
      const drawNodes = (node: TreeNode) => {
        // LOD: at low zoom, only show category/domain level
        if (zoomThreshold < 0.5 && node.depth > 2) return;
        if (zoomThreshold < 0.8 && node.depth > 3) return;
        if (zoomThreshold < 1.2 && node.depth > 4) return;

        const r = node.radius / Math.max(0.5, t.scale * 0.7);
        const ratio = node.progress.total > 0 ? node.progress.completed / node.progress.total : 0;

        if (node.type === 'task') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(2, r * 0.7), 0, Math.PI * 2);
          if (ratio > 0) {
            // Completed = glowing leaf
            const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 1.5);
            grad.addColorStop(0, `hsl(${primaryHSL})`);
            grad.addColorStop(1, `hsl(${primaryHSL} / 0)`);
            ctx.fillStyle = `hsl(${primaryHSL})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `hsl(${primaryHSL})`;
            ctx.fill();
            ctx.shadowBlur = 0;
            // Glow halo
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `hsl(${primaryHSL} / 0.08)`;
            ctx.fill();
          } else {
            // Incomplete = dim
            ctx.fillStyle = 'hsl(240 5% 20%)';
            ctx.fill();
          }
        } else if (node.type !== 'root') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

          if (ratio > 0) {
            ctx.fillStyle = `hsl(${primaryHSL} / ${0.25 + ratio * 0.5})`;
            ctx.shadowBlur = 8 * ratio;
            ctx.shadowColor = `hsl(${primaryHSL} / 0.5)`;
          } else {
            ctx.fillStyle = 'hsl(240 5% 15%)';
          }
          ctx.fill();
          ctx.shadowBlur = 0;

          // Show name label at sufficient zoom
          if (t.scale > 0.8 && node.depth <= 3) {
            ctx.fillStyle = `hsl(0 0% ${60 + ratio * 30}%)`;
            ctx.font = `${Math.max(9, 12 - node.depth)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(node.name.substring(0, 20), node.x, node.y - r - 6);
          }
        }

        for (const c of node.children) drawNodes(c);
      };
      drawNodes(tree);

      // ─── Draw firefly particles ────────────────────────────
      ctx.restore(); // Back to screen coords for particles
      const particles = particlesRef.current;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life > p.maxLife || p.y < 0 || p.x < 0 || p.x > dimensions.width) {
          p.x = Math.random() * dimensions.width;
          p.y = dimensions.height + 10;
          p.life = 0;
          p.vx = (Math.random() - 0.5) * 0.3;
          p.vy = -Math.random() * 0.4 - 0.1;
        }
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(45 90% 65% / ${alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsl(45 90% 65% / ${alpha * 0.5})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [tree, dimensions, layoutTree]);

  // ─── Native wheel handler (non-passive, canvas-only zoom) ──────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const t = transformRef.current;
      const newScale = Math.max(0.15, Math.min(t.scale * factor, 6));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      transformRef.current = {
        scale: newScale,
        x: mx - (mx - t.x) * (newScale / t.scale),
        y: my - (my - t.y) * (newScale / t.scale),
      };
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ─── Pointer events for pan + hit-test ─────────────────────────

  const dragged = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    isDragging.current = true;
    dragged.current = false;
    const t = transformRef.current;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.hypot(dx, dy) > 5) {
        dragged.current = true;
      }
      transformRef.current = {
        ...transformRef.current,
        x: dragStart.current.tx + dx,
        y: dragStart.current.ty + dy,
      };
      setHoverNode(null);
    } else {
      // Hit-test: find nearest node under cursor
      const t = transformRef.current;
      const cx = ((e.clientX - (rect?.left || 0)) - t.x) / t.scale;
      const cy = ((e.clientY - (rect?.top || 0)) - t.y) / t.scale;

      let closest: TreeNode | null = null;
      let closestDist = Infinity;
      for (const node of flatNodesRef.current) {
        const dist = Math.hypot(node.x - cx, node.y - cy);
        const hitRadius = Math.max(node.radius * 2, 15 / t.scale);
        if (dist < hitRadius && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }
      setHoverNode(closest);
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleNodeClick = useCallback((e: React.MouseEvent) => {
    if (dragged.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const t = transformRef.current;
    const cx = (e.clientX - rect.left - t.x) / t.scale;
    const cy = (e.clientY - rect.top - t.y) / t.scale;

    let closest: TreeNode | null = null;
    let closestDist = Infinity;
    for (const node of flatNodesRef.current) {
      const dist = Math.hypot(node.x - cx, node.y - cy);
      const hitRadius = Math.max(node.radius * 2.5, 24 / t.scale);
      if (dist < hitRadius && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    }

    if (!closest) return;

    if (closest.type === 'subject') {
      setActiveView({ type: 'subject', subjectId: closest.id });
    } else if ((closest.type === 'task' || closest.type === 'section') && closest.parentSubjectId) {
      // Navigate to the subject that contains this task/section
      setActiveView({ type: 'subject', subjectId: closest.parentSubjectId });
    } else if (closest.type === 'domain' && closest.parentDomainId) {
      // Navigate to home (domain-level nav not yet in router — open first subject of domain)
      setActiveView({ type: 'home' });
    } else if (closest.type === 'category') {
      setActiveView({ type: 'home' });
    }
  }, [setActiveView]);

  // ─── Touch events for mobile (two-finger zoom/pan) ─────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      dragged.current = false;
      if (e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        lastTouchDist.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        lastTouchCenter.current = {
          x: (a.clientX + b.clientX) / 2,
          y: (a.clientY + b.clientY) / 2
        };
      } else if (e.touches.length === 1) {
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: 0, ty: 0 };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        dragged.current = true;
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const center = {
          x: (a.clientX + b.clientX) / 2,
          y: (a.clientY + b.clientY) / 2
        };

        const t = transformRef.current;
        const rect = el.getBoundingClientRect();

        // Pinch zoom
        if (lastTouchDist.current > 0) {
          const factor = dist / lastTouchDist.current;
          const newScale = Math.max(0.15, Math.min(t.scale * factor, 6));
          const mx = center.x - rect.left;
          const my = center.y - rect.top;
          transformRef.current = {
            scale: newScale,
            x: mx - (mx - t.x) * (newScale / t.scale) + (center.x - lastTouchCenter.current.x),
            y: my - (my - t.y) * (newScale / t.scale) + (center.y - lastTouchCenter.current.y),
          };
        }

        lastTouchDist.current = dist;
        lastTouchCenter.current = center;
      } else if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        if (Math.hypot(dx, dy) > 8) {
          dragged.current = true;
        }
      }
    };

    const onTouchEnd = () => {
      lastTouchDist.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="w-full h-[100vh] relative bg-[hsl(var(--background))] overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleNodeClick}
      style={{
        cursor: isDragging.current ? 'grabbing' : (hoverNode ? 'pointer' : 'grab'),
        touchAction: 'pan-y'
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
      />
      {hoverNode && hoverNode.type !== 'root' && (
        <div
          className="absolute z-10 pointer-events-none bg-[hsl(var(--card)/0.92)] backdrop-blur-md border border-[hsl(var(--border))] rounded-xl px-4 py-3 shadow-xl"
          style={{
            left: Math.min(mousePos.x + 16, dimensions.width - 200),
            top: Math.max(mousePos.y - 40, 8),
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] font-semibold">
            {hoverNode.type}
          </div>
          <div className="font-semibold text-sm text-[hsl(var(--foreground))] mt-0.5 max-w-[180px] truncate">
            {hoverNode.name}
          </div>
          {hoverNode.progress.total > 0 && (
            <div className="text-xs font-mono mt-1 text-[hsl(var(--primary))]">
              {hoverNode.progress.completed} / {hoverNode.progress.total} ({Math.round((hoverNode.progress.completed / hoverNode.progress.total) * 100)}%)
            </div>
          )}
        </div>
      )}
    </div>
  );
}