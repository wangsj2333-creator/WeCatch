package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/wangsj2333-creator/WeCatch/backend/internal/config"
)

func main() {
	cfg := config.Load()

	log.Printf("WeCatch server starting on port %s", cfg.Port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", cfg.Port), nil); err != nil {
		log.Fatal(err)
	}
}
