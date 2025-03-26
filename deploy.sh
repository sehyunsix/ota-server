#!/bin/bash

# 실행할 작업
ACTION=${1:-start}

# 설정
PROJECT_DIR="$PWD"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# 함수 정의
status() {
  echo "===== 컨테이너 상태 ====="
  docker-compose -f $COMPOSE_FILE ps
  echo "===== 로그 (최근 10줄) ====="
  docker-compose -f $COMPOSE_FILE logs --tail=10
}

pull_images() {
  echo "Docker 이미지 가져오는 중..."
  docker-compose -f $COMPOSE_FILE pull
}

start() {
  echo "컨테이너 시작 중..."
  docker-compose -f $COMPOSE_FILE up -d
  status
}

stop() {
  echo "컨테이너 중지 중..."
  docker-compose -f $COMPOSE_FILE down
}

restart() {
  stop
  start
}

update() {
  pull_images
  restart
}

# 메인 로직
case "$ACTION" in
  start)
    pull_images
    start
    ;;
  stop)
    stop
    ;;
  restart)
    restart
    ;;
  update)
    update
    ;;
  status)
    status
    ;;
  *)
    echo "사용법: $0 {start|stop|restart|update|status}"
    exit 1
    ;;
esac

exit 0