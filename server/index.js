// 파일: server/index.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const { createPool } = require('./db');

// 라우터 불러오기
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정 - 먼저 설정하여 모든 요청에 적용되도록 함
app.use(cors({
  origin: [
    'http://localhost:3000',  // Docker 웹 서버
    'http://localhost:5500',  // VS Code Live Server
    'http://127.0.0.1:5500'   // Live Server의 또 다른 주소
  ],
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS']
}));

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './public')));

// 파일 업로드 설정
app.use(fileUpload({
  createParentPath: true,
  limits: {
    fileSize: 500 * 1024 * 1024  // 500MB 제한
  }
}));

// 업로드 디렉터리 생성
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// API 라우터 설정
app.use('/api', apiRoutes);

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './public/index.html'));
});

// 데이터베이스 연결 초기화 및 서버 시작
async function initServer() {
  try {
    const pool = await createPool();
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initServer();

module.exports = app;