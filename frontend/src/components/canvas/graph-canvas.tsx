import {useEffect, useMemo, useState, type MouseEvent} from 'react'
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
} from '@xyflow/react'
import {Maximize, Minus, Plus} from 'lucide-react'

import {TaskNode, type TaskNodeType} from '@/components/canvas/task-node'
import {Button} from '@/components/ui/button'
import {createsCycle, unlinkableFrom, unlinkableInto} from '@/lib/session'
import {cn} from '@/lib/utils'
import type {Point, Session} from '@/types/session'

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
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
    const [dragPositions, setDragPositions] = useState<Record<string, Point>>({})
    const [connectingFrom, setConnectingFrom] = useState<ConnectionOrigin | null>(null)

    const unlinkable = useMemo(() => {
        if (!connectingFrom) return null

        return connectingFrom.handleType === 'source'
            ? unlinkableFrom(session.tasks, connectingFrom.nodeId)
            : unlinkableInto(session.tasks, connectingFrom.nodeId)
    }, [session.tasks, connectingFrom])

    useEffect(() => {
        setDragPositions((current) => (Object.keys(current).length === 0 ? current : {}))
    }, [session])

    const nodes = useMemo<TaskNodeType[]>(
        () =>
            session.tasks.map((task) => ({
                id: task.id,
                type: 'task' as const,
                position: dragPositions[task.id] ?? task.position,
                data: {task, session, unlinkable: unlinkable?.has(task.id) ?? false},
                selected: task.id === selectedTaskId,
                draggable: !session.finalized,
                deletable: false,
                className: cn(
                    'rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live',
                    session.finalized && 'is-locked',
                ),
            })),
        [session, selectedTaskId, dragPositions, unlinkable],
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
                        className:
                            source.state === 'running'
                                ? 'is-live'
                                : source.state === 'done'
                                  ? 'is-done'
                                  : undefined,
                        selected: id === selectedEdgeId,
                        deletable: !session.finalized,
                    },
                ]
            }),
        )
    }, [session, selectedEdgeId])

    // nodes are derived from the session and React Flow keeps no position of its own, so a drag has to
    // render from somewhere: this local overlay follows the cursor and the store is written once, on drop
    const trackDrag = (_: unknown, node: TaskNodeType) =>
        setDragPositions((current) => ({...current, [node.id]: node.position}))

    const addAtCursor = (event: MouseEvent<HTMLDivElement>) => {
        if (session.finalized) return
        if ((event.target as HTMLElement).closest('.react-flow__node, .react-flow__panel, button'))
            return

        const position = screenToFlowPosition({x: event.clientX, y: event.clientY})
        onNewNode({x: position.x - 130, y: position.y - 40})
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
                nodesConnectable={!session.finalized}
                deleteKeyCode={['Backspace', 'Delete']}
                proOptions={{hideAttribution: true}}
                onNodeDrag={trackDrag}
                onNodeDragStop={(_, node) => onMoveTask(node.id, node.position)}
                onNodeClick={(_, node) => {
                    setSelectedEdgeId(null)
                    onSelectTask(node.id)
                }}
                onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
                onPaneClick={() => {
                    setSelectedEdgeId(null)
                    onSelectTask(null)
                }}
                onConnectStart={(_, {nodeId, handleType}) =>
                    setConnectingFrom(nodeId && handleType ? {nodeId, handleType} : null)
                }
                onConnectEnd={() => setConnectingFrom(null)}
                onConnect={(connection: Connection) => {
                    if (connection.source && connection.target)
                        onConnect(connection.source, connection.target)
                }}
                isValidConnection={(connection) =>
                    Boolean(connection.source) &&
                    Boolean(connection.target) &&
                    !createsCycle(session.tasks, connection.source, connection.target)
                }
                onEdgesDelete={(deleted) => {
                    for (const edge of deleted) onDisconnect(edge.source, edge.target)
                }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={16}
                    size={1}
                    color="var(--border)"
                />
                <ZoomCluster />
            </ReactFlow>

            {session.tasks.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <p className="text-base text-muted-foreground">
                        {session.finalized ? 'This session has no nodes.' : 'No nodes yet.'}
                    </p>
                    {!session.finalized && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="pointer-events-auto"
                            onClick={() => onNewNode({x: 0, y: 0})}
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

    return (
        <Panel position="bottom-left" style={{margin: 12}}>
            <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg bg-background ring-1 ring-border">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom in"
                    className="rounded-none"
                    onClick={() => zoomIn({duration: 120})}
                >
                    <Plus />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom out"
                    className="rounded-none"
                    onClick={() => zoomOut({duration: 120})}
                >
                    <Minus />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Fit view"
                    className="rounded-none"
                    onClick={() => fitView({...fitViewOptions, duration: 180})}
                >
                    <Maximize />
                </Button>
            </div>
        </Panel>
    )
}
