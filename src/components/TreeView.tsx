import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';

export interface TreeNodeData {
  id: string | number;
  name: string;
  type?: 'pasta' | 'documento';
  children?: TreeNodeData[];
}

interface TreeViewProps {
  data: TreeNodeData[];
  onSelectNode?: (item: TreeNodeData) => void;
}

const TreeNode: React.FC<{ item: TreeNodeData; onSelectNode?: (item: TreeNodeData) => void }> = ({
  item,
  onSelectNode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = Boolean(item.children && item.children.length > 0);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="select-none text-sm">
      <div
        onClick={() => onSelectNode && onSelectNode(item)}
        className="flex items-center py-1.5 px-2 rounded hover:bg-gray-100 cursor-pointer text-gray-700 transition-colors"
      >
        <button
          onClick={toggleOpen}
          className={`p-0.5 rounded hover:bg-gray-200 mr-1 text-gray-400 ${
            !hasChildren ? 'opacity-0 cursor-default' : ''
          }`}
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {hasChildren || item.type === 'pasta' ? (
          isOpen ? (
            <FolderOpen className="w-4 h-4 text-blue-500 mr-2 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-blue-500 mr-2 shrink-0" />
          )
        ) : (
          <FileText className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
        )}

        <span className="font-medium truncate">{item.name}</span>
      </div>

      {hasChildren && isOpen && (
        <div className="pl-6 border-l border-gray-200 ml-3">
          {item.children?.map((child) => (
            <TreeNode key={child.id} item={child} onSelectNode={onSelectNode} />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeView: React.FC<TreeViewProps> = ({ data, onSelectNode }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto">
      <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-3">
        Estrutura do Acervo
      </h3>
      {data && data.length > 0 ? (
        data.map((node) => (
          <TreeNode key={node.id} item={node} onSelectNode={onSelectNode} />
        ))
      ) : (
        <p className="text-gray-400 text-sm italic">Nenhum item para exibir na árvore.</p>
      )}
    </div>
  );
};