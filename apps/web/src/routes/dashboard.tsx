import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TesteNode } from "@/components/nodes/test";

const nodeTypes = {
  testeNode: TesteNode,
};

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

const initialNodes = [
  {
    id: "n1",
    type: "testeNode",
    position: { x: 0, y: 0 },
    data: { label: "Node 1" },
  },
  {
    id: "n2",
    type: "testeNode",
    position: { x: 100, y: 100 },
    data: { label: "Node 2" },
  },
];
const initialEdges = [{ id: "n1-n2", source: "n1", target: "n2" }];

function RouteComponent() {
  const { data: session, isPending } = authClient.useSession();

  const navigate = Route.useNavigate();

  const privateData = useQuery(trpc.privateData.queryOptions());

  useEffect(() => {
    if (!session && !isPending) {
      navigate({
        to: "/login",
      });
    }
  }, [session, isPending]);

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback(
    (changes) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );
  const onConnect = useCallback(
    (params) => setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
  );

  if (isPending) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session?.user.name}</p>
      <p>privateData: {privateData.data?.message}</p>
      <div style={{ width: "75dvw", height: "75dvh" }}>
        <ReactFlow
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        />
      </div>
    </div>
  );
}
