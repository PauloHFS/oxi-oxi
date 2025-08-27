import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

type TesteNodeData = {
  label: string;
};

export const TesteNode: React.FC<NodeProps<Node<TesteNodeData>>> = ({
  data,
}) => {
  return (
    <div className="Teste-node">
      <Handle type="target" position={Position.Left} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
