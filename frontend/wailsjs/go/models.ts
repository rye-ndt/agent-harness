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

}

