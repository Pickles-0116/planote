/**
 * PlanTreeView - 计划树形列表视图
 *
 * v1.4-Organize F4.1：基于 parentPlanId/childPlanIds 展示层级关系。
 * - 有子计划的节点显示展开/折叠箭头
 * - 每级缩进 24px，最大 4 级
 * - 无父计划的计划显示在根级
 * - 循环引用安全处理（检测并断开）
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { Plan } from '@/types/domain';
import { cn } from '@/lib/utils';

interface PlanTreeViewProps {
  plans: Plan[];
}

interface TreeNode {
  plan: Plan;
  children: TreeNode[];
  depth: number;
}

/** 构建树形结构（检测循环引用）。 */
function buildTree(plans: Plan[]): TreeNode[] {
  const planMap = new Map(plans.map(p => [p.id, p]));
  const visited = new Set<string>();

  function buildNode(plan: Plan, depth: number): TreeNode {
    visited.add(plan.id);
    const children: TreeNode[] = [];
    for (const childId of plan.childPlanIds) {
      if (visited.has(childId)) continue; // 循环引用检测
      const child = planMap.get(childId);
      if (!child) continue; // 子计划不存在
      children.push(buildNode(child, Math.min(depth + 1, 4)));
    }
    return { plan, children, depth };
  }

  // 根节点：无父计划或父计划不存在
  const roots: TreeNode[] = [];
  for (const plan of plans) {
    if (visited.has(plan.id)) continue;
    if (!plan.parentPlanId || !planMap.has(plan.parentPlanId)) {
      roots.push(buildNode(plan, 0));
    }
  }

  return roots;
}

/** 树节点组件。 */
function TreeNodeItem({ node, expanded, onToggle }: {
  node: TreeNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const navigate = useNavigate();
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.plan.id);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition',
          'text-sm'
        )}
        style={{ paddingLeft: `${node.depth * 24 + 12}px` }}
        onClick={() => navigate(`/plans/${node.plan.id}`)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-stone-200 dark:hover:bg-stone-700"
            onClick={(e) => { e.stopPropagation(); onToggle(node.plan.id); }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="flex-1 truncate text-brand-900 dark:text-stone-100 font-medium">
          {node.plan.title}
        </span>
        <span className="text-xs text-brand-500 dark:text-stone-400">
          {node.plan.progress}%
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.plan.id}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlanTreeView({ plans }: PlanTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const tree = useMemo(() => buildTree(plans), [plans]);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-brand-500 dark:text-stone-400">
        暂无计划数据
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map(node => (
        <TreeNodeItem
          key={node.plan.id}
          node={node}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}