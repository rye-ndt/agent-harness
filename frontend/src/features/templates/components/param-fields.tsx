import type {ChangeEvent} from 'react'

import {Input} from '@/shared/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/shared/ui/select'
import {Switch} from '@/shared/ui/switch'
import {Textarea} from '@/shared/ui/textarea'
import {ParamType} from '@/shared/lib/enums'
import type {FieldValue, TemplateParam} from '@/features/templates/types'

export function ParamFields({
    params,
    values,
    disabled = false,
    onChange,
}: {
    params: TemplateParam[]
    values: Record<string, FieldValue>
    disabled?: boolean
    onChange: (key: string, value: FieldValue) => void
}) {
    return (
        <div className="flex flex-col gap-3">
            {params.map((param) => (
                <ParamField
                    key={param.key}
                    param={param}
                    value={values[param.key]}
                    disabled={disabled}
                    onChange={onChange}
                />
            ))}
        </div>
    )
}

function ParamField({
    param,
    value,
    disabled,
    onChange,
}: {
    param: TemplateParam
    value: FieldValue | undefined
    disabled: boolean
    onChange: (key: string, value: FieldValue) => void
}) {
    const id = `param-${param.key}`
    const label = param.label.trim() || param.key
    const text = String(value ?? '')

    const change = (next: FieldValue) => onChange(param.key, next)
    const changeEvent = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        change(event.target.value)

    if (param.type === ParamType.Boolean)
        return (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
                    <span className="text-base font-medium">{label}</span>
                    <span className="truncate font-mono text-sm text-muted-foreground">
                        {param.key}
                    </span>
                </label>
                <Switch
                    id={id}
                    checked={value === true}
                    disabled={disabled}
                    onCheckedChange={change}
                />
            </div>
        )

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-base font-medium">
                    {label}
                </label>
                <span className="shrink-0 font-mono text-sm text-muted-foreground">
                    {param.key}
                    {param.required && <span className="text-live">*</span>}
                </span>
            </div>

            {param.type === ParamType.Textarea && (
                <Textarea
                    id={id}
                    rows={3}
                    value={text}
                    disabled={disabled}
                    onChange={changeEvent}
                />
            )}

            {param.type === ParamType.Select && (
                <Select value={text} disabled={disabled} onValueChange={change}>
                    <SelectTrigger id={id}>
                        <SelectValue placeholder="Pick one" />
                    </SelectTrigger>
                    <SelectContent>
                        {(param.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {(param.type === ParamType.Text || param.type === ParamType.Number) && (
                <Input
                    id={id}
                    type={param.type}
                    className="font-mono"
                    value={text}
                    disabled={disabled}
                    onChange={changeEvent}
                />
            )}
        </div>
    )
}
