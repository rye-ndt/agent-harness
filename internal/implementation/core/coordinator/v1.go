package coordinator

import (
	"maps"
	"slices"
	"strings"
	"sync"
	"time"

	"hexago/internal/helpers"
	"hexago/internal/helpers/constances"
	"hexago/internal/helpers/custom_error"
	"hexago/internal/helpers/enums"
	core_itf "hexago/internal/interface/core"
	input_itf "hexago/internal/interface/input"

	"github.com/google/uuid"
)

const scheduleInterval = 15 * time.Second

type v1 struct {
	locker   sync.Mutex
	cfg      *input_itf.SessionConfig
	sessions core_itf.SessionManager
	agents   core_itf.AgentManager
	running  map[uuid.UUID]chan struct{}
	watchers map[uuid.UUID]chan struct{}
	stop     chan struct{}
	stopOnce sync.Once
}

func InitV1(
	cfg *input_itf.SessionConfig,
	sessions core_itf.SessionManager,
	agents core_itf.AgentManager,
) (core_itf.Coordinator, error) {
	if err := helpers.ValidateStruct(cfg); err != nil {
		return nil, custom_error.Critical("invalid coordinator config: %v", err)
	}

	return &v1{
		locker:   sync.Mutex{},
		cfg:      cfg,
		sessions: sessions,
		agents:   agents,
		running:  map[uuid.UUID]chan struct{}{},
		watchers: map[uuid.UUID]chan struct{}{},
		stop:     make(chan struct{}),
	}, nil
}

func (c *v1) Run(session uuid.UUID) error {
	var err error
	var halt chan struct{}

	c.raceSafe(func() {
		if _, found := c.running[session]; found {
			err = custom_error.Critical("session %v is already running", session)
			return
		}

		halt = make(chan struct{})
		c.running[session] = halt
	})

	if err != nil {
		return err
	}

	progress, err := c.sessions.Execute(session)
	if err != nil {
		c.raceSafe(func() {
			if c.running[session] == halt {
				delete(c.running, session)
			}
		})

		return err
	}

	go c.runSession(session, halt, progress)

	return nil
}

func (c *v1) Cancel(session uuid.UUID) error {
	var halt chan struct{}

	c.raceSafe(func() {
		halt = c.running[session]
		delete(c.running, session)
	})

	if halt != nil {
		close(halt)
	}

	agentIDs, err := c.sessions.Cancel(session)

	for _, agentID := range agentIDs {
		c.stopWatcher(agentID)
		_ = c.agents.Kill(agentID)
	}

	return err
}

func (c *v1) Stop() {
	c.stopOnce.Do(func() { close(c.stop) })
}

func (c *v1) runSession(session uuid.UUID, halt <-chan struct{}, progress <-chan *core_itf.SessionProgress) {
	defer c.raceSafe(func() {
		if c.running[session] == halt {
			delete(c.running, session)
		}
	})

	ticker := time.NewTicker(scheduleInterval)
	defer ticker.Stop()

	c.schedule(session)

	for {
		select {
		case <-c.stop:
			return
		case <-halt:
			return
		case <-ticker.C:
			c.schedule(session)
		case event, open := <-progress:
			if !open {
				return
			}

			switch event.Event {
			case enums.SessionTaskReported, enums.SessionTaskDropped:
				c.stopWatcher(event.AgentID)
				_ = c.agents.Kill(event.AgentID)
			}

			c.schedule(session)
		}
	}
}

func (c *v1) schedule(session uuid.UUID) {
	specs, err := c.sessions.ReadyTasks(session)
	if err != nil || len(specs) == 0 {
		return
	}

	status, err := c.sessions.Status(session)
	if err != nil {
		return
	}

	for _, spec := range specs {
		if spec.AgentSpecs == nil {
			continue
		}

		agent, err := c.agents.RequestInstance(&core_itf.AgentRequest{
			Name:          spec.AgentSpecs.Name,
			Role:          spec.AgentSpecs.Role,
			ThinkingLevel: spec.AgentSpecs.ThinkingLevel,
			SystemPrompts: spec.AgentSpecs.SystemPrompts,
			WorkingDir:    status.WorkingDirPath,
		})
		if err != nil {
			return
		}

		if err := c.sessions.Assign(spec.TaskID, agent.ID); err != nil {
			_ = c.agents.Kill(agent.ID)
			continue
		}

		if err := c.agents.Send(agent.ID, buildPrompt(spec, status)); err != nil {
			_ = c.sessions.Report(agent.ID, enums.TaskFailed, []*core_itf.HandoverDoc{{
				Task:    spec.Name,
				TLDR:    "The assistant working on this step stopped running before it could start, so nothing was done.",
				Outcome: "agent died before reporting: " + err.Error(),
			}})
			_ = c.agents.Kill(agent.ID)

			continue
		}

		c.watch(agent.ID, spec.Name)
	}
}

func (c *v1) watch(agentID uuid.UUID, taskName string) {
	watcher := make(chan struct{})

	c.raceSafe(func() { c.watchers[agentID] = watcher })

	go func() {
		ticker := time.NewTicker(c.cfg.AgentHeartbeatInterval)
		defer ticker.Stop()

		for {
			select {
			case <-c.stop:
				return
			case <-watcher:
				return
			case <-ticker.C:
				_ = c.sessions.HeartBeat(agentID)

				if err := c.agents.HeartBeat(agentID); err != nil {
					c.raceSafe(func() { delete(c.watchers, agentID) })

					_ = c.sessions.Report(agentID, enums.TaskFailed, []*core_itf.HandoverDoc{{
						Task:    taskName,
						TLDR:    "The assistant working on this step stopped responding partway through, so the work is unfinished.",
						Outcome: "agent died before reporting: " + err.Error(),
					}})
					_ = c.agents.Kill(agentID)

					return
				}
			}
		}
	}()
}

func (c *v1) stopWatcher(agentID uuid.UUID) {
	if agentID == uuid.Nil {
		return
	}

	var watcher chan struct{}

	c.raceSafe(func() {
		watcher = c.watchers[agentID]
		delete(c.watchers, agentID)
	})

	if watcher != nil {
		close(watcher)
	}
}

func buildPrompt(spec *core_itf.TaskSpec, status *core_itf.SessionStatus) string {
	b := &strings.Builder{}

	b.WriteString("# Task: " + spec.Name + "\n")

	if guidance := strings.TrimSpace(spec.ExtraGuidance); guidance != "" {
		b.WriteString("\n" + guidance + "\n")
	}

	b.WriteString("\nYou are already running inside " + status.WorkingDirPath + "; all work happens there.\n")

	if spec.FileWriteAllowance == enums.Restricted && len(spec.AllowedFilePaths) > 0 {
		b.WriteString("\nYou may only write these paths:\n")

		for _, path := range spec.AllowedFilePaths {
			b.WriteString("- " + path + "\n")
		}
	}

	for _, dep := range spec.DependsOn {
		report, found := status.Tasks[dep]
		if !found {
			continue
		}

		for _, doc := range report.HandoverDocs {
			writeDoc(b, doc)
		}
	}

	if spec.ManualAcceptRequired {
		b.WriteString("\nA human operator reviews your report before anything downstream runs, " +
			"so nothing continues until they confirm it. Write the `outcome` field as a complete, " +
			"self-contained briefing for that operator: what you did and why, the plan you followed, " +
			"the decisions you took and the alternatives you rejected, the risks you see, and anything " +
			"that could surprise them. Assume they have not read the code or watched you work. " +
			"Also fill `approved_decisions`, `rejected_decisions`, `must_avoid`, `nuances` and " +
			"`known_gaps` wherever they apply.\n")
	}

	b.WriteString("\nWhen you are finished, call the `report_task` tool on the `" +
		constances.GatewayLocalServer +
		"` MCP server exactly once, with status completed or failed and a complete, honest handover doc. " +
		"After the tool returns, stop.\n")

	b.WriteString("\nOne field of that doc is not for the next agent. `tldr` is read by a person who has " +
		"not seen this codebase and may not know what this task was for. Write exactly one sentence " +
		"saying what you did and how you did it, in plain words a non-programmer would follow: no file " +
		"paths, no function or type names, no jargon, no abbreviations from this project. It has to make " +
		"sense on its own, to someone who reads nothing else. If you failed, say in that one sentence " +
		"what you were trying to do and what stopped you.\n")

	return b.String()
}

func writeDoc(b *strings.Builder, doc *core_itf.HandoverDoc) {
	b.WriteString("\n## Handover from \"" + doc.Task + "\"\n")
	b.WriteString("\nOutcome: " + doc.Outcome + "\n")

	sections := []struct {
		title string
		items map[string]string
	}{
		{"Blockers", doc.Blockers},
		{"Approved decisions", doc.ApprovedDecisions},
		{"Rejected decisions", doc.RejectedDecisions},
		{"Current behaviors", doc.CurrentBehaviors},
		{"Changed behaviors", doc.ChangedBehaviors},
		{"Must avoid", doc.MustAvoid},
		{"Nuances", doc.Nuances},
		{"Known gaps", doc.KnownGaps},
	}

	for _, section := range sections {
		if len(section.items) == 0 {
			continue
		}

		b.WriteString("\n### " + section.title + "\n")

		for _, key := range slices.Sorted(maps.Keys(section.items)) {
			b.WriteString("- " + key + ": " + section.items[key] + "\n")
		}
	}
}

func (c *v1) raceSafe(exec func()) {
	c.locker.Lock()
	defer c.locker.Unlock()
	exec()
}
