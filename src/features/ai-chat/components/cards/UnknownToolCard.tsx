/**
 * UnknownToolCard · 未知 tool 兜底卡片
 */

import { AlertTriangle } from 'lucide-react';
import CardShell from './CardShell';

interface Props {
  rawTool: string;
  rawData: unknown;
}

export default function UnknownToolCard({ rawTool, rawData }: Props): JSX.Element {
  return (
    <CardShell
      title="未实现的工具"
      icon={<AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />}
      hideActions
    >
      <div className="text-xs space-y-1">
        <p className="text-stone-500 dark:text-stone-400">
          工具 <code className="text-xs font-mono">{rawTool}</code> 未实现
        </p>
        <pre className="text-xs bg-stone-100 dark:bg-stone-800 rounded p-2 overflow-x-auto scrollbar-thin">
          {JSON.stringify(rawData, null, 2)}
        </pre>
      </div>
    </CardShell>
  );
}