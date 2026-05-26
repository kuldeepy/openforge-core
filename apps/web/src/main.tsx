import React, { useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge as FlowEdge,
  MiniMap,
  Node as FlowNode,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges
} from "reactflow";
import "reactflow/dist/style.css";
import "./styles.css";
import { Download, Play, Save, Upload, Trash2 } from "lucide-react";

type SignalType = "digital" | "analog" | "string" | "object";
type PortDirection = "input" | "output";

interface Port {
  id: string;
  name: string;
  direction: PortDirection;
  signalType: SignalType;
  required?: boolean;
}

interface WorkflowNode {
  id: string;
  templateId: string;
  metadata: { name: string; description?: string };
  position?: { x: number; y: number };
  parameters?: Record<string, unknown>;
  ports: Port[];
}

interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  signalType: SignalType;
}

interface Workflow {
  id: string;
  metadata: { name: string; description?: string };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface Project {
  id: string;
  metadata: { name: string; version?: string; description?: string };
  workflows: Workflow[];
  connectors?: Array<{ id: string; metadata: { name: string }; protocol: string; enabled: boolean; config: Record<string, unknown> }>;
  simulationScenarios?: Array<{ id: string; metadata: { name: string }; maxTicks?: number; scheduledSignals?: Array<{ tick: number; signal: RuntimeSignal }> }>;
}

interface RuntimeSignal {
  id: string;
  type: SignalType;
  value: unknown;
  timestamp: string;
  sourceNodeId?: string;
  sourcePortId?: string;
}

interface TemplateDefinition {
  id: string;
  name: string;
  category: string;
  ports: Port[];
}

const templateCatalog: TemplateDefinition[] = [
  { id: "template.digital-input", name: "Digital Input", category: "io", ports: [{ id: "out", name: "Output", direction: "output", signalType: "digital" }] },
  { id: "template.digital-output", name: "Digital Output", category: "io", ports: [{ id: "in", name: "Input", direction: "input", signalType: "digital", required: true }] },
  { id: "template.analog-input", name: "Analog Input", category: "io", ports: [{ id: "out", name: "Output", direction: "output", signalType: "analog" }] },
  { id: "template.analog-output", name: "Analog Output", category: "io", ports: [{ id: "in", name: "Input", direction: "input", signalType: "analog", required: true }] },
  { id: "template.motor", name: "Motor", category: "actuator", ports: [{ id: "run", name: "Run", direction: "input", signalType: "digital" }, { id: "fault", name: "Fault", direction: "output", signalType: "digital" }] },
  { id: "template.conveyor", name: "Conveyor", category: "actuator", ports: [{ id: "start", name: "Start", direction: "input", signalType: "digital" }, { id: "stop", name: "Stop", direction: "input", signalType: "digital" }, { id: "running", name: "Running", direction: "output", signalType: "digital" }] },
  { id: "template.alarm", name: "Alarm", category: "alarm", ports: [{ id: "trigger", name: "Trigger", direction: "input", signalType: "digital" }] },
  { id: "template.timer", name: "Timer", category: "timing", ports: [{ id: "start", name: "Start", direction: "input", signalType: "digital" }, { id: "done", name: "Done", direction: "output", signalType: "digital" }] },
  { id: "template.counter", name: "Counter", category: "timing", ports: [{ id: "count", name: "Count", direction: "input", signalType: "digital" }, { id: "done", name: "Done", direction: "output", signalType: "digital" }] },
  { id: "template.emergency-stop", name: "Emergency Stop", category: "safety", ports: [{ id: "active", name: "Active", direction: "output", signalType: "digital" }] },
  { id: "template.condition", name: "Condition Block", category: "logic", ports: [{ id: "in", name: "Input", direction: "input", signalType: "digital" }, { id: "out", name: "Output", direction: "output", signalType: "digital" }] },
  { id: "template.state-machine", name: "State Machine", category: "state-machine", ports: [{ id: "transition", name: "Transition", direction: "input", signalType: "string" }, { id: "state", name: "State", direction: "output", signalType: "string" }] }
];

function nodeToFlowNode(node: WorkflowNode): FlowNode {
  return {
    id: node.id,
    type: "default",
    position: node.position ?? { x: 0, y: 0 },
    data: {
      label: (
        <div className="of-node">
          <strong>{node.metadata.name}</strong>
          <span>{templateCatalog.find((template) => template.id === node.templateId)?.name ?? node.templateId}</span>
          <div className="of-ports">
            {node.ports.map((port) => (
              <code key={port.id}>{port.direction}:{port.id}</code>
            ))}
          </div>
        </div>
      )
    }
  };
}

function edgeToFlowEdge(edge: WorkflowEdge): FlowEdge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePortId,
    targetHandle: edge.targetPortId,
    label: edge.signalType,
    animated: false
  };
}

function flowEdgeToWorkflow(edge: FlowEdge): WorkflowEdge {
  return {
    id: edge.id,
    sourceNodeId: edge.source,
    sourcePortId: String(edge.sourceHandle ?? "out"),
    targetNodeId: edge.target,
    targetPortId: String(edge.targetHandle ?? "in"),
    signalType: "digital"
  };
}

function App() {
  const [project, setProject] = useState<Project>(() => (window as unknown as { __OPENFORGE_PROJECT__: Project }).__OPENFORGE_PROJECT__);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(project.workflows[0]?.nodes[0]?.id);
  const [events, setEvents] = useState<string[]>(["No simulation events yet."]);
  const workflow = project.workflows[0];
  const [nodes, setNodes] = useState<FlowNode[]>(() => workflow.nodes.map(nodeToFlowNode));
  const [edges, setEdges] = useState<FlowEdge[]>(() => workflow.edges.map(edgeToFlowEdge));

  const selectedNode = workflow.nodes.find((node) => node.id === selectedNodeId);
  const validation = useMemo(() => validateWorkflow(workflow), [workflow]);

  const updateProjectFromGraph = useCallback((nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
    setProject((current) => ({
      ...current,
      workflows: current.workflows.map((item, index) => index === 0
        ? {
            ...item,
            nodes: item.nodes.map((node) => {
              const flowNode = nextNodes.find((candidate) => candidate.id === node.id);
              return flowNode ? { ...node, position: flowNode.position } : node;
            }),
            edges: nextEdges.map(flowEdgeToWorkflow)
          }
        : item)
    }));
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      updateProjectFromGraph(next, edges);
      return next;
    });
  }, [edges, updateProjectFromGraph]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => {
      const next = applyEdgeChanges(changes, current);
      updateProjectFromGraph(nodes, next);
      return next;
    });
  }, [nodes, updateProjectFromGraph]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceNode = workflow.nodes.find((node) => node.id === connection.source);
    const targetNode = workflow.nodes.find((node) => node.id === connection.target);
    const sourcePort = sourceNode?.ports.find((port) => port.direction === "output") ?? sourceNode?.ports[0];
    const targetPort = targetNode?.ports.find((port) => port.direction === "input") ?? targetNode?.ports[0];
    if (!sourcePort || !targetPort || sourcePort.signalType !== targetPort.signalType) {
      setEvents(["Connection rejected: incompatible or missing ports."]);
      return;
    }
    const newEdge: FlowEdge = {
      id: `edge.${connection.source}.${connection.target}.${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: sourcePort.id,
      targetHandle: targetPort.id,
      label: sourcePort.signalType
    };
    setEdges((current) => {
      const next = addEdge(newEdge, current);
      updateProjectFromGraph(nodes, next);
      return next;
    });
  }, [nodes, updateProjectFromGraph, workflow.nodes]);

  function addTemplate(template: TemplateDefinition) {
    const node: WorkflowNode = {
      id: `node.${template.name.toLowerCase().replaceAll(" ", "-")}.${Date.now()}`,
      templateId: template.id,
      metadata: { name: template.name },
      position: { x: 120 + workflow.nodes.length * 28, y: 120 + workflow.nodes.length * 28 },
      ports: template.ports
    };
    setProject((current) => ({ ...current, workflows: [{ ...workflow, nodes: [...workflow.nodes, node] }] }));
    setNodes((current) => [...current, nodeToFlowNode(node)]);
    setSelectedNodeId(node.id);
  }

  function deleteSelected() {
    if (!selectedNodeId) return;
    const nextNodes = nodes.filter((node) => node.id !== selectedNodeId);
    const nextEdges = edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setProject((current) => ({
      ...current,
      workflows: [{ ...workflow, nodes: workflow.nodes.filter((node) => node.id !== selectedNodeId), edges: nextEdges.map(flowEdgeToWorkflow) }]
    }));
    setSelectedNodeId(nextNodes[0]?.id);
  }

  function runSimulation() {
    const scenario = project.simulationScenarios?.[0];
    const lines = (scenario?.scheduledSignals ?? []).flatMap((entry) => {
      const signal = entry.signal;
      const outgoing = workflow.edges.filter((edge) => edge.sourceNodeId === signal.sourceNodeId && edge.sourcePortId === signal.sourcePortId);
      return [`tick ${entry.tick}: ${signal.sourceNodeId}.${signal.sourcePortId} = ${String(signal.value)}`, ...outgoing.map((edge) => `tick ${entry.tick}: propagate ${edge.sourceNodeId}.${edge.sourcePortId} -> ${edge.targetNodeId}.${edge.targetPortId}`)];
    });
    setEvents(lines.length ? lines : ["No scheduled signals in scenario."]);
  }

  async function saveProject() {
    const response = await fetch("/api/projects/conveyor-demo", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project, null, 2)
    }).catch(() => undefined);
    setEvents([response?.ok ? "Project saved through backend API." : "Backend save unavailable; use Export for local JSON."]);
  }

  function exportProject() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`${JSON.stringify(project, null, 2)}\n`], { type: "application/json" }));
    link.download = `${project.id}.json`;
    link.click();
  }

  async function importProject(file: File) {
    const imported = JSON.parse(await file.text()) as Project;
    setProject(imported);
    setSelectedNodeId(imported.workflows[0]?.nodes[0]?.id);
    setNodes(imported.workflows[0].nodes.map(nodeToFlowNode));
    setEdges(imported.workflows[0].edges.map(edgeToFlowEdge));
    setEvents(["Imported project JSON."]);
  }

  return (
    <main className="of-shell">
      <aside className="of-sidebar">
        <h1>OpenForge Core</h1>
        <p>{project.metadata.description}</p>
        <section>
          <h2>Templates</h2>
          <div className="of-template-list">
            {templateCatalog.map((template) => (
              <button key={template.id} onClick={() => addTemplate(template)}>
                <strong>{template.name}</strong>
                <span>{template.category}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
      <section className="of-main">
        <header className="of-toolbar">
          <div>
            <strong>{workflow.metadata.name}</strong>
            <span>{nodes.length} nodes · {edges.length} edges</span>
          </div>
          <div className="of-actions">
            <button onClick={runSimulation}><Play size={16} /> Run</button>
            <button onClick={saveProject}><Save size={16} /> Save</button>
            <button onClick={exportProject}><Download size={16} /> Export</button>
            <label>
              <Upload size={16} /> Import
              <input type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && importProject(event.target.files[0])} />
            </label>
            <button onClick={deleteSelected}><Trash2 size={16} /> Delete</button>
          </div>
        </header>
        <div className="of-layout">
          <section className="of-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </section>
          <aside className="of-inspector">
            <section>
              <h2>Validation</h2>
              <ul>{validation.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <h2>Inspector</h2>
              <pre>{JSON.stringify(selectedNode, null, 2)}</pre>
            </section>
            <section>
              <h2>Timeline</h2>
              <ol>{events.map((event) => <li key={event}>{event}</li>)}</ol>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function validateWorkflow(workflow: Workflow): string[] {
  const issues: string[] = [];
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.sourceNodeId)) issues.push(`${edge.id} has missing source node.`);
    if (!nodeIds.has(edge.targetNodeId)) issues.push(`${edge.id} has missing target node.`);
  }
  for (const node of workflow.nodes) {
    const template = templateCatalog.find((item) => item.id === node.templateId);
    if (!template) issues.push(`${node.metadata.name} has unknown template ${node.templateId}.`);
  }
  return issues.length ? issues : ["Workflow passes schema-level editor validation."];
}

async function loadInitialProject(): Promise<Project> {
  const response = await fetch("/api/projects/conveyor-demo").catch(() => undefined);
  if (response?.ok) return response.json();
  return fetch("/workflow.json").then((item) => item.json());
}

loadInitialProject().then((project) => {
  (window as unknown as { __OPENFORGE_PROJECT__: Project }).__OPENFORGE_PROJECT__ = project;
  createRoot(document.getElementById("root")!).render(<App />);
});
