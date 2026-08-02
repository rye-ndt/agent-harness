import {Input} from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {Textarea} from '@/components/ui/textarea'
import type {FieldValue, TemplateParam} from '@/types/template'

export function ParamFields({
    params,
    values,
    onChange,
}: {
    params: TemplateParam[]
    values: Record<string, FieldValue>
    onChange: (key: string, value: FieldValue) => void
}) {
    return (
        <div className="flex flex-col gap-3">
            {params.map((param) => (
                <ParamField
                    key={param.key}
                    param={param}
                    value={values[param.key]}
                    onChange={(value) => onChange(param.key, value)}
                />
            ))}
        </div>
    )
}

function ParamField({
    param,
    value,
    onChange,
}: {
    param: TemplateParam
    value: FieldValue | undefined
    onChange: (value: FieldValue) => void
}) {
    const id = `param-${param.key}`
    const label = param.label.trim() || param.key

    if (param.type === 'boolean')
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
                    <span className="text-base font-medium">{label}</span>
                    <span className="truncate font-mono text-sm text-muted-foreground">
                        {param.key}
                    </span>
                </label>
                <Switch id={id} checked={value === true} onCheckedChange={onChange} />
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

            {param.type === 'textarea' && (
                <Textarea
                    id={id}
                    rows={3}
                    value={String(value ?? '')}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}

            {param.type === 'select' && (
                <Select value={String(value ?? '')} onValueChange={onChange}>
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

            {(param.type === 'text' || param.type === 'number') && (
                <Input
                    id={id}
                    type={param.type}
                    className="font-mono"
                    value={String(value ?? '')}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
        </div>
    )
}
