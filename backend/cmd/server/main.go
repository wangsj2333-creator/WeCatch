package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/config"
)

func main() {
	cfg := config.Load()

	mux := http.NewServeMux()
	log.Printf("WeCatch server starting on port %s", cfg.Port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", cfg.Port), mux); err != nil {
		log.Fatal(err)
	}
}
