#!/bin/bash

echo "starting enrichment worker"
pnpm exec pm2 start ecosystem.config.cjs --no-daemon
