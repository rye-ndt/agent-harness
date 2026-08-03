export namespace core_itf {
	
	export class ApprovalOption {
	    id: string;
	    label: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new ApprovalOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.description = source["description"];
	    }
	}

}

export namespace input_itf {
	
	export class AgentStatus {
	    name: string;
	    installed: boolean;
	    instance_count: number;
	    logged_in: boolean;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new AgentStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.installed = source["installed"];
	        this.instance_count = source["instance_count"];
	        this.logged_in = source["logged_in"];
	        this.version = source["version"];
	    }
	}
	export class ContextUsage {
	    total: number;
	    used: number;
	    input: number;
	    output: number;
	    cache_read: number;
	    cache_write: number;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new ContextUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.used = source["used"];
	        this.input = source["input"];
	        this.output = source["output"];
	        this.cache_read = source["cache_read"];
	        this.cache_write = source["cache_write"];
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace output_itf {
	
	export class AgentDefaultInfo {
	    task_level: string;
	    model: string;
	    model_label: string;
	    thinking_level: string;
	
	    static createFrom(source: any = {}) {
	        return new AgentDefaultInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.task_level = source["task_level"];
	        this.model = source["model"];
	        this.model_label = source["model_label"];
	        this.thinking_level = source["thinking_level"];
	    }
	}
	export class ModelOptionInfo {
	    model: string;
	    label: string;
	    harness: string;
	
	    static createFrom(source: any = {}) {
	        return new ModelOptionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.label = source["label"];
	        this.harness = source["harness"];
	    }
	}
	export class AgentDefaultOptionsInfo {
	    task_levels: string[];
	    models: ModelOptionInfo[];
	    thinking_levels: string[];
	
	    static createFrom(source: any = {}) {
	        return new AgentDefaultOptionsInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.task_levels = source["task_levels"];
	        this.models = this.convertValues(source["models"], ModelOptionInfo);
	        this.thinking_levels = source["thinking_levels"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AgentInfo {
	    id: string;
	    status?: input_itf.AgentStatus;
	
	    static createFrom(source: any = {}) {
	        return new AgentInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.status = this.convertValues(source["status"], input_itf.AgentStatus);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ApprovalInfo {
	    id: string;
	    agent_id: string;
	    task_id: string;
	    kind: string;
	    question: string;
	    detail: string;
	    options: core_itf.ApprovalOption[];
	    multi_select: boolean;
	    requested_at: string;
	
	    static createFrom(source: any = {}) {
	        return new ApprovalInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.agent_id = source["agent_id"];
	        this.task_id = source["task_id"];
	        this.kind = source["kind"];
	        this.question = source["question"];
	        this.detail = source["detail"];
	        this.options = this.convertValues(source["options"], core_itf.ApprovalOption);
	        this.multi_select = source["multi_select"];
	        this.requested_at = source["requested_at"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HandoverDocInfo {
	    task: string;
	    outcome: string;
	    blockers: Record<string, string>;
	    approved_decisions: Record<string, string>;
	    rejected_decisions: Record<string, string>;
	    current_behaviors: Record<string, string>;
	    changed_behaviors: Record<string, string>;
	    must_avoid: Record<string, string>;
	    nuances: Record<string, string>;
	    known_gaps: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new HandoverDocInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.task = source["task"];
	        this.outcome = source["outcome"];
	        this.blockers = source["blockers"];
	        this.approved_decisions = source["approved_decisions"];
	        this.rejected_decisions = source["rejected_decisions"];
	        this.current_behaviors = source["current_behaviors"];
	        this.changed_behaviors = source["changed_behaviors"];
	        this.must_avoid = source["must_avoid"];
	        this.nuances = source["nuances"];
	        this.known_gaps = source["known_gaps"];
	    }
	}
	export class MCPServerInfo {
	    name: string;
	    url: string;
	    authorized: boolean;
	    authorized_at: string;
	
	    static createFrom(source: any = {}) {
	        return new MCPServerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	        this.authorized = source["authorized"];
	        this.authorized_at = source["authorized_at"];
	    }
	}
	
	export class RunSessionResult {
	    session_id: string;
	    task_ids: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new RunSessionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session_id = source["session_id"];
	        this.task_ids = source["task_ids"];
	    }
	}
	export class RunTaskSpec {
	    client_id: string;
	    name: string;
	    prompt: string;
	    role: string;
	    task_level: string;
	    system_prompts: string[];
	    depends_on: string[];
	    auto_retry: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RunTaskSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.client_id = source["client_id"];
	        this.name = source["name"];
	        this.prompt = source["prompt"];
	        this.role = source["role"];
	        this.task_level = source["task_level"];
	        this.system_prompts = source["system_prompts"];
	        this.depends_on = source["depends_on"];
	        this.auto_retry = source["auto_retry"];
	    }
	}
	export class RunSessionSpec {
	    working_dir_path: string;
	    context_dir_path: string;
	    tasks: RunTaskSpec[];
	
	    static createFrom(source: any = {}) {
	        return new RunSessionSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.working_dir_path = source["working_dir_path"];
	        this.context_dir_path = source["context_dir_path"];
	        this.tasks = this.convertValues(source["tasks"], RunTaskSpec);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SessionDraftInfo {
	    id: string;
	    doc: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionDraftInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.doc = source["doc"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class SessionTaskInfo {
	    task_id: string;
	    status: string;
	    handover_docs: HandoverDocInfo[];
	
	    static createFrom(source: any = {}) {
	        return new SessionTaskInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.task_id = source["task_id"];
	        this.status = source["status"];
	        this.handover_docs = this.convertValues(source["handover_docs"], HandoverDocInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionStatusInfo {
	    session_id: string;
	    status: string;
	    tasks: SessionTaskInfo[];
	
	    static createFrom(source: any = {}) {
	        return new SessionStatusInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.session_id = source["session_id"];
	        this.status = source["status"];
	        this.tasks = this.convertValues(source["tasks"], SessionTaskInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class TemplateParamInfo {
	    description: string;
	    required: boolean;
	    type: string;
	    default: string;
	    options: string[];
	
	    static createFrom(source: any = {}) {
	        return new TemplateParamInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.description = source["description"];
	        this.required = source["required"];
	        this.type = source["type"];
	        this.default = source["default"];
	        this.options = source["options"];
	    }
	}
	export class TemplateInfo {
	    id: string;
	    name: string;
	    role: string;
	    task_level: string;
	    retryable: boolean;
	    params: Record<string, TemplateParamInfo>;
	    system_prompts: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new TemplateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.role = source["role"];
	        this.task_level = source["task_level"];
	        this.retryable = source["retryable"];
	        this.params = this.convertValues(source["params"], TemplateParamInfo, true);
	        this.system_prompts = source["system_prompts"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

