package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kafkaesque/kafkaesque/internal/alerts"
	"github.com/kafkaesque/kafkaesque/internal/api"
	"github.com/kafkaesque/kafkaesque/internal/config"
	"github.com/kafkaesque/kafkaesque/internal/kafkaclient"
	"github.com/kafkaesque/kafkaesque/internal/storage"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	if err := cfg.Validate(); err != nil {
		logger.Error("configuration invalid", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()
	store, err := storage.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer store.Close()

	if err := store.EnsureAdmin(ctx, cfg.DefaultAdminUser, cfg.DefaultAdminPass); err != nil {
		logger.Error("admin seed failed", "error", err)
		os.Exit(1)
	}

	srv := api.NewServer(cfg, store)

	evalCtx, evalCancel := context.WithCancel(context.Background())
	defer evalCancel()
	go alerts.NewEvaluator(store, kafkaclient.NewService(cfg.EncryptionKey), 15*time.Second).Run(evalCtx)

	httpServer := &http.Server{
		Addr:              ":" + cfg.HTTPPort,
		Handler:           srv.Router(),
		ReadTimeout:       30 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		logger.Info("kafkaesque backend starting", "env", cfg.Env, "port", cfg.HTTPPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	evalCancel()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
	logger.Info("kafkaesque backend stopped")
}
