import { Plus } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";

import { Field } from "@/components/common/field";
import { ParamEditor } from "@/components/templates/param-editor";
import { PromptEditor } from "@/components/templates/prompt-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TASK_LEVELS, TASK_LEVEL_LABELS, TaskLevel } from "@/lib/enums";
import { emptyParam } from "@/lib/template";
import type {
  SystemPrompt,
  TemplateDraft,
  TemplateParam,
} from "@/types/template";

const EMPTY_PROMPT: SystemPrompt = { key: "", value: "" };

function replaceAt<T>(list: T[], index: number, fields: Partial<T>) {
  return list.map((item, at) => (at === index ? { ...item, ...fields } : item));
}

function removeAt<T>(list: T[], index: number) {
  return list.filter((_, at) => at !== index);
}

export function TemplateForm({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (draft: TemplateDraft) => void;
}) {
  const patch = (fields: Partial<TemplateDraft>) =>
    onChange({ ...draft, ...fields });

  const changeName = (event: ChangeEvent<HTMLInputElement>) =>
    patch({ name: event.target.value });
  const changeRole = (event: ChangeEvent<HTMLTextAreaElement>) =>
    patch({ role: event.target.value });
  const changeLevel = (value: string) =>
    patch({ taskLevel: value as TaskLevel });
  const changeRetryable = (retryable: boolean) => patch({ retryable });

  const addParam = () => patch({ params: [...draft.params, emptyParam()] });
  const changeParam = (index: number, fields: Partial<TemplateParam>) =>
    patch({ params: replaceAt(draft.params, index, fields) });
  const removeParam = (index: number) =>
    patch({ params: removeAt(draft.params, index) });

  const addPrompt = () =>
    patch({ systemPrompts: [...draft.systemPrompts, EMPTY_PROMPT] });
  const changePrompt = (index: number, fields: Partial<SystemPrompt>) =>
    patch({ systemPrompts: replaceAt(draft.systemPrompts, index, fields) });
  const removePrompt = (index: number) =>
    patch({ systemPrompts: removeAt(draft.systemPrompts, index) });

  return (
    <div className="flex flex-col gap-6 p-4">
      <Field htmlFor="template-name" label="Name">
        <Input
          id="template-name"
          value={draft.name}
          placeholder="Code reviewer"
          onChange={changeName}
        />
      </Field>

      <Field
        htmlFor="template-role"
        label="Role"
        hint="Shows on every node built from this template."
      >
        <Textarea
          id="template-role"
          rows={2}
          value={draft.role}
          placeholder="Reads a diff and reports the defects it can prove."
          onChange={changeRole}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-3">
          <Field
            htmlFor="template-level"
            label="Effort"
            className="min-w-0 flex-1"
          >
            <Select value={draft.taskLevel} onValueChange={changeLevel}>
              <SelectTrigger id="template-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {TASK_LEVEL_LABELS[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <label
            htmlFor="template-retryable"
            className="flex h-9 shrink-0 items-center gap-3 rounded-lg border border-border px-3"
          >
            <span className="text-base font-medium">Retry on failure</span>
            <Switch
              id="template-retryable"
              checked={draft.retryable}
              onCheckedChange={changeRetryable}
            />
          </label>
        </div>
      </div>

      <Section
        title="Inputs"
        hint="What a node must supply before this template can run."
        onAdd={addParam}
        addLabel="Add input"
      >
        {draft.params.map((param, index) => (
          <ParamEditor
            key={index}
            index={index}
            param={param}
            onChange={changeParam}
            onRemove={removeParam}
          />
        ))}
      </Section>

      <Section title="Prompts" onAdd={addPrompt} addLabel="Add prompt">
        {draft.systemPrompts.map((prompt, index) => (
          <PromptEditor
            key={index}
            index={index}
            prompt={prompt}
            onChange={changePrompt}
            onRemove={removePrompt}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  hint?: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="micro-label">{title}</span>
          {hint && (
            <span className="text-sm text-muted-foreground">{hint}</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={onAdd}
        >
          <Plus />
          {addLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}
