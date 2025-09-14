import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { BrainCircuit } from "lucide-react";

type OllamaNodeData = {
  node_id: string;
  nome: string;
};

export const OllamaNode: React.FC<NodeProps<Node<OllamaNodeData>>> = ({
  data,
}) => {
  return (
    <div className="border-2 border-purple-500 bg-purple-100 p-4 rounded-md flex flex-col items-center gap-2 min-w-2">
      <Handle type="target" position={Position.Left} />
      <BrainCircuit />
      <span>{data.nome}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
