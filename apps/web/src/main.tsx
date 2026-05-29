import React, { DragEvent, memo, useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge as FlowEdge,
  EdgeChange,
  Handle,
  MiniMap,
  Node as FlowNode,
  NodeChange,
  NodeProps,
  Position,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import "./styles.css";
import {
  CircleStop,
  Download,
  FileJson,
  GitBranch,
  LayoutDashboard,
  ListFilter,
  Play,
  Save,
  SearchCheck,
  Workflow as WorkflowIcon,
  ZoomIn
} from "lucide-react";
import type { ConnectionProfile, ExecutionRun, NodeDefinition, Project, RuntimeLogEntry, ValidationIssue, Workflow, WorkflowNode } from "@openforge/schema";
import { SimulationRunner, validateWorkflow } from "@openforge/runtime";
import { TemplateRegistry, coreTemplates } from "@openforge/templates";

const registry = new TemplateRegistry(coreTemplates);
const nodeTypes = { industrial: memo(IndustrialNode) };
type BottomTab = "validation" | "logs" | "history" | "diagnostics" | "json";
type ContextMenu = { x: number; y: number; nodeId?: string } | undefined;
type MenuId = "file" | "edit" | "view" | "run" | "tools" | "help";

const paletteOrder = [
  { title: "1. Inputs & Sources", groups: ["I/O"] },
  { title: "2. Logic & Flow", groups: ["Logic", "Flow"] },
  { title: "3. Equipment & Safety", groups: ["Actuators", "Safety"] },
  { title: "4. Protocols & Diagnostics", groups: ["Protocols", "Diagnostics"] }
];

function App() {
  return (
    <ReactFlowProvider>
      <Designer />
    </ReactFlowProvider>
  );
}

function Designer() {
  const reactFlow = useReactFlow();
  const [project, setProject] = useState<Project>(() => (window as unknown as { __OPENFORGE_PROJECT__: Project }).__OPENFORGE_PROJECT__);
  const workflow = project.workflows[0];
  const profiles = useMemo(() => profilesFor(project), [project]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(workflow.nodes[0]?.id);
  const [bottomTab, setBottomTab] = useState<BottomTab>("validation");
  const [contextMenu, setContextMenu] = useState<ContextMenu>();
  const [activeMenu, setActiveMenu] = useState<MenuId | undefined>();
  const [showGuide, setShowGuide] = useState(true);
  const [runHistory, setRunHistory] = useState<ExecutionRun[]>([]);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const validation = useMemo(() => validateWorkflow(workflow, registry.list(), profiles.map((profile) => profile.id)), [workflow, profiles]);
  const selectedNode = workflow.nodes.find((node) => node.id === selectedNodeId);
  const selectedDefinition = selectedNode ? registry.get(selectedNode.templateId) : undefined;

  const [nodes, setNodes] = useState<FlowNode[]>(() => workflow.nodes.map((node) => toFlowNode(node, validation)));
  const [edges, setEdges] = useState<FlowEdge[]>(() => workflow.edges.map(toFlowEdge));

  const syncGraph = useCallback((nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
    setProject((current) => ({
      ...current,
      workflows: current.workflows.map((item, index) => index === 0
        ? {
            ...item,
            nodes: item.nodes.map((node) => {
              const flowNode = nextNodes.find((candidate) => candidate.id === node.id);
              return flowNode ? { ...node, position: flowNode.position } : node;
            }),
            edges: nextEdges.map(toWorkflowEdge)
          }
        : item)
    }));
  }, []);

  const refreshFlowNodes = useCallback((nextWorkflow: Workflow, issues: ValidationIssue[] = validation) => {
    setNodes(nextWorkflow.nodes.map((node) => toFlowNode(node, issues, runHistory[0])));
    setEdges(nextWorkflow.edges.map(toFlowEdge));
  }, [runHistory, validation]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      syncGraph(next, edges);
      return next;
    });
  }, [edges, syncGraph]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => {
      const next = applyEdgeChanges(changes, current);
      syncGraph(nodes, next);
      return next;
    });
  }, [nodes, syncGraph]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceNode = workflow.nodes.find((node) => node.id === connection.source);
    const targetNode = workflow.nodes.find((node) => node.id === connection.target);
    const sourcePort = sourceNode?.ports.find((port) => port.direction === "output") ?? sourceNode?.ports[0];
    const targetPort = targetNode?.ports.find((port) => port.direction === "input") ?? targetNode?.ports[0];
    if (!sourcePort || !targetPort || sourcePort.signalType !== targetPort.signalType) {
      setStatusMessage("Connection rejected: incompatible or missing ports.");
      setBottomTab("validation");
      return;
    }
    const next = addEdge({
      id: `edge.${connection.source}.${connection.target}.${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: sourcePort.id,
      targetHandle: targetPort.id,
      label: `data:${sourcePort.signalType}`,
      type: "smoothstep"
    }, edges);
    setEdges(next);
    syncGraph(nodes, next);
  }, [edges, nodes, syncGraph, workflow.nodes]);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    const templateId = event.dataTransfer.getData("application/openforge-template");
    const definition = registry.get(templateId);
    if (!definition) return;
    const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNodeFromDefinition(definition, position);
  }

  function addNodeFromDefinition(definition: NodeDefinition, position?: { x: number; y: number }) {
    const node = createNode(definition, position ?? nextNodePosition(workflow.nodes.length));
    const nextWorkflow = { ...workflow, nodes: [...workflow.nodes, node] };
    const nextProject = { ...project, workflows: [nextWorkflow, ...project.workflows.slice(1)] };
    setProject(nextProject);
    setSelectedNodeId(node.id);
    refreshFlowNodes(nextWorkflow);
    setStatusMessage(`Added ${definition.metadata.name}. Configure it in the inspector, then connect its ports.`);
  }

  function updateNodeParameter(propertyId: string, value: unknown) {
    const nextWorkflow = {
      ...workflow,
      nodes: workflow.nodes.map((node) => node.id === selectedNodeId ? { ...node, parameters: { ...(node.parameters ?? {}), [propertyId]: value } } : node)
    };
    setProject({ ...project, workflows: [nextWorkflow, ...project.workflows.slice(1)] });
    refreshFlowNodes(nextWorkflow);
  }

  function duplicateNode(nodeId = selectedNodeId) {
    const node = workflow.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const clone = {
      ...node,
      id: `${node.id}.copy.${Date.now()}`,
      metadata: { ...node.metadata, name: `${node.metadata.name} Copy` },
      position: { x: (node.position?.x ?? 0) + 48, y: (node.position?.y ?? 0) + 48 }
    };
    const nextWorkflow = { ...workflow, nodes: [...workflow.nodes, clone] };
    setProject({ ...project, workflows: [nextWorkflow, ...project.workflows.slice(1)] });
    setSelectedNodeId(clone.id);
    refreshFlowNodes(nextWorkflow);
  }

  function deleteNode(nodeId = selectedNodeId) {
    if (!nodeId) return;
    const nextWorkflow = {
      ...workflow,
      nodes: workflow.nodes.filter((node) => node.id !== nodeId),
      edges: workflow.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
    };
    setProject({ ...project, workflows: [nextWorkflow, ...project.workflows.slice(1)] });
    setSelectedNodeId(nextWorkflow.nodes[0]?.id);
    refreshFlowNodes(nextWorkflow);
  }

  function newProject() {
    const nextWorkflow: Workflow = { id: `workflow.industrial.${Date.now()}`, metadata: { name: "Untitled Workflow" }, nodes: [], edges: [] };
    const nextProject: Project = { ...project, id: `project.industrial.${Date.now()}`, metadata: { ...project.metadata, name: "Untitled OpenForge Project" }, workflows: [nextWorkflow] };
    setProject(nextProject);
    setSelectedNodeId(undefined);
    setNodes([]);
    setEdges([]);
    setLogs([]);
    setRunHistory([]);
    setBottomTab("validation");
    setStatusMessage("Created a blank workflow.");
  }

  function autoLayout() {
    const nextNodes = nodes.map((node, index) => ({ ...node, position: { x: 100 + (index % 4) * 270, y: 90 + Math.floor(index / 4) * 160 } }));
    setNodes(nextNodes);
    syncGraph(nextNodes, edges);
    setStatusMessage("Canvas auto-layout applied.");
  }

  function fitCanvas() {
    reactFlow.fitView({ padding: 0.2, duration: 300 });
    setStatusMessage("Canvas fitted to screen.");
  }

  function stopSimulation() {
    setNodes(workflow.nodes.map((node) => toFlowNode(node, validation)));
    setStatusMessage("Simulation stopped. Live execution is intentionally deferred in this OSS slice.");
  }

  function runSimulation() {
    const issues = validateWorkflow(workflow, registry.list(), profiles.map((profile) => profile.id));
    const runner = new SimulationRunner({ definitions: registry.list(), projectId: project.id });
    const run = runner.run(workflow, project.simulationScenarios?.[0], issues);
    setRunHistory((current) => [run, ...current].slice(0, 10));
    setLogs(run.logs);
    setNodes(workflow.nodes.map((node) => toFlowNode(node, issues, run)));
    setBottomTab("logs");
    setStatusMessage(`Simulation ${run.status}: ${run.events.length} events, ${run.logs.length} logs.`);
  }

  function validateCurrentWorkflow() {
    setNodes(workflow.nodes.map((node) => toFlowNode(node, validation, runHistory[0])));
    setBottomTab("validation");
    setStatusMessage(`${validation.filter((issue) => issue.severity === "error").length} errors, ${validation.filter((issue) => issue.severity === "warning").length} warnings.`);
  }

  async function saveProject() {
    const response = await fetch("/api/projects/conveyor-demo", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project, null, 2)
    }).catch(() => undefined);
    setStatusMessage(response?.ok ? "Project saved through backend API." : "Backend save unavailable; use Export for local JSON.");
  }

  function exportProject() {
    download(`${project.id}.json`, JSON.stringify(project, null, 2));
  }

  async function importProject(file: File) {
    const imported = JSON.parse(await file.text()) as Project;
    setProject(imported);
    setSelectedNodeId(imported.workflows[0]?.nodes[0]?.id);
    setNodes(imported.workflows[0].nodes.map((node) => toFlowNode(node, [])));
    setEdges(imported.workflows[0].edges.map(toFlowEdge));
    setStatusMessage("Imported project JSON.");
  }

  function runContext(action: string) {
    const nodeId = contextMenu?.nodeId;
    setContextMenu(undefined);
    if (action === "delete") deleteNode(nodeId);
    if (action === "duplicate") duplicateNode(nodeId);
    if (action === "validate") validateCurrentWorkflow();
    if (action === "run") runSimulation();
    if (action === "logs") setBottomTab("logs");
    if (action === "export-node" && nodeId) {
      download(`${nodeId}.json`, JSON.stringify(workflow.nodes.find((node) => node.id === nodeId), null, 2));
    }
    if (action === "layout") autoLayout();
  }

  return (
    <main className="of-shell" onClick={() => { setContextMenu(undefined); setActiveMenu(undefined); }}>
      <section className="of-workbench">
        <MenuBar
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          onNew={newProject}
          onImport={() => document.getElementById("of-import-input")?.click()}
          onExport={exportProject}
          onSave={saveProject}
          onDuplicate={() => duplicateNode()}
          onDelete={() => deleteNode()}
          onAutoLayout={autoLayout}
          onFit={fitCanvas}
          onShowGuide={() => setShowGuide(true)}
          setBottomTab={setBottomTab}
          onValidate={validateCurrentWorkflow}
          onSimulate={runSimulation}
          onStop={stopSimulation}
        />
        <Toolbar onSave={saveProject} onValidate={validateCurrentWorkflow} onSimulate={runSimulation} onStop={stopSimulation} onExport={exportProject} onFit={fitCanvas} status={statusMessage} />
        <div className="of-layout">
          <NodePalette onAddTemplate={addNodeFromDefinition} />
          <section className="of-canvas" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setSelectedNodeId(node.id);
                setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
              }}
              onPaneContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY });
              }}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </section>
          <Inspector node={selectedNode} definition={selectedDefinition} profiles={profiles} onChange={updateNodeParameter} />
        </div>
        {showGuide && <GettingStartedGuide onClose={() => setShowGuide(false)} onValidate={validateCurrentWorkflow} onSimulate={runSimulation} />}
        <BottomPanel tab={bottomTab} setTab={setBottomTab} validation={validation} logs={logs} runHistory={runHistory} project={project} />
      </section>
      {contextMenu && <ContextMenuView menu={contextMenu} onAction={runContext} />}
      <input id="of-import-input" type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && importProject(event.target.files[0])} />
    </main>
  );
}

function MenuBar({
  activeMenu,
  setActiveMenu,
  onNew,
  onImport,
  onExport,
  onSave,
  onDuplicate,
  onDelete,
  onAutoLayout,
  onFit,
  onShowGuide,
  setBottomTab,
  onValidate,
  onSimulate,
  onStop
}: {
  activeMenu?: MenuId;
  setActiveMenu: (menu?: MenuId) => void;
  onNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAutoLayout: () => void;
  onFit: () => void;
  onShowGuide: () => void;
  setBottomTab: (tab: BottomTab) => void;
  onValidate: () => void;
  onSimulate: () => void;
  onStop: () => void;
}) {
  const menus: Array<{ id: MenuId; label: string; items: Array<{ label: string; action: () => void }> }> = [
    { id: "file", label: "File", items: [{ label: "New workflow", action: onNew }, { label: "Save project", action: onSave }, { label: "Import JSON", action: onImport }, { label: "Export JSON", action: onExport }] },
    { id: "edit", label: "Edit", items: [{ label: "Duplicate selected node", action: onDuplicate }, { label: "Delete selected node", action: onDelete }, { label: "Auto-layout canvas", action: onAutoLayout }] },
    { id: "view", label: "View", items: [{ label: "Fit canvas", action: onFit }, { label: "Validation panel", action: () => setBottomTab("validation") }, { label: "Logs panel", action: () => setBottomTab("logs") }, { label: "JSON preview", action: () => setBottomTab("json") }] },
    { id: "run", label: "Run", items: [{ label: "Validate workflow", action: onValidate }, { label: "Simulate workflow", action: onSimulate }, { label: "Stop simulation", action: onStop }] },
    { id: "tools", label: "Tools", items: [{ label: "Connection diagnostics", action: () => setBottomTab("diagnostics") }, { label: "Run history", action: () => setBottomTab("history") }, { label: "Auto-layout canvas", action: onAutoLayout }] },
    { id: "help", label: "Help", items: [{ label: "Getting started guide", action: onShowGuide }, { label: "Validation help", action: () => setBottomTab("validation") }] }
  ];

  return (
    <nav className="of-menu" onClick={(event) => event.stopPropagation()}>
      {menus.map((menu) => (
        <div className="of-menu-group" key={menu.id}>
          <button onClick={() => setActiveMenu(activeMenu === menu.id ? undefined : menu.id)}>{menu.label}</button>
          {activeMenu === menu.id && (
            <div className="of-menu-dropdown">
              {menu.items.map((item) => (
                <button key={item.label} onClick={() => { item.action(); setActiveMenu(undefined); }}>{item.label}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

function Toolbar({ onSave, onValidate, onSimulate, onStop, onExport, onFit, status }: { onSave: () => void; onValidate: () => void; onSimulate: () => void; onStop: () => void; onExport: () => void; onFit: () => void; status: string }) {
  return (
    <header className="of-toolbar">
      <div className="of-brand"><WorkflowIcon size={20} /><strong>OpenForge Designer</strong><span>{status}</span></div>
      <div className="of-actions">
        <button onClick={onSave}><Save size={16} /> Save</button>
        <button onClick={onValidate}><SearchCheck size={16} /> Validate</button>
        <button onClick={onSimulate}><Play size={16} /> Simulate</button>
        <button onClick={onStop}><CircleStop size={16} /> Stop</button>
        <button onClick={onExport}><Download size={16} /> Export</button>
        <button onClick={onFit}><ZoomIn size={16} /> Fit</button>
      </div>
    </header>
  );
}

function NodePalette({ onAddTemplate }: { onAddTemplate: (definition: NodeDefinition) => void }) {
  const grouped = registry.groups();
  return (
    <aside className="of-palette">
      <div className="of-palette-header">
        <h2>Control Palette</h2>
        <span>Drag to canvas or click to add.</span>
      </div>
      {paletteOrder.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <div className="of-template-list">
            {section.groups.flatMap((group) => grouped[group] ?? []).map((template) => (
              <button
                key={template.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("application/openforge-template", template.id)}
                onClick={() => onAddTemplate(template)}
              >
                <strong>{template.metadata.name}</strong>
                <span>{template.metadata.description}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

function GettingStartedGuide({ onClose, onValidate, onSimulate }: { onClose: () => void; onValidate: () => void; onSimulate: () => void }) {
  const steps = [
    "Start with Inputs & Sources from the Control Palette.",
    "Add Logic & Flow nodes such as Condition, Timer, Counter, or State Machine.",
    "Add Equipment, Safety, Protocol, or Diagnostic nodes.",
    "Connect matching ports on the canvas from outputs to inputs.",
    "Select each node and configure properties in the Inspector.",
    "Run Validate, then Simulate, then review Logs and Run History."
  ];
  return (
    <aside className="of-guide" onClick={(event) => event.stopPropagation()}>
      <div>
        <strong>First-time workflow guide</strong>
        <button onClick={onClose}>Dismiss</button>
      </div>
      <ol>
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <div className="of-guide-actions">
        <button onClick={onValidate}><SearchCheck size={14} /> Validate</button>
        <button onClick={onSimulate}><Play size={14} /> Simulate</button>
      </div>
    </aside>
  );
}

function IndustrialNode({ data }: NodeProps<{ node: WorkflowNode; definition?: NodeDefinition; issues: ValidationIssue[]; status?: string }>) {
  const inputPorts = data.node.ports.filter((port) => port.direction === "input");
  const outputPorts = data.node.ports.filter((port) => port.direction === "output");
  return (
    <div className={`of-node of-node-${data.status ?? "idle"} ${data.issues.some((issue) => issue.severity === "error") ? "of-node-error" : ""}`}>
      {inputPorts.map((port, index) => <Handle key={port.id} id={port.id} type="target" position={Position.Left} style={{ top: 34 + index * 22 }} />)}
      <strong>{data.node.metadata.name}</strong>
      <span>{data.definition?.metadata.name ?? data.node.templateId}</span>
      <div className="of-ports">
        {data.node.ports.map((port) => <code key={port.id}>{port.direction}:{port.id}</code>)}
      </div>
      <small>{data.status ?? "idle"}</small>
      {outputPorts.map((port, index) => <Handle key={port.id} id={port.id} type="source" position={Position.Right} style={{ top: 34 + index * 22 }} />)}
    </div>
  );
}

function Inspector({ node, definition, profiles, onChange }: { node?: WorkflowNode; definition?: NodeDefinition; profiles: ConnectionProfile[]; onChange: (propertyId: string, value: unknown) => void }) {
  if (!node) return <aside className="of-inspector"><h2>Inspector</h2><p>Select a node to edit its configuration.</p></aside>;
  const schema = definition?.propertySchema ?? definition?.parameters ?? [];
  return (
    <aside className="of-inspector">
      <h2>Inspector</h2>
      <div className="of-inspector-title">
        <strong>{node.metadata.name}</strong>
        <span>{definition?.metadata.name ?? node.templateId}</span>
      </div>
      {schema.length === 0 && <p>No editable properties for this node.</p>}
      {schema.map((property) => (
        <label className="of-field" key={property.id}>
          <span>{property.name}</span>
          {property.bindingRole === "profile" ? (
            <select value={String(node.parameters?.[property.id] ?? "")} onChange={(event) => onChange(property.id, event.target.value)}>
              <option value="">Select profile</option>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.metadata.name}</option>)}
            </select>
          ) : property.type === "boolean" ? (
            <input type="checkbox" checked={Boolean(node.parameters?.[property.id] ?? property.defaultValue)} onChange={(event) => onChange(property.id, event.target.checked)} />
          ) : property.type === "number" ? (
            <input type="number" value={Number(node.parameters?.[property.id] ?? property.defaultValue ?? 0)} onChange={(event) => onChange(property.id, Number(event.target.value))} />
          ) : property.type === "enum" ? (
            <select value={String(node.parameters?.[property.id] ?? property.defaultValue ?? "")} onChange={(event) => onChange(property.id, event.target.value)}>
              {(property.options ?? []).map((option) => <option key={option}>{option}</option>)}
            </select>
          ) : (
            <input value={String(node.parameters?.[property.id] ?? property.defaultValue ?? "")} onChange={(event) => onChange(property.id, event.target.value)} />
          )}
        </label>
      ))}
      <section className="of-profile-list">
        <h3>Connection Profiles</h3>
        {profiles.map((profile) => <code key={profile.id}>{profile.protocol}: {profile.metadata.name}</code>)}
      </section>
    </aside>
  );
}

function BottomPanel({ tab, setTab, validation, logs, runHistory, project }: { tab: BottomTab; setTab: (tab: BottomTab) => void; validation: ValidationIssue[]; logs: RuntimeLogEntry[]; runHistory: ExecutionRun[]; project: Project }) {
  return (
    <section className="of-bottom">
      <div className="of-tabs">
        <button onClick={() => setTab("validation")}><SearchCheck size={14} /> Validation</button>
        <button onClick={() => setTab("logs")}><ListFilter size={14} /> Logs</button>
        <button onClick={() => setTab("history")}><LayoutDashboard size={14} /> Run History</button>
        <button onClick={() => setTab("diagnostics")}><GitBranch size={14} /> Diagnostics</button>
        <button onClick={() => setTab("json")}><FileJson size={14} /> JSON Preview</button>
      </div>
      <div className="of-tab-body">
        {tab === "validation" && <IssueList issues={validation} />}
        {tab === "logs" && <LogList logs={logs} />}
        {tab === "history" && <RunHistory runs={runHistory} />}
        {tab === "diagnostics" && <Diagnostics project={project} />}
        {tab === "json" && <pre>{JSON.stringify(project, null, 2)}</pre>}
      </div>
    </section>
  );
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  return <ul className="of-list">{issues.map((issue) => <li key={issue.id} className={`of-${issue.severity}`}><strong>{issue.severity}</strong>{issue.message}</li>)}</ul>;
}

function LogList({ logs }: { logs: RuntimeLogEntry[] }) {
  return logs.length ? <ol className="of-list">{logs.map((log) => <li key={log.id}><strong>tick {log.tick}</strong>{log.nodeId ?? "workflow"}: {log.message}</li>)}</ol> : <p>No logs yet. Run simulation to populate execution logs.</p>;
}

function RunHistory({ runs }: { runs: ExecutionRun[] }) {
  return runs.length ? <ol className="of-list">{runs.map((run) => <li key={run.id}><strong>{run.status}</strong>{run.id} - {run.events.length} events - {run.logs.length} logs</li>)}</ol> : <p>No simulation runs yet.</p>;
}

function Diagnostics({ project }: { project: Project }) {
  const profiles = profilesFor(project);
  return <div className="of-diagnostics">{profiles.map((profile) => <code key={profile.id}>{profile.protocol} / {profile.id} / {profile.enabled ? "enabled" : "disabled"}</code>)}</div>;
}

function ContextMenuView({ menu, onAction }: { menu: { x: number; y: number; nodeId?: string }; onAction: (action: string) => void }) {
  const nodeActions = [
    ["run", "Run selected"],
    ["validate", "Validate"],
    ["logs", "View logs"],
    ["duplicate", "Duplicate"],
    ["export-node", "Export node"],
    ["delete", "Delete"]
  ];
  const canvasActions = [["layout", "Auto-layout"], ["validate", "Validate workflow"], ["run", "Simulate workflow"]];
  return (
    <div className="of-context-menu" style={{ left: menu.x, top: menu.y }}>
      {(menu.nodeId ? nodeActions : canvasActions).map(([id, label]) => <button key={id} onClick={() => onAction(id)}>{label}</button>)}
    </div>
  );
}

function createNode(definition: NodeDefinition, position: { x: number; y: number }): WorkflowNode {
  return {
    id: `node.${definition.metadata.name.toLowerCase().replaceAll(" ", "-")}.${Date.now()}`,
    templateId: definition.id,
    metadata: { name: definition.metadata.name },
    position,
    parameters: Object.fromEntries((definition.propertySchema ?? definition.parameters ?? []).filter((property) => property.defaultValue !== undefined).map((property) => [property.id, property.defaultValue])),
    ports: definition.ports
  };
}

function nextNodePosition(index: number): { x: number; y: number } {
  return { x: 120 + (index % 4) * 270, y: 100 + Math.floor(index / 4) * 160 };
}

function toFlowNode(node: WorkflowNode, issues: ValidationIssue[], run?: ExecutionRun): FlowNode {
  const nodeIssues = issues.filter((issue) => issue.location?.nodeId === node.id);
  return {
    id: node.id,
    type: "industrial",
    position: node.position ?? { x: 0, y: 0 },
    data: {
      node,
      definition: registry.get(node.templateId),
      issues: nodeIssues,
      status: run?.state.nodeRunStates?.[node.id]?.status
    }
  };
}

function toFlowEdge(edge: Workflow["edges"][number]): FlowEdge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePortId,
    targetHandle: edge.targetPortId,
    label: `${edge.kind ?? "data"}:${edge.signalType}`,
    type: "smoothstep"
  };
}

function toWorkflowEdge(edge: FlowEdge): Workflow["edges"][number] {
  return {
    id: edge.id,
    sourceNodeId: edge.source,
    sourcePortId: String(edge.sourceHandle ?? "out"),
    targetNodeId: edge.target,
    targetPortId: String(edge.targetHandle ?? "in"),
    signalType: String(edge.label ?? "data:digital").includes("analog") ? "analog" : String(edge.label ?? "").includes("string") ? "string" : String(edge.label ?? "").includes("object") ? "object" : "digital",
    kind: "data"
  };
}

function profilesFor(project: Project): ConnectionProfile[] {
  return project.connectionProfiles ?? project.connectors ?? [];
}

function download(filename: string, content: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`${content}\n`], { type: "application/json" }));
  link.download = filename;
  link.click();
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
