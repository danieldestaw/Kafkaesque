package kafkaclient

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/streamforge/streamforge/internal/crypto"
	"github.com/streamforge/streamforge/internal/models"
	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/plain"
)

type Service struct {
	encryptionKey string
}

func NewService(encryptionKey string) *Service {
	return &Service{encryptionKey: encryptionKey}
}

func (s *Service) adminClient(cluster *models.Cluster) (*kadm.Client, func(), error) {
	opts, err := s.clientOpts(cluster)
	if err != nil {
		return nil, nil, err
	}
	cl, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, nil, err
	}
	cleanup := func() { cl.Close() }
	return kadm.NewClient(cl), cleanup, nil
}

func (s *Service) clientOpts(cluster *models.Cluster) ([]kgo.Opt, error) {
	seedBrokers := strings.Split(cluster.BootstrapServers, ",")
	for i := range seedBrokers {
		seedBrokers[i] = strings.TrimSpace(seedBrokers[i])
	}
	opts := []kgo.Opt{
		kgo.SeedBrokers(seedBrokers...),
		kgo.RequestTimeoutOverhead(10 * time.Second),
	}
	if cluster.SASLEncrypted != "" && cluster.SASLMechanism != "" {
		password, err := crypto.Decrypt(cluster.SASLEncrypted, s.encryptionKey)
		if err != nil {
			return nil, err
		}
		switch strings.ToUpper(cluster.SASLMechanism) {
		case "PLAIN":
			opts = append(opts, kgo.SASL(plain.Auth{User: cluster.SASLUsername, Pass: password}.AsMechanism()))
		default:
			return nil, fmt.Errorf("unsupported SASL mechanism: %s", cluster.SASLMechanism)
		}
	}
	return opts, nil
}

type ClusterHealth struct {
	ClusterID          string `json:"cluster_id"`
	BrokerCount        int    `json:"broker_count"`
	TopicCount         int    `json:"topic_count"`
	PartitionCount     int    `json:"partition_count"`
	ConsumerGroupCount int    `json:"consumer_group_count"`
	ControllerID       int32  `json:"controller_id"`
	OfflinePartitions  int    `json:"offline_partitions"`
	UnderReplicated    int    `json:"under_replicated_partitions"`
	Status             string `json:"status"`
}

type BrokerInfo struct {
	ID            int32  `json:"id"`
	Host          string `json:"host"`
	Port          int32  `json:"port"`
	Rack          string `json:"rack,omitempty"`
	IsController  bool   `json:"is_controller"`
	PartitionCount int   `json:"partition_count"`
}

type TopicInfo struct {
	Name              string `json:"name"`
	Partitions        int    `json:"partitions"`
	ReplicationFactor int    `json:"replication_factor"`
	Internal          bool   `json:"internal"`
}

type PartitionInfo struct {
	Topic          string  `json:"topic"`
	Partition      int32   `json:"partition"`
	Leader         int32   `json:"leader"`
	Replicas       []int32 `json:"replicas"`
	ISR            []int32 `json:"isr"`
	BeginOffset      int64   `json:"begin_offset"`
	EndOffset        int64   `json:"end_offset"`
	MessageCount     int64   `json:"message_count"`
	UnderReplicated  bool    `json:"under_replicated"`
}

type ConsumerGroupInfo struct {
	GroupID   string `json:"group_id"`
	State     string `json:"state"`
	Members   int    `json:"members"`
	Topics    int    `json:"topics"`
	TotalLag  int64  `json:"total_lag"`
	MaxLag    int64  `json:"max_lag"`
}

type MessageRecord struct {
	Topic     string            `json:"topic"`
	Partition int32             `json:"partition"`
	Offset    int64             `json:"offset"`
	Timestamp time.Time         `json:"timestamp"`
	Key       string            `json:"key,omitempty"`
	Value     string            `json:"value"`
	Headers   map[string]string `json:"headers,omitempty"`
}

func (s *Service) TestConnection(ctx context.Context, cluster *models.Cluster) error {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return err
	}
	defer cleanup()
	_, err = adm.Metadata(ctx)
	return err
}

func (s *Service) GetHealth(ctx context.Context, cluster *models.Cluster) (*ClusterHealth, error) {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	meta, err := adm.Metadata(ctx)
	if err != nil {
		return nil, err
	}

	groups, err := adm.ListGroups(ctx)
	if err != nil {
		return nil, err
	}

	health := &ClusterHealth{
		ClusterID:          cluster.ID.String(),
		BrokerCount:        len(meta.Brokers),
		TopicCount:         len(meta.Topics),
		ConsumerGroupCount: len(groups),
		ControllerID:       meta.Controller,
		Status:             "HEALTHY",
	}

	for _, t := range meta.Topics {
		health.PartitionCount += len(t.Partitions)
		for _, p := range t.Partitions {
			if len(p.ISR) < len(p.Replicas) {
				health.UnderReplicated++
			}
			if p.Leader < 0 {
				health.OfflinePartitions++
			}
		}
	}
	if health.OfflinePartitions > 0 {
		health.Status = "DEGRADED"
	}
	return health, nil
}

func (s *Service) ListBrokers(ctx context.Context, cluster *models.Cluster) ([]BrokerInfo, error) {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	meta, err := adm.Metadata(ctx)
	if err != nil {
		return nil, err
	}
	partitionCounts := map[int32]int{}
	for _, t := range meta.Topics {
		for _, p := range t.Partitions {
			partitionCounts[p.Leader]++
		}
	}
	var brokers []BrokerInfo
	for _, b := range meta.Brokers {
		host, portStr, _ := strings.Cut(b.Host, ":")
		port, _ := strconv.ParseInt(portStr, 10, 32)
		rack := ""
		if b.Rack != nil {
			rack = *b.Rack
		}
		brokers = append(brokers, BrokerInfo{
			ID:             b.NodeID,
			Host:           host,
			Port:           int32(port),
			Rack:           rack,
			IsController:   b.NodeID == meta.Controller,
			PartitionCount: partitionCounts[b.NodeID],
		})
	}
	return brokers, nil
}

func (s *Service) ListTopics(ctx context.Context, cluster *models.Cluster) ([]TopicInfo, error) {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	meta, err := adm.Metadata(ctx)
	if err != nil {
		return nil, err
	}
	var topics []TopicInfo
	for _, t := range meta.Topics {
		rf := 0
		if len(t.Partitions) > 0 {
			rf = len(t.Partitions[0].Replicas)
		}
		topics = append(topics, TopicInfo{
			Name:              t.Topic,
			Partitions:        len(t.Partitions),
			ReplicationFactor: rf,
			Internal:          strings.HasPrefix(t.Topic, "__"),
		})
	}
	return topics, nil
}

func (s *Service) CreateTopic(ctx context.Context, cluster *models.Cluster, name string, partitions, rf int, configs map[string]string) error {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return err
	}
	defer cleanup()
	_, err = adm.CreateTopics(ctx, int32(partitions), int16(rf), nil, name)
	return err
}

func (s *Service) DeleteTopic(ctx context.Context, cluster *models.Cluster, name string) error {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return err
	}
	defer cleanup()
	_, err = adm.DeleteTopics(ctx, name)
	return err
}

func (s *Service) ListPartitions(ctx context.Context, cluster *models.Cluster, topic string) ([]PartitionInfo, error) {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	meta, err := adm.Metadata(ctx, topic)
	if err != nil {
		return nil, err
	}
	var parts []PartitionInfo
	for _, t := range meta.Topics {
		if t.Topic != topic {
			continue
		}
		for _, p := range t.Partitions {
			begin, end, err := s.offsets(ctx, cluster, topic, p.Partition)
			if err != nil {
				begin, end = 0, 0
			}
			parts = append(parts, PartitionInfo{
				Topic:         topic,
				Partition:     p.Partition,
				Leader:        p.Leader,
				Replicas:      p.Replicas,
				ISR:           p.ISR,
				BeginOffset:   begin,
				EndOffset:     end,
				MessageCount:  max(0, end-begin),
				UnderReplicated: len(p.ISR) < len(p.Replicas),
			})
		}
	}
	return parts, nil
}

func (s *Service) offsets(ctx context.Context, cluster *models.Cluster, topic string, partition int32) (int64, int64, error) {
	opts, err := s.clientOpts(cluster)
	if err != nil {
		return 0, 0, err
	}
	cl, err := kgo.NewClient(opts...)
	if err != nil {
		return 0, 0, err
	}
	defer cl.Close()
	adm := kadm.NewClient(cl)
	start, err := adm.ListStartOffsets(ctx, topic)
	if err != nil {
		return 0, 0, err
	}
	end, err := adm.ListEndOffsets(ctx, topic)
	if err != nil {
		return 0, 0, err
	}
	var beginOff, endOff int64
	if o, ok := start.Lookup(topic, partition); ok {
		beginOff = o.Offset
	}
	if o, ok := end.Lookup(topic, partition); ok {
		endOff = o.Offset
	}
	return beginOff, endOff, nil
}

func (s *Service) ListConsumerGroups(ctx context.Context, cluster *models.Cluster) ([]ConsumerGroupInfo, error) {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	groups, err := adm.ListGroups(ctx)
	if err != nil {
		return nil, err
	}
	var result []ConsumerGroupInfo
	for _, g := range groups {
		described, err := adm.DescribeGroups(ctx, g.Group)
		if err != nil {
			result = append(result, ConsumerGroupInfo{GroupID: g.Group, State: string(g.State)})
			continue
		}
		dg := described[g.Group]
		info := ConsumerGroupInfo{
			GroupID: g.Group,
			State:   string(dg.State),
			Members: len(dg.Members),
		}
		result = append(result, info)
	}
	return result, nil
}

func (s *Service) FetchMessages(ctx context.Context, cluster *models.Cluster, topic string, partition int32, offset int64, limit int) ([]MessageRecord, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		begin, _, err := s.offsets(ctx, cluster, topic, partition)
		if err != nil {
			return nil, err
		}
		offset = begin
	}
	begin, end, err := s.offsets(ctx, cluster, topic, partition)
	if err != nil {
		return nil, err
	}
	if offset >= end {
		return []MessageRecord{}, nil
	}
	if offset < begin {
		offset = begin
	}
	fetchCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	opts, err := s.clientOpts(cluster)
	if err != nil {
		return nil, err
	}
	opts = append(opts,
		kgo.ConsumePartitions(map[string]map[int32]kgo.Offset{
			topic: {partition: kgo.NewOffset().At(offset)},
		}),
	)
	cl, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, err
	}
	defer cl.Close()

	var records []MessageRecord
	for len(records) < limit {
		fetches := cl.PollFetches(fetchCtx)
		if err := fetches.Err(); err != nil {
			if len(records) > 0 {
				return records, nil
			}
			return records, err
		}
		if errs := fetches.Errors(); len(errs) > 0 {
			if len(records) > 0 {
				return records, nil
			}
			return records, errs[0].Err
		}
		before := len(records)
		fetches.EachRecord(func(r *kgo.Record) {
			if len(records) >= limit {
				return
			}
			headers := map[string]string{}
			for _, h := range r.Headers {
				headers[h.Key] = string(h.Value)
			}
			records = append(records, MessageRecord{
				Topic:     r.Topic,
				Partition: r.Partition,
				Offset:    r.Offset,
				Timestamp: r.Timestamp,
				Key:       string(r.Key),
				Value:     string(r.Value),
				Headers:   headers,
			})
		})
		if len(records) == before {
			break
		}
	}
	return records, nil
}

func (s *Service) PublishMessage(ctx context.Context, cluster *models.Cluster, topic, key, value string, partition *int32, headers map[string]string) (int32, int64, error) {
	opts, err := s.clientOpts(cluster)
	if err != nil {
		return 0, 0, err
	}
	cl, err := kgo.NewClient(opts...)
	if err != nil {
		return 0, 0, err
	}
	defer cl.Close()

	hdr := make([]kgo.RecordHeader, 0, len(headers))
	for k, v := range headers {
		hdr = append(hdr, kgo.RecordHeader{Key: k, Value: []byte(v)})
	}
	rec := &kgo.Record{
		Topic:   topic,
		Key:     []byte(key),
		Value:   []byte(value),
		Headers: hdr,
	}
	if partition != nil {
		rec.Partition = *partition
	}
	if err := cl.ProduceSync(ctx, rec).FirstErr(); err != nil {
		return 0, 0, err
	}
	return rec.Partition, rec.Offset, nil
}

func (s *Service) ResetOffsets(ctx context.Context, cluster *models.Cluster, group, topic string, partition int32, offset int64) error {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return err
	}
	defer cleanup()
	toCommit := kadm.Offsets{}
	toCommit.Add(kadm.Offset{
		Topic:       topic,
		Partition:   partition,
		At:          offset,
	})
	_, err = adm.CommitOffsets(ctx, group, toCommit)
	return err
}
