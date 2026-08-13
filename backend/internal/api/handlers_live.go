package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/kafkaesque/kafkaesque/internal/auth"
)

func (s *Server) liveTailMessages(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.requirePerm(w, r, "message.read"); !ok {
		return
	}
	c, err := s.loadCluster(w, r)
	if err != nil {
		return
	}
	topic := chi.URLParam(r, "topic")
	partition := int32(0)
	if p := r.URL.Query().Get("partition"); p != "" {
		if v, err := strconv.ParseInt(p, 10, 32); err == nil {
			partition = int32(v)
		}
	}

	origins := s.cfg.CORSOrigins
	if len(origins) == 0 {
		origins = []string{"*"}
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: origins})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "done")

	ctx := r.Context()
	var lastOffset int64 = -1
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			msgs, err := s.kafka.FetchMessages(ctx, c, topic, partition, lastOffset+1, 20)
			if err != nil {
				continue
			}
			for _, m := range msgs {
				if m.Offset <= lastOffset {
					continue
				}
				lastOffset = m.Offset
				payload, _ := json.Marshal(m)
				_ = conn.Write(ctx, websocket.MessageText, payload)
			}
		}
	}
}

func (s *Server) liveTailUpgrade(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		header := r.Header.Get("Authorization")
		if strings.HasPrefix(header, "Bearer ") {
			token = strings.TrimPrefix(header, "Bearer ")
		}
	}
	if token == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	claims, err := s.auth.ParseToken(token)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	user, err := s.store.GetUserByID(r.Context(), claims.UserID)
	if err != nil || !user.IsActive || claims.TokenVersion != user.TokenVersion {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	ctx := context.WithValue(r.Context(), auth.UserContextKey, user)
	s.liveTailMessages(w, r.WithContext(ctx))
}
