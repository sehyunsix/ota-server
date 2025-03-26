#!/bin/bash

# 버전 설정 (기본값은 latest)
VERSION=${1:-latest}

echo "Deploying OTA server with version: $VERSION"

# 최신 이미지 가져오기
echo "Pulling latest images from Docker Hub..."
docker pull sehyunsix/ota-server:$VERSION
docker pull sehyunsix/ota-mysql:$VERSION

# 컨테이너 실행
echo "Starting containers..."
docker-compose up -d

echo "Deployment complete! Application is now running."