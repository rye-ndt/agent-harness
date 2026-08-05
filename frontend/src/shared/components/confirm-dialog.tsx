import {Button} from '@/shared/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/dialog'

export function ConfirmDialog({
    title,
    description,
    confirmLabel,
    dismissLabel = 'Cancel',
    destructive = false,
    busy = false,
    onConfirm,
    onClose,
}: {
    title: string
    description: string
    confirmLabel: string
    dismissLabel?: string
    destructive?: boolean
    busy?: boolean
    onConfirm: () => void
    onClose: () => void
}) {
    const close = (open: boolean) => {
        if (!open) onClose()
    }

    return (
        <Dialog open onOpenChange={close}>
            <DialogContent showCloseButton={false} className="p-5">
                <DialogHeader>
                    <DialogTitle className="break-words">{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-5">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        {dismissLabel}
                    </Button>
                    <Button
                        autoFocus
                        variant={destructive ? 'destructive' : 'default'}
                        size="sm"
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
