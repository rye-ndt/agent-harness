import {useState} from 'react'
import {X} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {PARAM_TYPE_LABELS, PARAM_TYPES} from '@/lib/template'
import type {ParamType, TemplateParam} from '@/types/template'

export function ParamEditor({
    param,
    onChange,
    onRemove,
}: {
    param: TemplateParam
    onChange: (fields: Partial<TemplateParam>) => void
    onRemove: () => void
}) {
    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
                <Input
                    value={param.key}
                    placeholder="target_dir"
                    aria-label="Input key"
                    className="h-8 flex-1 bg-background font-mono"
                    onChange={(event) => onChange({key: event.target.value})}
                />
                <Select
                    value={param.type}
                    onValueChange={(value) =>
                        onChange({type: value as ParamType, default: undefined, options: undefined})
                    }
                >
                    <SelectTrigger
                        aria-label="Input type"
                        className="h-8 w-32 shrink-0 bg-background"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PARAM_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                                {PARAM_TYPE_LABELS[type]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="ghost" size="icon-sm" aria-label="Remove input" onClick={onRemove}>
                    <X />
                </Button>
            </div>

            <Input
                value={param.label}
                placeholder="Directory to review"
                aria-label="Label shown on the node"
                className="h-8 bg-background"
                onChange={(event) => onChange({label: event.target.value})}
            />

            {param.type === 'select' && (
                <OptionsInput
                    options={param.options ?? []}
                    onChange={(options) => onChange({options})}
                />
            )}

            <div className="flex items-center gap-2">
                {param.type === 'boolean' ? (
                    <label className="flex h-8 flex-1 items-center gap-3 rounded-lg border border-border bg-background px-3 text-base">
                        <span>Starts on</span>
                        <Switch
                            checked={param.default === 'true'}
                            onCheckedChange={(on) => onChange({default: on ? 'true' : 'false'})}
                        />
                    </label>
                ) : (
                    <Input
                        value={param.default ?? ''}
                        placeholder="Default value"
                        aria-label="Default value"
                        className="h-8 flex-1 bg-background font-mono"
                        onChange={(event) => onChange({default: event.target.value})}
                    />
                )}

                <label className="flex h-8 shrink-0 items-center gap-3 rounded-lg border border-border bg-background px-3 text-base">
                    <span>Required</span>
                    <Switch
                        checked={param.required}
                        onCheckedChange={(required) => onChange({required})}
                    />
                </label>
            </div>
        </div>
    )
}

function OptionsInput({
    options,
    onChange,
}: {
    options: string[]
    onChange: (options: string[]) => void
}) {
    const [text, setText] = useState(() => options.join(', '))

    const commit = (next: string) => {
        setText(next)
        onChange(
            next
                .split(',')
                .map((option) => option.trim())
                .filter(Boolean),
        )
    }

    return (
        <Input
            value={text}
            placeholder="lenient, normal, strict"
            aria-label="Options, separated by commas"
            className="h-8 bg-background font-mono"
            onChange={(event) => commit(event.target.value)}
        />
    )
}
