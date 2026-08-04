import {useMemo, useState, type MouseEvent} from 'react'
import {
    Background,
    BackgroundVariant,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    type Connection,
    type Edge,
    type HandleType,
    type OnConnectStartParams,
} from '@xyflow/react'
import {Maximize, Minus, Plus} from 'lucide-react'

import {
    TaskNode,
    type TaskNodeAgent,
    type TaskNodeType,
} from '@/features/sessions/components/canvas/task-node'
import {Button} from '@/shared/ui/button'
import {useAgentDefaults} from '@/features/settings/use-agent-defaults'
import {useTemplates} from '@/features/templates/use-templates'
import {agentDefaultFor} from '@/features/settings/agent-default'
import {TaskState} from '@/shared/lib/enums'
import {createsCycle, unlinkableFrom, unlinkableInto} from '@/features/sessions/graph'
import {cn} from '@/shared/lib/utils'
import type {Point, Session} from '@/features/sessions/types'

type GraphEdge = Edge & {pathOptions?: {borderRadius?: number}}

type ConnectionOrigin = {nodeId: string; handleType: HandleType}

type GraphCanvasProps = {
    session: Session
    selectedTaskId: string | null
    onSelectTask: (taskId: string | null) => void
    onMoveTask: (taskId: string, position: Point) => void
    onConnect: (sourceId: string, targetId: string) => void
    onDisconnect: (sourceId: string, targetId: string) => void
    onNewNode: (position: Point) => void
}

const nodeTypes = {task: TaskNode}

const fitViewOptions = {padding: 0.3, maxZoom: 1}

const ORIGIN: Point = {x: 0, y: 0}

const NODE_CURSOR_OFFSET: Point = {x: 130, y: 40}

const EDGE_TONES: Partial<Record<TaskState, string>> = {
    [TaskState.Running]: 'is-live',
    [TaskState.Done]: 'is-done',
}

const CANVAS_CHROME = '.react-flow__node, .react-flow__panel, button'

export function GraphCanvas(props: GraphCanvasProps) {
    return (
        <ReactFlowProvider>
            <Canvas {...props} />
        </ReactFlowProvider>
    )
}

function Canvas({
    session,
    selectedTaskId,
    onSelectTask,
    onMoveTask,
    onConnect,
    onDisconnect,
    onNewNode,
}: GraphCanvasProps) {
    const {screenToFlowPosition} = useReactFlow()
    const {templates} = useTemplates()
    const {defaults} = useAgentDefaults()
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
    const [connectingFrom, setConnectingFrom] = useState<ConnectionOrigin | null>(null)

    const locked = session.finalized
    const isEmpty = session.tasks.length === 0

    const unlinkable = useMemo(() => {
        if (!connectingFrom) return null

        return connectingFrom.handleType === 'source'
            ? unlinkableFrom(session.tasks, connectingFrom.nodeId)
            : unlinkableInto(session.tasks, connectingFrom.nodeId)
    }, [session.tasks, connectingFrom])

    const agentByTask = useMemo(() => {
        const levelOf = new Map(templates.map((template) => [template.id, template.taskLevel]))

        return new Map<string, TaskNodeAgent | null>(
            session.tasks.map((task) => {
                const agentDefault = agentDefaultFor(defaults, levelOf.get(task.templateId ?? ''))

                return [
                    task.id,
                    agentDefault
                        ? {model: agentDefault.model, effort: agentDefault.thinkingLevel}
                        : null,
                ]
            }),
        )
    }, [session.tasks, templates, defaults])

    const nodes = useMemo<TaskNodeType[]>(
        () =>
            session.tasks.map((task) => ({
                id: task.id,
                type: 'task' as const,
                position: task.position,
                data: {
                    task,
                    session,
                    unlinkable: unlinkable?.has(task.id) ?? false,
                    agent: agentByTask.get(task.id) ?? null,
                },
                selected: task.id === selectedTaskId,
                draggable: !locked,
                deletable: false,
                className: cn(
                    'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live',
                    locked && 'is-locked',
                ),
            })),
        [session, locked, selectedTaskId, unlinkable, agentByTask],
    )

    const edges = useMemo<GraphEdge[]>(() => {
        const byId = new Map(session.tasks.map((task) => [task.id, task]))

        return session.tasks.flatMap((task) =>
            task.dependsOn.flatMap((sourceId) => {
                const source = byId.get(sourceId)
                if (!source) return []

                const id = `${sourceId}->${task.id}`

                return [
                    {
                        id,
                        source: sourceId,
                        target: task.id,
                        type: 'smoothstep',
                        pathOptions: {borderRadius: 12},
                        className: EDGE_TONES[source.state],
                        selected: id === selectedEdgeId,
                        deletable: !locked,
                    },
                ]
            }),
        )
    }, [session, locked, selectedEdgeId])

    const dropNode = (_: unknown, node: TaskNodeType) => onMoveTask(node.id, node.position)

    const selectNode = (_: unknown, node: TaskNodeType) => {
        setSelectedEdgeId(null)
        onSelectTask(node.id)
    }

    const selectEdge = (_: unknown, edge: GraphEdge) => setSelectedEdgeId(edge.id)

    const clearSelection = () => {
        setSelectedEdgeId(null)
        onSelectTask(null)
    }

    const startConnecting = (_: unknown, {nodeId, handleType}: OnConnectStartParams) =>
        setConnectingFrom(nodeId && handleType ? {nodeId, handleType} : null)

    const stopConnecting = () => setConnectingFrom(null)

    const connect = (connection: Connection) => {
        if (connection.source && connection.target) onConnect(connection.source, connection.target)
    }

    const canConnect = (connection: Connection | Edge) => {
        const hasEnds = Boolean(connection.source) && Boolean(connection.target)
        return hasEnds && !createsCycle(session.tasks, connection.source, connection.target)
    }

    const disconnectAll = (deleted: Edge[]) => {
        for (const edge of deleted) onDisconnect(edge.source, edge.target)
    }

    const addAtOrigin = () => onNewNode(ORIGIN)

    const addAtCursor = (event: MouseEvent<HTMLDivElement>) => {
        const onChrome = (event.target as HTMLElement).closest(CANVAS_CHROME)
        if (locked || onChrome) return

        const position = screenToFlowPosition({x: event.clientX, y: event.clientY})
        onNewNode({x: position.x - NODE_CURSOR_OFFSET.x, y: position.y - NODE_CURSOR_OFFSET.y})
    }

    return (
        <div className="relative min-h-0 flex-1" onDoubleClick={addAtCursor}>
            <ReactFlow<TaskNodeType, GraphEdge>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={fitViewOptions}
                minZoom={0.3}
                maxZoom={1.5}
                zoomOnDoubleClick={false}
                nodesConnectable={!locked}
                deleteKeyCode={['Backspace', 'Delete']}
                proOptions={{hideAttribution: true}}
                onNodeDragStop={dropNode}
                onNodeClick={selectNode}
                onEdgeClick={selectEdge}
                onPaneClick={clearSelection}
                onConnectStart={startConnecting}
                onConnectEnd={stopConnecting}
                onConnect={connect}
                isValidConnection={canConnect}
                onEdgesDelete={disconnectAll}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={16}
                    size={1}
                    color="var(--border)"
                />
                <ZoomCluster />
            </ReactFlow>

            {isEmpty && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <p className="text-base text-muted-foreground">
                        {locked ? 'This session has no nodes.' : 'No nodes yet.'}
                    </p>
                    {!locked && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="pointer-events-auto"
                            onClick={addAtOrigin}
                        >
                            <Plus />
                            New node
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

function ZoomCluster() {
    const {zoomIn, zoomOut, fitView} = useReactFlow()

    const zoomInSmoothly = () => zoomIn({duration: 120})
    const zoomOutSmoothly = () => zoomOut({duration: 120})
    const fitViewSmoothly = () => fitView({...fitViewOptions, duration: 180})

    return (
        <Panel position="bottom-left" style={{margin: 12}}>
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg bg-background ring-1 ring-border">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom in"
                    className="rounded-none"
                    onClick={zoomInSmoothly}
                >
                    <Plus />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom out"
                    className="rounded-none"
                    onClick={zoomOutSmoothly}
                >
                    <Minus />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Fit view"
                    className="rounded-none"
                    onClick={fitViewSmoothly}
                >
                    <Maximize />
                </Button>
            </div>
        </Panel>
    )
}
