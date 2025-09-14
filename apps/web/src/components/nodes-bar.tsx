import { useDnD } from "@/contexts/DnDContext";
import React from "react";

export const NodesBar = () => {
  const [_, setType] = useDnD();

  const onDragStart = (event, nodeType) => {
    setType(nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside>
      <div
        className="dndnode input"
        onDragStart={(event) => onDragStart(event, "WebhookNode")}
        draggable
      >
        Webhook Node
      </div>
      <div
        className="dndnode"
        onDragStart={(event) => onDragStart(event, "OllamaNode")}
        draggable
      >
        Ollama Node
      </div>
      <div
        className="dndnode output"
        onDragStart={(event) => onDragStart(event, "ApiNode")}
        draggable
      >
        API Node
      </div>
    </aside>
  );
};
