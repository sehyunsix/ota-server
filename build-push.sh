#!/bin/bash

# 버전 설정 (기본값은 latest)
VERSION=${1:-latest}

echo "Building and pushing Docker images with version: $VERSION"

# 서버 이미지 빌드 및 푸시
echo "Building server image..."
docker build -t sehyunsix/ota-server:$VERSION ./server

echo "Pushing server image to Docker Hub..."
docker push sehyunsix/ota-server:$VERSION

# MySQL 이미지 빌드 및 푸시
echo "Building MySQL image..."
docker build -t sehyunsix/ota-mysql:$VERSION ./db

echo "Pushing MySQL image to Docker Hub..."
docker push sehyunsix/ota-mysql:$VERSION

echo "Done! Images are now available on Docker Hub."