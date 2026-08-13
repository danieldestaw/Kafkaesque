package schemaregistry

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
	return &Client{http: &http.Client{Timeout: 15 * time.Second}}
}

type SubjectVersion struct {
	Subject   string `json:"subject"`
	Version   int    `json:"version"`
	ID        int    `json:"id"`
	Schema    string `json:"schema"`
	SchemaType string `json:"schemaType,omitempty"`
}

func (c *Client) ListSubjects(ctx context.Context, baseURL string) ([]string, error) {
	var subjects []string
	if err := c.getJSON(ctx, baseURL+"/subjects", &subjects); err != nil {
		return nil, err
	}
	return subjects, nil
}

func (c *Client) GetSubjectVersions(ctx context.Context, baseURL, subject string) ([]int, error) {
	var versions []int
	path := fmt.Sprintf("%s/subjects/%s/versions", strings.TrimRight(baseURL, "/"), subject)
	if err := c.getJSON(ctx, path, &versions); err != nil {
		return nil, err
	}
	return versions, nil
}

func (c *Client) GetSchema(ctx context.Context, baseURL, subject string, version int) (*SubjectVersion, error) {
	path := fmt.Sprintf("%s/subjects/%s/versions/%d", strings.TrimRight(baseURL, "/"), subject, version)
	var raw map[string]any
	if err := c.getJSON(ctx, path, &raw); err != nil {
		return nil, err
	}
	out := &SubjectVersion{Subject: subject, Version: version}
	if id, ok := raw["id"].(float64); ok {
		out.ID = int(id)
	}
	if schema, ok := raw["schema"].(string); ok {
		out.Schema = schema
	}
	if st, ok := raw["schemaType"].(string); ok {
		out.SchemaType = st
	}
	return out, nil
}

func (c *Client) RegisterSchema(ctx context.Context, baseURL, subject, schema, schemaType string) (int, error) {
	if schemaType == "" {
		schemaType = "AVRO"
	}
	body := map[string]string{"schema": schema, "schemaType": schemaType}
	path := fmt.Sprintf("%s/subjects/%s/versions", strings.TrimRight(baseURL, "/"), subject)
	var resp map[string]any
	if err := c.postJSON(ctx, path, body, &resp); err != nil {
		return 0, err
	}
	if id, ok := resp["id"].(float64); ok {
		return int(id), nil
	}
	return 0, fmt.Errorf("unexpected registry response")
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
		return fmt.Errorf("schema registry error %d: %s", res.StatusCode, string(b))
	}
	return json.NewDecoder(res.Body).Decode(dest)
}

func (c *Client) postJSON(ctx context.Context, url string, body, dest any) error {
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(raw)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/vnd.schemaregistry.v1+json")
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("schema registry error %d: %s", res.StatusCode, string(b))
	}
	if dest == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(dest)
}
