package kafkaclient

import (
	"context"
	"fmt"
	"strings"

	"github.com/kafkaesque/kafkaesque/internal/models"
	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kerr"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/kmsg"
)

type ACLInfo struct {
	Principal      string `json:"principal"`
	Host           string `json:"host"`
	Operation      string `json:"operation"`
	PermissionType string `json:"permission_type"`
	ResourceType   string `json:"resource_type"`
	ResourceName   string `json:"resource_name"`
	PatternType    string `json:"pattern_type"`
}

type ACLCreateRequest struct {
	Principal      string `json:"principal"`
	Host           string `json:"host"`
	Operation      string `json:"operation"`
	PermissionType string `json:"permission_type"`
	ResourceType   string `json:"resource_type"`
	ResourceName   string `json:"resource_name"`
	PatternType    string `json:"pattern_type"`
}

func (s *Service) kafkaClient(cluster *models.Cluster) (*kgo.Client, func(), error) {
	opts, err := s.clientOpts(cluster)
	if err != nil {
		return nil, nil, err
	}
	cl, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, nil, err
	}
	return cl, func() { cl.Close() }, nil
}

func (s *Service) ListACLs(ctx context.Context, cluster *models.Cluster, resourceType, resourceName string) ([]ACLInfo, error) {
	cl, cleanup, err := s.kafkaClient(cluster)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	req := kmsg.NewPtrDescribeACLsRequest()
	req.ResourceType = kmsg.ACLResourceTypeAny
	req.ResourcePatternType = kmsg.ACLResourcePatternTypeAny
	req.Operation = kmsg.ACLOperationAny
	req.PermissionType = kmsg.ACLPermissionTypeAny

	if resourceType != "" {
		req.ResourceType = kmsgResourceType(resourceType)
		if resourceName != "" {
			req.ResourceName = kmsg.StringPtr(resourceName)
			req.ResourcePatternType = kmsg.ACLResourcePatternTypeLiteral
		}
	}

	resp, err := req.RequestWith(ctx, cl)
	if err != nil {
		return nil, err
	}
	if err := kerr.ErrorForCode(resp.ErrorCode); err != nil {
		return nil, err
	}

	out := make([]ACLInfo, 0)
	for _, resource := range resp.Resources {
		for _, acl := range resource.ACLs {
			out = append(out, ACLInfo{
				Principal:      acl.Principal,
				Host:           acl.Host,
				Operation:      aclOperationName(kadm.ACLOperation(acl.Operation)),
				PermissionType: aclPermissionName(acl.PermissionType),
				ResourceType:   aclResourceName(resource.ResourceType),
				ResourceName:   resource.ResourceName,
				PatternType:    aclPatternName(kadm.ACLPattern(resource.ResourcePatternType)),
			})
		}
	}
	return out, nil
}

func kmsgResourceType(resourceType string) kmsg.ACLResourceType {
	switch strings.ToUpper(strings.TrimSpace(resourceType)) {
	case "TOPIC":
		return kmsg.ACLResourceTypeTopic
	case "GROUP":
		return kmsg.ACLResourceTypeGroup
	case "CLUSTER":
		return kmsg.ACLResourceTypeCluster
	case "TRANSACTIONAL_ID":
		return kmsg.ACLResourceTypeTransactionalId
	case "DELEGATION_TOKEN":
		return kmsg.ACLResourceTypeDelegationToken
	default:
		return kmsg.ACLResourceTypeAny
	}
}

func (s *Service) CreateACL(ctx context.Context, cluster *models.Cluster, req ACLCreateRequest) error {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return err
	}
	defer cleanup()

	b, err := buildACLBuilder(req)
	if err != nil {
		return err
	}
	_, err = adm.CreateACLs(ctx, b)
	return err
}

func (s *Service) DeleteACL(ctx context.Context, cluster *models.Cluster, req ACLCreateRequest) error {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return err
	}
	defer cleanup()

	b, err := buildACLFilter(req)
	if err != nil {
		return err
	}
	_, err = adm.DeleteACLs(ctx, b)
	return err
}

func buildACLBuilder(req ACLCreateRequest) (*kadm.ACLBuilder, error) {
	op, err := parseACLOperation(req.Operation)
	if err != nil {
		return nil, err
	}
	pattern, err := parseACLPattern(req.PatternType)
	if err != nil {
		return nil, err
	}
	b := applyACLResource(kadm.NewACLs(), req.ResourceType, req.ResourceName)
	b = b.Operations(op).ResourcePatternType(pattern)
	host := defaultHost(req.Host)
	if strings.EqualFold(req.PermissionType, "DENY") {
		b = b.Deny(req.Principal).DenyHosts(host)
		b.PrefixUser()
		return b, nil
	}
	b = b.Allow(req.Principal).AllowHosts(host)
	b.PrefixUser()
	return b, nil
}

func buildACLFilter(req ACLCreateRequest) (*kadm.ACLBuilder, error) {
	op, err := parseACLOperation(req.Operation)
	if err != nil {
		return nil, err
	}
	pattern, err := parseACLPattern(req.PatternType)
	if err != nil {
		return nil, err
	}
	b := applyACLResource(kadm.NewACLs(), req.ResourceType, req.ResourceName)
	b = b.Operations(op).ResourcePatternType(pattern)
	host := defaultHost(req.Host)
	if strings.EqualFold(req.PermissionType, "DENY") {
		b = b.Deny(req.Principal).DenyHosts(host)
		b.PrefixUser()
		return b, nil
	}
	b = b.Allow(req.Principal).AllowHosts(host)
	b.PrefixUser()
	return b, nil
}

func applyACLResource(b *kadm.ACLBuilder, resourceType, resourceName string) *kadm.ACLBuilder {
	switch strings.ToUpper(strings.TrimSpace(resourceType)) {
	case "TOPIC":
		if resourceName != "" {
			return b.Topics(resourceName)
		}
		return b.Topics()
	case "GROUP":
		if resourceName != "" {
			return b.Groups(resourceName)
		}
		return b.Groups()
	case "CLUSTER":
		return b.Clusters()
	case "TRANSACTIONAL_ID":
		if resourceName != "" {
			return b.TransactionalIDs(resourceName)
		}
		return b.TransactionalIDs()
	case "DELEGATION_TOKEN":
		if resourceName != "" {
			return b.DelegationTokens(resourceName)
		}
		return b.DelegationTokens()
	default:
		return b.AnyResource()
	}
}

func parseACLOperation(op string) (kadm.ACLOperation, error) {
	switch strings.ToUpper(strings.TrimSpace(op)) {
	case "READ":
		return kadm.OpRead, nil
	case "WRITE":
		return kadm.OpWrite, nil
	case "CREATE":
		return kadm.OpCreate, nil
	case "DELETE":
		return kadm.OpDelete, nil
	case "ALTER":
		return kadm.OpAlter, nil
	case "DESCRIBE":
		return kadm.OpDescribe, nil
	case "CLUSTER_ACTION":
		return kadm.OpClusterAction, nil
	case "DESCRIBE_CONFIGS":
		return kadm.OpDescribeConfigs, nil
	case "ALTER_CONFIGS":
		return kadm.OpAlterConfigs, nil
	case "IDEMPOTENT_WRITE":
		return kadm.OpIdempotentWrite, nil
	case "ALL":
		return kadm.OpAll, nil
	case "ANY", "":
		return kadm.OpAny, nil
	default:
		return kadm.OpUnknown, fmt.Errorf("unsupported operation: %s", op)
	}
}

func parseACLPattern(p string) (kadm.ACLPattern, error) {
	switch strings.ToUpper(strings.TrimSpace(p)) {
	case "LITERAL", "":
		return kadm.ACLPatternLiteral, nil
	case "PREFIXED":
		return kadm.ACLPatternPrefixed, nil
	case "MATCH":
		return kadm.ACLPatternMatch, nil
	case "ANY":
		return kadm.ACLPatternAny, nil
	default:
		return kadm.ACLPatternUnknown, fmt.Errorf("unsupported pattern type: %s", p)
	}
}

func aclResourceName(t kmsg.ACLResourceType) string {
	switch t {
	case kmsg.ACLResourceTypeTopic:
		return "TOPIC"
	case kmsg.ACLResourceTypeGroup:
		return "GROUP"
	case kmsg.ACLResourceTypeCluster:
		return "CLUSTER"
	case kmsg.ACLResourceTypeTransactionalId:
		return "TRANSACTIONAL_ID"
	case kmsg.ACLResourceTypeDelegationToken:
		return "DELEGATION_TOKEN"
	default:
		return strings.ToUpper(t.String())
	}
}

func aclOperationName(op kadm.ACLOperation) string {
	if op == kadm.OpAny {
		return "ANY"
	}
	return strings.ToUpper(op.String())
}

func aclPermissionName(p kmsg.ACLPermissionType) string {
	switch p {
	case kmsg.ACLPermissionTypeAllow:
		return "ALLOW"
	case kmsg.ACLPermissionTypeDeny:
		return "DENY"
	default:
		return strings.ToUpper(p.String())
	}
}

func aclPatternName(p kadm.ACLPattern) string {
	switch p {
	case kadm.ACLPatternLiteral:
		return "LITERAL"
	case kadm.ACLPatternPrefixed:
		return "PREFIXED"
	case kadm.ACLPatternMatch:
		return "MATCH"
	case kadm.ACLPatternAny:
		return "ANY"
	default:
		return strings.ToUpper(p.String())
	}
}

func defaultHost(host string) string {
	if strings.TrimSpace(host) == "" {
		return "*"
	}
	return host
}

func (s *Service) ListConsumerGroupsWithLag(ctx context.Context, cluster *models.Cluster) ([]ConsumerGroupInfo, error) {
	adm, cleanup, err := s.adminClient(cluster)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	groups, err := adm.ListGroups(ctx)
	if err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return nil, nil
	}

	names := groups.Groups()
	lags, err := adm.Lag(ctx, names...)
	if err != nil {
		return s.listConsumerGroupsBasic(ctx, adm, groups)
	}

	var result []ConsumerGroupInfo
	for _, g := range groups.Sorted() {
		info := ConsumerGroupInfo{GroupID: g.Group, State: g.State}
		if described, err := adm.DescribeGroups(ctx, g.Group); err == nil {
			if dg, ok := described[g.Group]; ok {
				info.Members = len(dg.Members)
				info.State = string(dg.State)
			}
		}
		if lagInfo, ok := lags[g.Group]; ok {
			var total int64
			var max int64
			topics := map[string]struct{}{}
			for topic, parts := range lagInfo.Lag {
				topics[topic] = struct{}{}
				for _, part := range parts {
					if part.Lag < 0 {
						continue
					}
					total += part.Lag
					if part.Lag > max {
						max = part.Lag
					}
				}
			}
			info.TotalLag = total
			info.MaxLag = max
			info.Topics = len(topics)
		}
		result = append(result, info)
	}
	return result, nil
}

func (s *Service) listConsumerGroupsBasic(ctx context.Context, adm *kadm.Client, groups kadm.ListedGroups) ([]ConsumerGroupInfo, error) {
	var result []ConsumerGroupInfo
	for _, g := range groups.Sorted() {
		info := ConsumerGroupInfo{GroupID: g.Group, State: g.State}
		if described, err := adm.DescribeGroups(ctx, g.Group); err == nil {
			if dg, ok := described[g.Group]; ok {
				info.Members = len(dg.Members)
				info.State = string(dg.State)
			}
		}
		result = append(result, info)
	}
	return result, nil
}

func (s *Service) ListConsumerGroups(ctx context.Context, cluster *models.Cluster) ([]ConsumerGroupInfo, error) {
	return s.ListConsumerGroupsWithLag(ctx, cluster)
}

func (s *Service) ValidateACLRequest(req ACLCreateRequest) error {
	if req.Principal == "" {
		return fmt.Errorf("principal is required")
	}
	if req.Operation == "" || req.PermissionType == "" || req.ResourceType == "" {
		return fmt.Errorf("operation, permission_type, and resource_type are required")
	}
	if req.PatternType == "" {
		req.PatternType = "LITERAL"
	}
	return nil
}
