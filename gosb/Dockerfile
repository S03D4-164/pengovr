FROM golang:1.23-alpine@sha256:f85330846cde1e57ca9ec309382da3b8e6ae3ab943d2739500e08c86393a21b1 AS build
RUN apk update && apk upgrade && apk add --no-cache git
RUN go install github.com/google/safebrowsing/cmd/sbserver@bbf0d20

FROM alpine:3.20@sha256:5b10f432ef3da1b8d4c7eb6c487f2f5a8f096bc91145e68878dd4a5019afde11
RUN apk update && apk upgrade && apk add --no-cache ca-certificates
WORKDIR /app
RUN cd /app
COPY --from=build /go/bin/sbserver /app/bin/sbserver

CMD ["/bin/sh", "-c", "exec /app/bin/sbserver -db /tmp/gosb/gsbv4.db -srvaddr 0.0.0.0:3002 -apikey ${GSBKEY}"]