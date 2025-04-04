// 파일: server/routes/api.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getPool } = require('../db');

// 업로드 디렉터리 설정
const uploadDir ='/app/uploads';

// API 구현
router.post('/imgFile', async (req, res) => {
  try {
    if (!req.files || !req.files.img_file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // req.body에서 필요한 데이터 추출
    const { device_model, img_version, is_latest } = req.body;

    if (!device_model || !img_version) {
      return res.status(400).json({ error: 'Device model and image version are required' });
    }

    const imgFile = req.files.img_file;
    const fileName = `${device_model}_${img_version}_${Date.now()}.zip`;
    const filePath = path.join(uploadDir, fileName);

    // 파일을 볼륨에 저장
    await imgFile.mv(filePath);

    // SHA-256 해시 생성
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const shaKey = hashSum.digest('hex');

    const pool = await getPool();

    // is_latest가 true인 경우 기존의 latest를 false로 변경
    if (is_latest === 'true' || is_latest === true) {
      await pool.query(
        'UPDATE img_db SET is_latest = FALSE WHERE device_model = ?',
        [device_model]
      );
    }

    // DB에 파일명과 SHA 해시 저장
    await pool.query(
      'INSERT INTO img_db (img_url, device_model, is_latest, img_file, img_version, img_sha) VALUES (?, ?, ?, ?, ?, ?)',
      [`/api/imgFile?device_model=${device_model}&req_version=${img_version}`,
       device_model,
       is_latest === 'true' || is_latest === true,
       fileName,
       img_version,
       shaKey]  // SHA-256 해시 값 저장
    );

    res.status(201).json({
      message: 'Image file uploaded successfully',
      fileName,
      shaKey
    });
  } catch (error) {
    console.error('Error uploading image file:', error);
    res.status(500).json({ error: 'Failed to upload image file' });
  }
});

// 다운로드 API
router.get('/imgFile', async (req, res) => {
  try {
    const { device_model, req_version } = req.query;

    if (!device_model || !req_version) {
      return res.status(400).json({ error: 'Device model and requested version are required' });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT img_file FROM img_db WHERE device_model = ? AND img_version = ?',
      [device_model, req_version]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    const filePath = path.join(uploadDir, rows[0].img_file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Image file not found on server' });
    }

    // 업데이트 시작 상태 기록
    await pool.query(
      'INSERT INTO update_status (device_model, is_started, is_running, started_at) ' +
      'VALUES (?, TRUE, TRUE, NOW()) ' +
      'ON DUPLICATE KEY UPDATE is_started = TRUE, is_running = TRUE, started_at = NOW()',
      [device_model]
    );

    res.download(filePath);
  } catch (error) {
    console.error('Error downloading image file:', error);
    res.status(500).json({ error: 'Failed to download image file' });
  }
});


// DELETE /api/imgFile - 이미지 파일 삭제 (SHA 키로 식별)
router.delete('/imgFile', async (req, res) => {
  try {
    const { sha } = req.query;

    if (!sha) {
      return res.status(400).json({ error: 'SHA hash is required' });
    }

    const pool = await getPool();

    // 먼저 이미지 정보를 찾습니다
    const [rows] = await pool.query(
      'SELECT img_file, device_model, is_latest FROM img_db WHERE img_sha = ?',
      [sha]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Image file not found with the provided SHA hash' });
    }

    const { img_file, device_model, is_latest } = rows[0];

    // 파일 시스템에서 파일 삭제
    const filePath = path.join(uploadDir, img_file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 데이터베이스에서 레코드 삭제
    await pool.query('DELETE FROM img_db WHERE img_sha = ?', [sha]);

    // 삭제된 이미지가 latest였다면 동일 디바이스의 가장 최신 버전을 latest로 설정
    if (is_latest) {
      const [latestVersions] = await pool.query(
        'SELECT id FROM img_db WHERE device_model = ? ORDER BY created_at DESC LIMIT 1',
        [device_model]
      );

      if (latestVersions.length > 0) {
        await pool.query(
          'UPDATE img_db SET is_latest = TRUE WHERE id = ?',
          [latestVersions[0].id]
        );
      }
    }

    res.json({ message: 'Image file deleted successfully' });
  } catch (error) {
    console.error('Error deleting image file:', error);
    res.status(500).json({ error: 'Failed to delete image file' });
  }
});


// PUT /api/imgFile/latest - 이미지를 최신 버전으로 설정
router.put('/imgFile/latest', async (req, res) => {
  try {
    const { sha, device_model } = req.body;

    if (!sha || !device_model) {
      return res.status(400).json({ error: 'SHA hash and device model are required' });
    }

    const pool = await getPool();

    // 먼저 이미지 정보를 찾습니다
    const [rows] = await pool.query(
      'SELECT id FROM img_db WHERE img_sha = ?',
      [sha]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Image file not found with the provided SHA hash' });
    }

    const imageId = rows[0].id;

    // 트랜잭션 시작
    await pool.query('START TRANSACTION');

    try {
      // 1. 해당 디바이스의 모든 이미지를 latest=false로 설정
      await pool.query(
        'UPDATE img_db SET is_latest = FALSE WHERE device_model = ?',
        [device_model]
      );

      // 2. 선택한 이미지를 latest=true로 설정
      await pool.query(
        'UPDATE img_db SET is_latest = TRUE WHERE id = ?',
        [imageId]
      );

      // 트랜잭션 커밋
      await pool.query('COMMIT');

      res.json({
        message: 'Image successfully set as latest version',
        device_model,
        sha
      });
    } catch (error) {
      // 오류 발생 시 롤백
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error setting image as latest:', error);
    res.status(500).json({ error: 'Failed to set image as latest version' });
  }
});

// GET /api/imgVersion - 최신 이미지 버전 조회
router.get('/imgVersion', async (req, res) => {
  try {
    const { device_model } = req.query;

    if (!device_model) {
      return res.status(400).json({ error: 'Device model is required' });
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      'SELECT img_version FROM img_db WHERE device_model = ? AND is_latest = TRUE',
      [device_model]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No version found for this device model' });
    }

    res.json({ latest_version: rows[0].img_version });
  } catch (error) {
    console.error('Error getting image version:', error);
    res.status(500).json({ error: 'Failed to get image version' });
  }
});

// POST /api/updateStatus - 업데이트 상태 업데이트
router.post('/updateStatus', async (req, res) => {
  try {
    const { device_model, update_status } = req.body;

    if (!device_model || !update_status) {
      return res.status(400).json({ error: 'Device model and update status are required' });
    }

    const { is_start, is_finish, is_running, is_success, started_at, finished_at } = update_status;

    const pool = await getPool();

    // 업데이트 상태 기록
    const updateFields = [];
    const updateValues = [];

    if (is_start !== undefined) updateFields.push('is_started = ?'), updateValues.push(is_start);
    if (is_finish !== undefined) updateFields.push('is_finished = ?'), updateValues.push(is_finish);
    if (is_running !== undefined) updateFields.push('is_running = ?'), updateValues.push(is_running);
    if (is_success !== undefined) updateFields.push('is_success = ?'), updateValues.push(is_success);
    if (started_at) updateFields.push('started_at = ?'), updateValues.push(new Date(started_at));
    if (finished_at) updateFields.push('finished_at = ?'), updateValues.push(new Date(finished_at));

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update fields provided' });
    }

    // 디바이스 모델로 레코드 검색
    const [existingRows] = await pool.query(
      'SELECT id FROM update_status WHERE device_model = ?',
      [device_model]
    );

    if (existingRows.length > 0) {
      // 기존 레코드 업데이트
      await pool.query(
        `UPDATE update_status SET ${updateFields.join(', ')} WHERE device_model = ?`,
        [...updateValues, device_model]
      );
    } else {
      // 새 레코드 생성
      const insertFields = ['device_model'];
      const insertValues = [device_model];
      const insertPlaceholders = ['?'];

      if (is_start !== undefined) insertFields.push('is_started'), insertValues.push(is_start), insertPlaceholders.push('?');
      if (is_finish !== undefined) insertFields.push('is_finished'), insertValues.push(is_finish), insertPlaceholders.push('?');
      if (is_running !== undefined) insertFields.push('is_running'), insertValues.push(is_running), insertPlaceholders.push('?');
      if (is_success !== undefined) insertFields.push('is_success'), insertValues.push(is_success), insertPlaceholders.push('?');
      if (started_at) insertFields.push('started_at'), insertValues.push(new Date(started_at)), insertPlaceholders.push('?');
      if (finished_at) insertFields.push('finished_at'), insertValues.push(new Date(finished_at)), insertPlaceholders.push('?');

      await pool.query(
        `INSERT INTO update_status (${insertFields.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`,
        insertValues
      );
    }

    res.json({ message: 'Update status recorded successfully' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/error - 에러 로그 기록
router.post('/error', async (req, res) => {
  try {
    const { device_model, errorlog } = req.body;

    if (!device_model || !errorlog) {
      return res.status(400).json({ error: 'Device model and error log are required' });
    }

    const pool = await getPool();

    // 에러 로그 기록
    await pool.query(
      'INSERT INTO error_logs (device_model, error_log) VALUES (?, ?)',
      [device_model, JSON.stringify(errorlog)]
    );

    // 업데이트 상태를 실패로 변경
    await pool.query(
      'UPDATE update_status SET is_success = FALSE, is_running = FALSE, is_finished = TRUE, finished_at = NOW() WHERE device_model = ?',
      [device_model]
    );

    res.json({ message: 'Error log recorded successfully' });
  } catch (error) {
    console.error('Error recording error log:', error);
    res.status(500).json({ error: 'Failed to record error log' });
  }
});

// 추가 API: 모든 이미지 조회 (관리 UI용)
router.get('/images', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM img_db ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// 새로운 API: SHA 해시로 이미지 검증
router.get('/verify', async (req, res) => {
  try {
    const { device_model, sha } = req.query;

    if (!sha) {
      return res.status(400).json({ error: 'SHA hash is required' });
    }

    const pool = await getPool();
    let query = 'SELECT * FROM img_db WHERE img_sha = ?';
    const queryParams = [sha];

    if (device_model) {
      query += ' AND device_model = ?';
      queryParams.push(device_model);
    }

    const [rows] = await pool.query(query, queryParams);

    if (rows.length === 0) {
      return res.status(404).json({
        verified: false,
        error: 'No matching image found with this SHA hash'
      });
    }

    res.json({
      verified: true,
      image: rows[0]
    });
  } catch (error) {
    console.error('Error verifying image:', error);
    res.status(500).json({ error: 'Failed to verify image' });
  }
});

// 추가 API: 업데이트 상태 조회 (관리 UI용)
router.get('/devices', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM update_status ORDER BY updated_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// 추가 API: 에러 로그 조회 (관리 UI용)
router.get('/errors', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM error_logs ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});



// 추가 API: 업데이트 상태 조회 (관리 UI용)
router.get('/devices', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM update_status ORDER BY updated_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});



// 추가 API: 업데이트 상태 조회 (관리 UI용)
router.get('/devices', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM update_status ORDER BY updated_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});


// DELETE /api/updateStatus - 업데이트 상태 삭제
router.delete('/updateStatus', async (req, res) => {
  try {
    const { device_model } = req.query;

    if (!device_model) {
      return res.status(400).json({ error: 'Device model is required' });
    }

    const pool = await getPool();

    // 해당 디바이스의 업데이트 상태 레코드 조회
    const [existingRows] = await pool.query(
      'SELECT id FROM update_status WHERE device_model = ?',
      [device_model]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Update status not found for the specified device model' });
    }

    // 업데이트 상태 삭제
    await pool.query(
      'DELETE FROM update_status WHERE device_model = ?',
      [device_model]
    );

    res.json({ message: 'Update status deleted successfully' });
  } catch (error) {
    console.error('Error deleting update status:', error);
    res.status(500).json({ error: 'Failed to delete update status' });
  }
});

module.exports = router;