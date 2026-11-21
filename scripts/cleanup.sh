#!/bin/bash

echo "Cleaning up node_modules and pnpm-lock.yaml files..."

for dir in api ui worker enricher py-worker; do
  echo "Cleaning $dir..."
  rm -rf "$dir/node_modules" "$dir/pnpm-lock.yaml" "$dir/logs"
  mkdir -p "$dir/logs"
done

echo "Cleanup completed!"
