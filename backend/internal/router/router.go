package router

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/handlers"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/middleware"
	"github.com/wangsj2333-creator/WeCatch/backend/internal/services"
	"gorm.io/gorm"
)

// New builds and returns the application HTTP handler with all routes wired up.
func New(db *gorm.DB, jwtSecret string, classifier *services.Classifier) http.Handler {
	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"chrome-extension://*", "http://localhost:*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
	}))

	auth := &handlers.AuthHandler{DB: db, JWTSecret: jwtSecret}
	user := &handlers.UserHandler{DB: db}
	account := &handlers.AccountHandler{DB: db}
	article := &handlers.ArticleHandler{DB: db}
	comment := &handlers.CommentHandler{DB: db, Classifier: classifier}

	// Public routes
	r.Post("/api/auth/login", auth.Login)
	r.Post("/api/auth/logout", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.JWTAuth(jwtSecret))

		r.Get("/api/users", user.List)
		r.Post("/api/users", user.Create)

		r.Get("/api/accounts", account.List)
		r.Post("/api/accounts", account.Create)

		r.Get("/api/accounts/{accountID}/articles", func(w http.ResponseWriter, r *http.Request) {
			id, err := strconv.ParseInt(chi.URLParam(r, "accountID"), 10, 64)
			if err != nil {
				http.Error(w, "invalid account id", http.StatusBadRequest)
				return
			}
			article.List(w, r, id)
		})

		r.Post("/api/comments/batch", comment.Batch)

		r.Get("/api/articles/{articleID}/comments", func(w http.ResponseWriter, r *http.Request) {
			id, err := strconv.ParseInt(chi.URLParam(r, "articleID"), 10, 64)
			if err != nil {
				http.Error(w, "invalid article id", http.StatusBadRequest)
				return
			}
			comment.List(w, r, id)
		})

		r.Put("/api/comments/{commentID}/status", func(w http.ResponseWriter, r *http.Request) {
			id, err := strconv.ParseInt(chi.URLParam(r, "commentID"), 10, 64)
			if err != nil {
				http.Error(w, "invalid comment id", http.StatusBadRequest)
				return
			}
			comment.UpdateStatus(w, r, id)
		})
	})

	return r
}
