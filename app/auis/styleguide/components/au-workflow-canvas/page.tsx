import { AuTable } from "@/components/ui/AuTable"
import { ApiTable, CodeExample, PageHero, PropRow, Section, Stage } from "../../_primitives"
import { WorkflowExample, WorkflowStatesExample } from "./_WorkflowExample"

const USAGE = `import { addEdge, useEdgesState, useNodesState, type NodeProps } from "@xyflow/react"
import { AuTextarea } from "@/components/ui/AuTextarea"
import {
  AuWorkflowCanvas,
  AuWorkflowNode,
  AuWorkflowNodeResults,
  AuWorkflowNote,
  AuWorkflowToolbar,
  AuWorkflowViewControls,
} from "@/components/ui/AuWorkflowCanvas"

function PromptNode({ data, selected }: NodeProps) {
  return (
    <AuWorkflowNode
      icon="edit_note"
      title="Text input"
      description="The message that starts the flow."
      source
      selected={selected}
      footer={<AuWorkflowNodeResults meta="12 tokens · 0.00 s" />}
    >
      {/* nowheel: scrolling the field does not zoom the canvas */}
      <AuTextarea className="nowheel" rows={3} defaultValue={String(data.text)} />
    </AuWorkflowNode>
  )
}

function LabelNode({ data }: NodeProps) {
  return <AuWorkflowNote tone="blue" title={String(data.title)} />
}

// Define node types outside render, or React Flow remounts every node.
const nodeTypes = { prompt: PromptNode, label: LabelNode }

export function Editor() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  return (
    <div className="h-160">
      <AuWorkflowCanvas
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(c) => setEdges((eds) => addEdge(c, eds))}
        fitView
        toolbar={
          <AuWorkflowToolbar>
            <AuWorkflowViewControls />
          </AuWorkflowToolbar>
        }
      />
    </div>
  )
}`

const ANATOMY: { piece: string; owner: string; detail: string }[] = [
  { piece: "Pan, zoom, selection box", owner: "React Flow", detail: "ReactFlow. The selection box is themed through --xy-selection-*." },
  { piece: "Dotted grid", owner: "React Flow", detail: "Background, dots variant, painted with --border-strong." },
  { piece: "Connection lines", owner: "React Flow", detail: "Default bezier edges and the drag-to-connect line, stroked with --border-strong. Selected edges use --accent-brand." },
  { piece: "Handles", owner: "React Flow", detail: "Handle, resized to a small square and filled with --bg-raised." },
  { piece: "Minimap", owner: "React Flow", detail: "MiniMap, with Auis surfaces for the frame, mask and nodes." },
  { piece: "Toolbar and zoom buttons", owner: "Auis", detail: "AuWorkflowToolbar + AuButton. React Flow's own Controls are not used." },
  { piece: "Node card", owner: "Auis", detail: "AuWorkflowNode: Icon tile, title, status (AuSpinner or Icon), body, footer." },
  { piece: "Node body controls", owner: "Auis", detail: "AuTextarea, AuDropdownMenu, AuSegmented, AuCheckbox, AuButton — whatever the node needs." },
  { piece: "Notes", owner: "Auis", detail: "AuWorkflowNote, tinted from the au-* palette." },
]

export default function AuWorkflowCanvasPage() {
  return (
    <>
      <PageHero title="AuWorkflowCanvas">
        A node-and-edge editor. React Flow draws the canvas, the connections and the handles; every
        control on it is an Auis component.
      </PageHero>
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-10 pb-14">
        <Section
          id="preview"
          title="Preview"
          lead="A full workflow editor composed from the pattern. Drag a node by its header, connect an output handle to an input, add nodes from the toolbar, and press Run."
        >
          <Stage label="Workflow editor" hint="Live, interactive example" gridClassName="block">
            <WorkflowExample />
          </Stage>
        </Section>

        <Section
          id="anatomy"
          title="Anatomy"
          lead="The split is deliberate: Auis has no answer for pan, zoom or connections, so React Flow keeps those. Everything a person clicks stays in the design system."
        >
          <AuTable>
            <thead>
              <tr>
                <th>Piece</th>
                <th>Owner</th>
                <th>How</th>
              </tr>
            </thead>
            <tbody>
              {ANATOMY.map((row) => (
                <tr key={row.piece}>
                  <td>{row.piece}</td>
                  <td>{row.owner}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </AuTable>
        </Section>

        <Section
          id="states"
          title="States"
          lead="A node shows idle, selected, running, success or error. Notes come in five tones."
        >
          <WorkflowStatesExample />
        </Section>

        <Section id="api" title="API" lead="One file, several exports. The canvas forwards every React Flow prop except proOptions and colorMode.">
          <div className="flex flex-col gap-8">
            <div>
              <div className="au-eyebrow mb-3">AuWorkflowCanvas</div>
              <ApiTable>
                <PropRow prop="toolbar" type="ReactNode" doc="Rendered at the bottom center, inside React Flow. Usually an AuWorkflowToolbar." />
                <PropRow prop="status" type="ReactNode" doc="Quiet line at the bottom left, such as the save state." />
                <PropRow prop="minimap" type="boolean" def="false" doc="React Flow's minimap at the bottom right, themed with Auis surfaces." />
                <PropRow prop="children" type="ReactNode" doc="Rendered inside React Flow: extra Panels, or anything that calls useReactFlow()." />
                <PropRow prop="…ReactFlowProps" type="nodes, edges, nodeTypes, onConnect…" doc="Passed through. Defaults: minZoom 0.2, maxZoom 2. The canvas fills its parent, so give the parent a height." />
                <PropRow prop="nodeTypes" type="Record<string, ComponentType>" doc="Define it outside render. Never key a type input, output, default or group: React Flow paints those names with its own node frame." />
              </ApiTable>
            </div>
            <div>
              <div className="au-eyebrow mb-3">AuWorkflowNode</div>
              <ApiTable>
                <PropRow prop="icon" type="string" doc="Material Symbol for the icon tile. Never a third-party logo." />
                <PropRow prop="title" type="ReactNode" doc="Node name, truncated to one line." />
                <PropRow prop="description" type="ReactNode" doc="One short line under the title." />
                <PropRow prop="status" type={'"idle" | "running" | "success" | "error"'} def={'"idle"'} doc="Running shows a spinner; success and error show an icon; error also tints the border." />
                <PropRow prop="selected" type="boolean" def="false" doc="Pass React Flow's selected from the node props." />
                <PropRow prop="target / source" type="boolean" def="false" doc="Input handle on the left, output handle on the right, level with the header." />
                <PropRow prop="actions" type="ReactNode" doc="Controls above the card, such as a small Run button. They scale with the canvas." />
                <PropRow prop="footer" type="ReactNode" doc="Usually an AuWorkflowNodeResults." />
                <PropRow prop="children" type="ReactNode" doc="The body. It is nodrag, so the node moves by its header and its controls stay clickable." />
              </ApiTable>
            </div>
            <div>
              <div className="au-eyebrow mb-3">AuWorkflowNote</div>
              <ApiTable>
                <PropRow prop="title" type="ReactNode" doc="The label." />
                <PropRow prop="children" type="ReactNode" doc="One short line under the title." />
                <PropRow prop="tone" type={'"neutral" | "blue" | "amber" | "emerald" | "purple"'} def={'"neutral"'} doc="Tint drawn on an opaque surface, so the grid never shows through." />
                <PropRow prop="selected" type="boolean" def="false" doc="Shows the focus ring." />
              </ApiTable>
            </div>
            <div>
              <div className="au-eyebrow mb-3">Smaller pieces</div>
              <AuTable>
                <thead>
                  <tr>
                    <th>Export</th>
                    <th>Use</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>AuWorkflowNodeSection</code></td><td>A labelled group in a node body, such as Tools.</td></tr>
                  <tr><td><code>AuWorkflowNodeRow</code></td><td>A quiet read-only row: icon or leading control, value, optional action.</td></tr>
                  <tr><td><code>AuWorkflowNodeResults</code></td><td>The footer: a View results disclosure and run metadata. It expands in place.</td></tr>
                  <tr><td><code>AuWorkflowToolbar</code></td><td>The floating group that holds the canvas buttons. Pair with <code>AuWorkflowToolbarDivider</code>.</td></tr>
                  <tr><td><code>AuWorkflowViewControls</code></td><td>Zoom in, zoom out and fit, as AuButtons wired to React Flow. Render it inside the canvas.</td></tr>
                </tbody>
              </AuTable>
            </div>
          </div>
        </Section>

        <Section id="usage" title="Usage" lead="Node types, node data and run logic belong to your screen. The pattern only draws them.">
          <CodeExample label="Minimal editor">{USAGE}</CodeExample>
        </Section>

        <Section id="accessibility" title="Accessibility" lead="React Flow handles keyboard focus on nodes and edges; the Auis parts carry their own labels.">
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-sm text-(--fg-secondary)">
            <li>Every icon-only button has an <code>aria-label</code>. Add one when you add a button.</li>
            <li>Tab moves through the connections, then the nodes; Enter selects; Backspace deletes the selection. Backspace and Delete inside a node field only edit the text.</li>
            <li>Node statuses carry text for screen readers (Running, Finished, Failed), not only an icon.</li>
            <li>Viewport animations drop to zero when the person prefers reduced motion.</li>
            <li>Give the canvas an <code>aria-label</code> that names the workflow.</li>
          </ul>
        </Section>

        <Section id="when-to-use" title="When to use">
          <AuTable>
            <thead>
              <tr>
                <th>Use it for</th>
                <th>Use something else for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>An editor where people place steps and connect them: automations, agent pipelines, data flows.</td>
                <td>A read-only diagram of a user journey. Use the UX Flow tool at <code>/auis/ux-flow</code>.</td>
              </tr>
              <tr>
                <td>Steps whose settings live on the step itself, edited in place.</td>
                <td>A linear sequence with no branches. A list or an <code>AuModal</code> wizard is simpler.</td>
              </tr>
              <tr>
                <td>Graphs of tens of nodes that people arrange by hand.</td>
                <td>Large generated graphs that need automatic layout. Add a layout library first.</td>
              </tr>
            </tbody>
          </AuTable>
        </Section>
      </div>
    </>
  )
}
