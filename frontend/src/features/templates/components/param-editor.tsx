import {useState, type ChangeEvent} from 'react'
import {X} from 'lucide-react'

import {Button} from '@/shared/ui/button'
import {Input} from '@/shared/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/shared/ui/select'
import {Switch} from '@/shared/ui/switch'
import {ParamType, PARAM_TYPES, PARAM_TYPE_LABELS} from '@/shared/lib/enums'
import type {TemplateParam} from '@/features/templates/types'

export function ParamEditor({
    index,
    param,
    onChange,
    onRemove,
}: {
    index: number
    param: TemplateParam
    onChange: (index: number, fields: Partial<TemplateParam>) => void
    onRemove: (index: number) => void
}) {
    const isSelect = param.type === ParamType.Select
    const isBoolean = param.type === ParamType.Boolean

    const change = (fields: Partial<TemplateParam>) => onChange(index, fields)
    const remove = () => onRemove(index)

    const changeKey = (event: ChangeEvent<HTMLInputElement>) => change({key: event.target.value})
    const changeLabel = (event: ChangeEvent<HTMLInputElement>) =>
        change({label: event.target.value})
    const changeDefault = (event: ChangeEvent<HTMLInputElement>) =>
        change({default: event.target.value})

    const changeType = (value: string) =>
        change({type: value as ParamType, default: undefined, options: undefined})

    const changeOptions = (options: string[]) => change({options})
    const changeToggleDefault = (on: boolean) => change({default: on ? 'true' : 'false'})
    const changeRequired = (required: boolean) => change({required})

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
                <Input
                    value={param.key}
                    placeholder="target_dir"
                    aria-label="Input key"
                    className="h-8 flex-1 bg-background font-mono"
                    onChange={changeKey}
                />
                <Select value={param.type} onValueChange={changeType}>
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
                <Button variant="ghost" size="icon-sm" aria-label="Remove input" onClick={remove}>
                    <X />
                </Button>
            </div>

            <Input
                value={param.label}
                placeholder="Directory to review"
                aria-label="Label shown on the node"
                className="h-8 bg-background"
                onChange={changeLabel}
            />

            {isSelect && <OptionsInput options={param.options ?? []} onChange={changeOptions} />}

            <div className="flex items-center gap-2">
                {isBoolean ? (
                    <label className="flex h-8 flex-1 items-center gap-3 rounded-lg border border-border bg-background px-3 text-base">
                        <span>Starts on</span>
                        <Switch
                            checked={param.default === 'true'}
                            onCheckedChange={changeToggleDefault}
                        />
                    </label>
                ) : (
                    <Input
                        value={param.default ?? ''}
                        placeholder="Default value"
                        aria-label="Default value"
                        className="h-8 flex-1 bg-background font-mono"
                        onChange={changeDefault}
                    />
                )}

                <label className="flex h-8 shrink-0 items-center gap-3 rounded-lg border border-border bg-background px-3 text-base">
                    <span>Required</span>
                    <Switch checked={param.required} onCheckedChange={changeRequired} />
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

    const commit = (event: ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value
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
            onChange={commit}
        />
    )
}
