import React, { useMemo, useState, useCallback } from 'react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { motion } from 'framer-motion';

// Custom Node Component to allow Framer Motion glows
const CustomNode = ({ data }: any) => {
  return (
    <div className={`px-4 py-2 rounded-lg border shadow-lg backdrop-blur-md transition-all
      ${data.type === 'category' ? 'bg-[hsl(var(--card))] border-[hsl(var(--primary))]' : 
        data.type === 'domain' ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))]' : 
        'bg-[hsl(var(--muted))] border-[hsl(var(--border))]'}`}
      style={{
        boxShadow: data.glow ? `0 0 ${data.glow * 20}px hsl(var(--primary) / ${data.glow})` : 'none',
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="flex flex-col items-center">
        <div className="font-bold text-[hsl(var(--foreground))] text-sm">{data.label}</div>
        {data.progress !== undefined && (
          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            {Math.round(data.progress * 100)}%
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

export function ExecutionTree() {
  const categories = useLiveQuery(() => db.categories.toArray());
  const domains = useLiveQuery(() => db.domains.toArray());
  const subjects = useLiveQuery(() => db.subjects.toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Generate nodes and edges
  useMemo(() => {
    if (!categories || !domains || !subjects || !tasks) return;

    const newNodes: any[] = [];
    const newEdges: any[] = [];
    
    // Naive horizontal layout logic
    let yCategory = 50;
    
    categories.forEach((cat, cIdx) => {
      newNodes.push({
        id: cat.id,
        type: 'custom',
        position: { x: cIdx * 300, y: yCategory },
        data: { label: cat.title, type: 'category', glow: 0.8 }
      });
      
      const catDomains = domains.filter(d => d.categoryId === cat.id);
      catDomains.forEach((dom, dIdx) => {
        const domX = (cIdx * 300) + (dIdx * 150) - ((catDomains.length * 150) / 2);
        newNodes.push({
          id: dom.id,
          type: 'custom',
          position: { x: domX, y: yCategory + 150 },
          data: { label: dom.title, type: 'domain', glow: 0.5 }
        });
        
        newEdges.push({
          id: `e-${cat.id}-${dom.id}`,
          source: cat.id,
          target: dom.id,
          animated: true,
          style: { stroke: 'hsl(var(--primary))', opacity: 0.5 }
        });
        
        const domSubjects = subjects.filter(s => s.domainId === dom.id);
        domSubjects.forEach((sub, sIdx) => {
          const subTasks = tasks.filter(t => t.subjectId === sub.id && t.type === 'task');
          const completed = subTasks.filter(t => t.completed).length;
          const progress = subTasks.length > 0 ? completed / subTasks.length : 0;
          
          const subX = domX + (sIdx * 120) - ((domSubjects.length * 120) / 2);
          
          newNodes.push({
            id: sub.id,
            type: 'custom',
            position: { x: subX, y: yCategory + 300 },
            data: { label: sub.title, type: 'subject', progress, glow: progress }
          });
          
          newEdges.push({
            id: `e-${dom.id}-${sub.id}`,
            source: dom.id,
            target: sub.id,
            animated: progress > 0,
            style: { 
              stroke: 'hsl(var(--primary))', 
              opacity: progress > 0 ? progress : 0.2,
              strokeWidth: progress > 0 ? 1 + progress * 2 : 1
            }
          });
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [categories, domains, subjects, tasks, setNodes, setEdges]);

  return (
    <div className="w-full h-[60vh] rounded-3xl overflow-hidden border border-[hsl(var(--border))] shadow-inner bg-[hsl(var(--background))] relative z-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[hsl(var(--background))]"
      >
        <Background color="hsl(var(--border))" gap={16} />
        <Controls className="fill-[hsl(var(--foreground))] text-[hsl(var(--foreground))] bg-[hsl(var(--card))]" />
      </ReactFlow>
    </div>
  );
}
