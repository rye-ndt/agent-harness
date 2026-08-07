import {ActivityBubble} from '@/features/sessions/components/canvas/activity-bubble'
import {useTaskActivity} from '@/features/sessions/use-task-activity'

/** Subscribes one running node to its own activity, so a tick repaints the bubble and not the graph. */
export function TaskActivity({taskId}: {taskId: string}) {
    const lines = useTaskActivity(taskId, true)

    return <ActivityBubble lines={lines} />
}
