# ── Stage 1: Build Angular frontend ──────────────────────────────────────────
FROM node:26.13.0-alpine AS frontend-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json ./
COPY src/ src/
COPY public/ public/

RUN npx ng build --configuration production


# ── Stage 2: Build Go backend ────────────────────────────────────────────────
FROM golang:1.25-alpine AS backend-build

WORKDIR /app

COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/ ./
RUN CGO_ENABLED=0 go build -o server .


# ── Stage 3: Minimal production image ────────────────────────────────────────
FROM alpine:3.24

RUN apk add --no-cache ca-certificates \
  && addgroup -S app \
  && adduser -S -G app -H -s /sbin/nologin app

WORKDIR /app

COPY --from=backend-build /app/server ./server
COPY --from=frontend-build /app/dist/Cards/browser ./static

# Files stay root-owned and read-only for the app; it only reads them and listens on 8080.
USER app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT ["./server", "-static", "./static"]
