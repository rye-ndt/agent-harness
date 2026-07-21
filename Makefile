WAILS ?= $(shell command -v wails 2>/dev/null || echo $(HOME)/go/bin/wails)

.PHONY: dev build run test

# Start the app in development mode (hot reload).
dev:
	$(WAILS) dev

# Build the production .app bundle.
build:
	$(WAILS) build

# Build and launch the production app.
run: build
	./build/bin/master_harness.app/Contents/MacOS/master_harness

test:
	go test ./...
