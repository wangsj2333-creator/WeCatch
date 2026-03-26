package config

import "os"

type Config struct {
	Port       string
	APIKey     string
	QianwenKey string
}

func Load() Config {
	return Config{
		Port:       getEnv("PORT", "8080"),
		APIKey:     mustEnv("API_KEY"),
		QianwenKey: mustEnv("QIANWEN_API_KEY"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required env var not set: " + key)
	}
	return v
}
