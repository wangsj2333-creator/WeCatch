package main

import (
	"fmt"
	"net/http"

	"github.com/joho/godotenv"
	"wecatch/internal/config"
	"wecatch/internal/llm"
	"wecatch/internal/server"
)

func main() {
	godotenv.Load()
	cfg := config.Load()
	client := llm.NewClient(cfg.QianwenKey)
	analyzer := llm.NewAnalyzer(client)
	h := server.New(cfg.APIKey, analyzer)
	fmt.Printf("server starting on :%s\n", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, h); err != nil {
		fmt.Printf("server error: %v\n", err)
	}
}
