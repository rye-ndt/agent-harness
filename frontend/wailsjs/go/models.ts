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
	export class TemplateParamInfo {
	    description: string;
	    required: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TemplateParamInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.description = source["description"];
	        this.required = source["required"];
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

