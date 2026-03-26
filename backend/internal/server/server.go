package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"wecatch/internal/handler"
	"wecatch/internal/llm"
	"wecatch/internal/middleware"
)

func New(apiKey string, analyzer *llm.Analyzer) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.CORS)
	r.Use(middleware.APIKey(apiKey))
	r.Post("/api/analyze", handler.NewAnalyzeHandler(analyzer))
	return r
}
