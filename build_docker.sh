#!/bin/sh
docker build -f docker/arm64v8/Dockerfile .
docker build -f docker/amd64/Dockerfile .
