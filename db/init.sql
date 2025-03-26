CREATE DATABASE IF NOT EXISTS ota_db;
USE ota_db;

-- 이미지 데이터베이스 테이블
CREATE TABLE IF NOT EXISTS img_db (
  id INT AUTO_INCREMENT PRIMARY KEY,
  img_url VARCHAR(255) NOT NULL,
  device_model VARCHAR(100) NOT NULL,
  is_latest BOOLEAN DEFAULT FALSE,
  img_file VARCHAR(255) NOT NULL,
  img_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_latest (device_model, is_latest)
);

-- 업데이트 상태 테이블 (device_uuid 대신 device_model을 키로 사용)
CREATE TABLE IF NOT EXISTS update_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_model VARCHAR(100) NOT NULL,
  is_started BOOLEAN DEFAULT FALSE,
  is_finished BOOLEAN DEFAULT FALSE,
  is_running BOOLEAN DEFAULT FALSE,
  is_success BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_device_model (device_model)
);

-- 에러 로그 테이블 (device_uuid 대신 device_model을 키로 사용)
CREATE TABLE IF NOT EXISTS error_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_model VARCHAR(100) NOT NULL,
  error_log TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_model (device_model)
);