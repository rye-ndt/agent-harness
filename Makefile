WAILS ?= $(shell command -v wails 2>/dev/null || echo $(HOME)/go/bin/wails)

.PHONY: dev dev-go build run test

# Start the app. Frontend hot-reloads; Go changes need a restart of this target.
dev:
	$(WAILS) dev -nogorebuild

# Same, but rebuilds and relaunches on Go changes. macOS steals focus each time.
dev-go:
	$(WAILS) dev

# Build the production .app bundle.
build:
	$(WAILS) build

# Build and launch the production app.
run: build
	./build/bin/nexo.app/Contents/MacOS/nexo

test:
	go test ./...
