import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Webhook } from "lucide-react";

type WebhookNodeData = {
  label: string;
};

export const WebhookNode: React.FC<NodeProps<Node<WebhookNodeData>>> = ({
  data,
}) => {
  return (
    <div className="border-2 border-green-500 bg-green-100 p-4 rounded-md flex flex-col items-center gap-2 min-w-2">
      <Webhook />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
