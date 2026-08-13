package kafkaconnect

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	http *http.Client
}

func NewClient() *Client {
	return &Client{http: &http.Client{Timeout: 20 * time.Second}}
}

type ConnectorInfo struct {
	Name   string            `json:"name"`
	Config map[string]string `json:"config"`
	Tasks  []TaskInfo        `json:"tasks"`
	Type   string            `json:"type"`
	State  string            `json:"state"`
}

type TaskInfo struct {
	ID     int    `json:"id"`
	State  string `json:"state"`
	Worker string `json:"worker_id"`
}

func (c *Client) ListConnectors(ctx context.Context, baseURL string) ([]string, error) {
	var names []string
	if err := c.getJSON(ctx, strings.TrimRight(baseURL, "/")+"/connectors", &names); err != nil {
		return nil, err
	}
	return names, nil
}

func (c *Client) GetConnector(ctx context.Context, baseURL, name string) (*ConnectorInfo, error) {
	base := strings.TrimRight(baseURL, "/")
	var cfg map[string]string
	if err := c.getJSON(ctx, fmt.Sprintf("%s/connectors/%s/config", base, name), &cfg); err != nil {
		return nil, err
	}
	var status struct {
		Name      string `json:"name"`
		Connector struct {
			State string `json:"state"`
			Type  string `json:"worker_id"`
		} `json:"connector"`
		Tasks []TaskInfo `json:"tasks"`
	}
	if err := c.getJSON(ctx, fmt.Sprintf("%s/connectors/%s/status", base, name), &status); err != nil {
		return &ConnectorInfo{Name: name, Config: cfg}, nil
	}
	state := status.Connector.State
	return &ConnectorInfo{
		Name:   name,
		Config: cfg,
		Tasks:  status.Tasks,
		State:  state,
	}, nil
}

func (c *Client) CreateConnector(ctx context.Context, baseURL, name string, config map[string]string) error {
	body := map[string]any{"name": name, "config": config}
	return c.postJSON(ctx, fmt.Sprintf("%s/connectors", strings.TrimRight(baseURL, "/")), body, nil)
}

func (c *Client) DeleteConnector(ctx context.Context, baseURL, name string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, fmt.Sprintf("%s/connectors/%s", strings.TrimRight(baseURL, "/"), name), nil)
	if err != nil {
		return err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("connect error %d: %s", res.StatusCode, string(b))
	}
	return nil
}

func (c *Client) RestartConnector(ctx context.Context, baseURL, name string) error {
	return c.postJSON(ctx, fmt.Sprintf("%s/connectors/%s/restart", strings.TrimRight(baseURL, "/"), name), nil, nil)
}

func (c *Client) getJSON(ctx context.Context, url string, dest any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("connect error %d: %s", res.StatusCode, string(b))
	}
	return json.NewDecoder(res.Body).Decode(dest)
}

func (c *Client) postJSON(ctx context.Context, url string, body any, dest any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = strings.NewReader(string(raw))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("connect error %d: %s", res.StatusCode, string(b))
	}
	if dest == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(dest)
}
