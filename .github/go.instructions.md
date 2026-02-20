---
description: 'Go coding standards and best practices'
applyTo: '**/*.go'
---

# Go Coding Standards

## Project Structure
- Backend code lives in the `/server` directory
- Use Go modules (`go.mod`) for dependency management
- Organize code by responsibility (handlers, models, services)

## Code Style
- Follow [Effective Go](https://go.dev/doc/effective_go) conventions
- Use `gofmt` / `goimports` for formatting — never commit unformatted code
- Keep functions short and focused on a single task
- Use meaningful, concise names; avoid stuttering (e.g., `room.Room` is bad, `room.State` is good)

## Error Handling
- Always check and handle errors explicitly — never use `_` to discard errors
- Return errors to callers; wrap with context using `fmt.Errorf("doing X: %w", err)`
- Use sentinel errors or custom error types for errors that callers need to distinguish
- Log errors at the point of final handling, not at intermediate layers

## Naming Conventions
- Use `MixedCaps` / `mixedCaps`, never underscores in Go names
- Acronyms should be all-caps (`ID`, `HTTP`, `URL`, `WS`)
- Interface names: single-method interfaces use method name + `er` (e.g., `Reader`, `Handler`)
- Exported names should be self-documenting; unexported names can be shorter

## Concurrency
- Use goroutines and channels for concurrent work
- Protect shared state with `sync.Mutex` or use channels to avoid shared state
- Always use `context.Context` as the first parameter for functions that may block or be cancelled
- Avoid goroutine leaks — ensure every goroutine has a clear shutdown path

## WebSocket (gorilla/websocket)
- Use a single goroutine per connection for writes; reads can be in a separate goroutine
- Implement ping/pong for connection health checks
- Handle connection close gracefully with close messages
- Set appropriate read/write deadlines

## JSON & Serialization
- Use struct tags for JSON field names: `json:"fieldName"`
- Use `json:"fieldName,omitempty"` for optional fields
- Define clear message types for WebSocket communication

## Testing
- Write table-driven tests using `t.Run` for subtests
- Use `testing.T` helpers (`t.Helper()`, `t.Cleanup()`)
- Test files go in the same package with `_test.go` suffix
- Use `httptest` for HTTP handler tests
- Run tests with `cd server && go test ./...`

## Dependencies
- Keep dependencies minimal — prefer the standard library
- Never introduce a new dependency without asking first
- Pin dependency versions via `go.sum`

## Logging
- Use `log/slog` for structured logging (Go 1.21+)
- Include relevant context (room ID, player ID) in log messages

## Documentation
- Write doc comments for all exported types, functions, and methods
- Start doc comments with the name of the thing being documented
- Use `// Package foo ...` for package-level documentation
