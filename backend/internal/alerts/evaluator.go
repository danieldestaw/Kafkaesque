package alerts

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/kafkaesque/kafkaesque/internal/kafkaclient"
	"github.com/kafkaesque/kafkaesque/internal/models"
	"github.com/kafkaesque/kafkaesque/internal/storage"
)

type Evaluator struct {
	store    *storage.Store
	kafka    *kafkaclient.Service
	interval time.Duration
}

func NewEvaluator(store *storage.Store, kafka *kafkaclient.Service, interval time.Duration) *Evaluator {
	if interval <= 0 {
		interval = 60 * time.Second
	}
	return &Evaluator{store: store, kafka: kafka, interval: interval}
}

func (e *Evaluator) Run(ctx context.Context) {
	e.evaluate(ctx) // run once immediately, then on interval
	ticker := time.NewTicker(e.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.evaluate(ctx)
		}
	}
}

// EvaluateNow runs a single evaluation pass for all enabled rules.
func (e *Evaluator) EvaluateNow(ctx context.Context) {
	e.evaluate(ctx)
}

// EvaluateCluster runs all enabled rules for one cluster immediately.
func (e *Evaluator) EvaluateCluster(ctx context.Context, clusterID uuid.UUID) {
	rules, err := e.store.ListAlertRules(ctx, clusterID)
	if err != nil {
		slog.Warn("alert evaluator: list cluster rules failed", "cluster_id", clusterID, "error", err)
		return
	}
	cluster, err := e.store.GetCluster(ctx, clusterID)
	if err != nil {
		return
	}
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		e.evaluateRule(ctx, rule, cluster)
	}
}

func (e *Evaluator) evaluateRule(ctx context.Context, rule models.AlertRule, cluster *models.Cluster) {
	switch rule.RuleType {
	case "consumer_lag":
		e.evalConsumerLag(ctx, rule, cluster)
	case "offline_partitions":
		e.evalOfflinePartitions(ctx, rule, cluster)
	default:
		slog.Debug("alert evaluator: unknown rule type", "type", rule.RuleType)
	}
}

func (e *Evaluator) evaluate(ctx context.Context) {
	rules, err := e.store.ListEnabledAlertRules(ctx)
	if err != nil {
		slog.Warn("alert evaluator: list rules failed", "error", err)
		return
	}
	for _, rule := range rules {
		cluster, err := e.store.GetCluster(ctx, rule.ClusterID)
		if err != nil {
			continue
		}
		switch rule.RuleType {
		case "consumer_lag":
			e.evalConsumerLag(ctx, rule, cluster)
		case "offline_partitions":
			e.evalOfflinePartitions(ctx, rule, cluster)
		default:
			slog.Debug("alert evaluator: unknown rule type", "type", rule.RuleType)
		}
	}
}

func (e *Evaluator) evalConsumerLag(ctx context.Context, rule models.AlertRule, cluster *models.Cluster) {
	groups, err := e.kafka.ListConsumerGroups(ctx, cluster)
	if err != nil {
		slog.Warn("alert evaluator: list consumer groups failed", "cluster", cluster.Name, "error", err)
		return
	}
	var maxLag int64
	for _, g := range groups {
		if g.MaxLag > maxLag {
			maxLag = g.MaxLag
		}
		prefix := fmt.Sprintf("Consumer group %s", g.GroupID)
		if float64(g.MaxLag) <= rule.Threshold {
			_ = e.store.ResolveActiveAlertsByPrefix(ctx, rule.ID, prefix)
			continue
		}
		active, err := e.store.HasActiveAlertEvent(ctx, rule.ID, prefix)
		if err == nil && active {
			continue
		}
		msg := fmt.Sprintf("%s max lag %.0f exceeds threshold %.0f", prefix, float64(g.MaxLag), rule.Threshold)
		e.fire(ctx, rule, msg, "WARNING")
	}
	slog.Debug("alert evaluator: consumer_lag check", "cluster", cluster.Name, "rule", rule.Name, "max_lag", maxLag, "threshold", rule.Threshold)
}

func (e *Evaluator) evalOfflinePartitions(ctx context.Context, rule models.AlertRule, cluster *models.Cluster) {
	health, err := e.kafka.GetHealth(ctx, cluster)
	if err != nil {
		return
	}
	if float64(health.OfflinePartitions) <= rule.Threshold {
		return
	}
	msg := fmt.Sprintf("Cluster has %d offline partitions (threshold %.0f)", health.OfflinePartitions, rule.Threshold)
	e.fire(ctx, rule, msg, "CRITICAL")
}

func (e *Evaluator) fire(ctx context.Context, rule models.AlertRule, message, severity string) {
	_ = e.store.InsertAlertEvent(ctx, &models.AlertEvent{
		ID:        uuid.New(),
		RuleID:    rule.ID,
		ClusterID: rule.ClusterID,
		Severity:  severity,
		Message:   message,
		Status:    "ACTIVE",
	})
}
