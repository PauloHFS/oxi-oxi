import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { ArrowUpDown } from "lucide-react";

type ApiNodeData = {
  label: string;
};

export const ApiNode: React.FC<NodeProps<Node<ApiNodeData>>> = ({ data }) => {
  return (
    <div
      className="
      border-2 border-blue-500 bg-blue-100 p-4 rounded-md flex flex-col items-center gap-2 min-w-2"
    >
      <Handle type="target" position={Position.Left} />
      <ArrowUpDown />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
