package core

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type NodeType string

const (
	NodeSource    NodeType = "source"
	NodeAgentTask NodeType = "agent-task"
	NodeHumanGate NodeType = "human-gate"
)

var knownTypes = map[NodeType]bool{
	NodeSource:    true,
	NodeAgentTask: true,
	NodeHumanGate: true,
}

type NodeSpec struct {
	ID     string         `yaml:"id"`
	Type   NodeType       `yaml:"type"`
	Runner string         `yaml:"runner,omitempty"`
	Needs  []string       `yaml:"needs,omitempty"`
	Config map[string]any `yaml:"config,omitempty"`
}

type Graph struct {
	Name  string     `yaml:"name"`
	Nodes []NodeSpec `yaml:"nodes"`
}

func LoadGraph(path string) (*Graph, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var g Graph
	if err := yaml.Unmarshal(data, &g); err != nil {
		return nil, fmt.Errorf("parse graph %s: %w", path, err)
	}
	if err := g.Validate(); err != nil {
		return nil, fmt.Errorf("invalid graph %s: %w", path, err)
	}
	return &g, nil
}

func (g *Graph) Validate() error {
	if len(g.Nodes) == 0 {
		return fmt.Errorf("graph has no nodes")
	}
	ids := map[string]bool{}
	for _, n := range g.Nodes {
		if n.ID == "" {
			return fmt.Errorf("node with empty id")
		}
		if ids[n.ID] {
			return fmt.Errorf("duplicate node id %q", n.ID)
		}
		ids[n.ID] = true
		if !knownTypes[n.Type] {
			return fmt.Errorf("node %q: unknown type %q", n.ID, n.Type)
		}
	}
	for _, n := range g.Nodes {
		for _, dep := range n.Needs {
			if !ids[dep] {
				return fmt.Errorf("node %q needs unknown node %q", n.ID, dep)
			}
		}
	}
	if _, err := g.TopoOrder(); err != nil {
		return err
	}
	return nil
}

func (g *Graph) TopoOrder() ([]NodeSpec, error) {
	byID := map[string]NodeSpec{}
	indegree := map[string]int{}
	dependents := map[string][]string{}
	for _, n := range g.Nodes {
		byID[n.ID] = n
		indegree[n.ID] = len(n.Needs)
		for _, dep := range n.Needs {
			dependents[dep] = append(dependents[dep], n.ID)
		}
	}
	var queue []string
	for _, n := range g.Nodes {
		if indegree[n.ID] == 0 {
			queue = append(queue, n.ID)
		}
	}
	var order []NodeSpec
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		order = append(order, byID[id])
		for _, d := range dependents[id] {
			indegree[d]--
			if indegree[d] == 0 {
				queue = append(queue, d)
			}
		}
	}
	if len(order) != len(g.Nodes) {
		return nil, fmt.Errorf("graph has a cycle")
	}
	return order, nil
}

func (n NodeSpec) ConfigString(key string) string {
	if v, ok := n.Config[key].(string); ok {
		return v
	}
	return ""
}

func (n NodeSpec) ConfigStrings(key string) []string {
	raw, ok := n.Config[key].([]any)
	if !ok {
		return nil
	}
	var out []string
	for _, v := range raw {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}
