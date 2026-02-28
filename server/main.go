package main

import (
	"context"
	"flag"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

func handleWebSocket(rooms *RoomManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("WebSocket upgrade failed", "error", err)
			return
		}

		client := NewClient(conn, rooms)
		go client.WritePump()
		client.ReadPump()
	}
}

// spaHandler serves static files and falls back to index.html for client-side routing.
func spaHandler(dir string) http.Handler {
	fileSystem := http.Dir(dir)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to open the requested file
		f, err := fileSystem.Open(r.URL.Path)
		if err != nil {
			// File not found — serve index.html for SPA routing
			http.ServeFile(w, r, dir+"/index.html")
			return
		}

		defer f.Close()

		// Check if path is a directory (not a file)
		stat, err := f.Stat()
		if err != nil || stat.IsDir() {
			// For directories, check if index.html exists inside
			index, indexErr := fileSystem.Open(r.URL.Path + "/index.html")
			if indexErr != nil {
				if pathErr, ok := indexErr.(*fs.PathError); ok && os.IsNotExist(pathErr.Err) {
					http.ServeFile(w, r, dir+"/index.html")
					return
				}
			} else {
				index.Close()
			}
		}

		http.FileServer(fileSystem).ServeHTTP(w, r)
	})
}

func main() {
	staticDir := flag.String("static", "", "directory to serve static files from (Angular dist)")
	flag.Parse()

	rooms := NewRoomManager()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handleWebSocket(rooms))

	if *staticDir != "" {
		slog.Info("serving static files", "dir", *staticDir)
		mux.Handle("/", spaHandler(*staticDir))
	}

	server := &http.Server{
		Addr:    ":8080",
		Handler: mux,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("server starting", "addr", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-stop
	slog.Info("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
