package kafkaclient

import (
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"github.com/kafkaesque/kafkaesque/internal/crypto"
	"github.com/kafkaesque/kafkaesque/internal/models"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
)

func (s *Service) clientOpts(cluster *models.Cluster) ([]kgo.Opt, error) {
	seedBrokers := strings.Split(cluster.BootstrapServers, ",")
	for i := range seedBrokers {
		seedBrokers[i] = strings.TrimSpace(seedBrokers[i])
	}
	opts := []kgo.Opt{
		kgo.SeedBrokers(seedBrokers...),
		kgo.RequestTimeoutOverhead(10 * time.Second),
	}
	if cluster.TLS {
		opts = append(opts, kgo.DialTLSConfig(&tls.Config{
			MinVersion: tls.VersionTLS12,
		}))
	}
	if cluster.SASLEncrypted != "" && cluster.SASLMechanism != "" {
		password, err := crypto.Decrypt(cluster.SASLEncrypted, s.encryptionKey)
		if err != nil {
			return nil, err
		}
		mech, err := s.saslMechanism(cluster.SASLMechanism, cluster.SASLUsername, password)
		if err != nil {
			return nil, err
		}
		opts = append(opts, kgo.SASL(mech))
	}
	return opts, nil
}

func (s *Service) saslMechanism(name, user, pass string) (sasl.Mechanism, error) {
	switch strings.ToUpper(strings.TrimSpace(name)) {
	case "PLAIN":
		return plain.Auth{User: user, Pass: pass}.AsMechanism(), nil
	case "SCRAM-SHA-256", "SCRAM_SHA_256":
		return scram.Auth{User: user, Pass: pass}.AsSha256Mechanism(), nil
	case "SCRAM-SHA-512", "SCRAM_SHA_512":
		return scram.Auth{User: user, Pass: pass}.AsSha512Mechanism(), nil
	default:
		return nil, fmt.Errorf("unsupported SASL mechanism: %s", name)
	}
}
