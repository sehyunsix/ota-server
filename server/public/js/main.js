document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const uploadForm = document.getElementById('upload-form');
  const uploadProgress = document.getElementById('upload-progress');
  const uploadStatus = document.getElementById('upload-status');
  const imagesTable = document.getElementById('images-table').querySelector('tbody');
  const statusTable = document.getElementById('status-table').querySelector('tbody');
  const loadingImages = document.getElementById('loading-images');
  const loadingStatus = document.getElementById('loading-status');
  const deviceFilter = document.getElementById('deviceFilter');
  const statusDeviceFilter = document.getElementById('statusDeviceFilter');
  const refreshStatusBtn = document.getElementById('refresh-status');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // 기본 API URL 설정 (상대 경로 또는 필요시 절대 경로)
  const API_BASE_URL = window.API_BASE_URL || '';

  // Tab switching functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');

      // Make all tabs inactive
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Make selected tab active
      this.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Load data for the active tab if needed
      if (tabName === 'status') {
        fetchUpdateStatus();
      } else if (tabName === 'images') {
        fetchImages();
      }
    });
  });

  // Function to delete an image
  async function deleteImage(sha) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/imgFile?sha=${sha}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete image');
      }

      showUploadStatus('Image deleted successfully', 'success');

      // Refresh the images list
      fetchImages();
    } catch (error) {
      console.error('Error:', error);
      showUploadStatus('Delete failed: ' + error.message, 'error');
    }
  }

  // Fetch all OTA images
  async function fetchImages() {
    try {
      loadingImages.style.display = 'block';
      imagesTable.innerHTML = '';

      // API 엔드포인트 변경
      const response = await fetch(`${API_BASE_URL}/api/images`);
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      const images = await response.json();

      // Populate device filter dropdown (device_type → device_model)
      const deviceModels = [...new Set(images.map(img => img.device_model))];
      deviceFilter.innerHTML = '<option value="">All Devices</option>';
      deviceModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        deviceFilter.appendChild(option);
      });

      // Display images
      displayImages(images);
    } catch (error) {
      console.error('Error:', error);
      loadingImages.textContent = 'Error loading images: ' + error.message;
    } finally {
      loadingImages.style.display = 'none';
    }
  }

  // Display images in the table
function displayImages(images) {
  const selectedDeviceModel = deviceFilter.value;

  const filteredImages = selectedDeviceModel
    ? images.filter(img => img.device_model === selectedDeviceModel)
    : images;

  if (filteredImages.length === 0) {
    imagesTable.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center;">No images found</td>
      </tr>
    `;
    return;
  }

  imagesTable.innerHTML = '';

  filteredImages.forEach(image => {
    const row = document.createElement('tr');

    // SHA key가 없는 경우 '-'로 표시
    const shaKey = image.img_sha || '-';

    row.innerHTML = `
      <td>${image.device_model}</td>
      <td>${image.img_version}</td>
      <td>${image.is_latest ? '<span class="badge badge-success">Latest</span>' : ''}</td>
      <td><span class="sha-key" title="${shaKey}">${shaKey.substring(0, 10)}...</span></td>
      <td>
        <button class="action-btn download-btn"
                data-model="${image.device_model}"
                data-version="${image.img_version}">Download</button>
      </td>
      <td>
        <button class="action-btn set-latest-btn ${image.is_latest ? 'disabled' : ''}"
                data-sha="${shaKey}"
                data-model="${image.device_model}"
                ${image.is_latest ? 'disabled' : ''}>
          ${image.is_latest ? 'Current Latest' : 'Set as Latest'}
        </button>
      </td>
      <td>
        <button class="action-btn delete-btn" data-sha="${shaKey}">Delete</button>
      </td>
    `;

    imagesTable.appendChild(row);
  });

  // Add event listeners to download buttons
  document.querySelectorAll('.download-btn').forEach(button => {
    button.addEventListener('click', function() {
      const deviceModel = this.getAttribute('data-model');
      const imgVersion = this.getAttribute('data-version');
      window.location.href = `${API_BASE_URL}/api/imgFile?device_model=${deviceModel}&req_version=${imgVersion}`;
    });
  });

  // Add event listeners to set as latest buttons
  document.querySelectorAll('.set-latest-btn').forEach(button => {
    if (!button.disabled) {
      button.addEventListener('click', function() {
        const sha = this.getAttribute('data-sha');
        const deviceModel = this.getAttribute('data-model');
        if (confirm(`Are you sure you want to set this image as the latest version for ${deviceModel}?`)) {
          setAsLatest(sha, deviceModel);
        }
      });
    }
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', function() {
      const sha = this.getAttribute('data-sha');
      if (confirm('Are you sure you want to delete this image?')) {
        deleteImage(sha);
      }
    });
  });
}

  // Fetch update status for all devices
  async function fetchUpdateStatus() {
    try {
      loadingStatus.style.display = 'block';
      statusTable.innerHTML = '';

      const response = await fetch(`${API_BASE_URL}/api/devices`);
      if (!response.ok) {
        throw new Error('Failed to fetch update status');
      }

      const statusData = await response.json();

      // Populate device filter dropdown for status tab
      const deviceModels = [...new Set(statusData.map(status => status.device_model))];
      statusDeviceFilter.innerHTML = '<option value="">All Devices</option>';
      deviceModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        statusDeviceFilter.appendChild(option);
      });

      // Display update status
      displayUpdateStatus(statusData);
    } catch (error) {
      console.error('Error:', error);
      loadingStatus.textContent = 'Error loading update status: ' + error.message;
    } finally {
      loadingStatus.style.display = 'none';
    }
  }


// Function to set an image as the latest version
async function setAsLatest(sha, deviceModel) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/imgFile/latest`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sha,
        device_model: deviceModel
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to set image as latest');
    }

    showGlobalStatus(`Image successfully set as the latest version for ${deviceModel}`, 'success');

    // Refresh the images list
    fetchImages();
  } catch (error) {
    console.error('Error:', error);
    showGlobalStatus('Failed to set as latest: ' + error.message, 'error');
  }
}
  // Display update status in the table
  function displayUpdateStatus(statusData) {
    const selectedDeviceModel = statusDeviceFilter.value;

    const filteredStatus = selectedDeviceModel
      ? statusData.filter(status => status.device_model === selectedDeviceModel)
      : statusData;

    if (filteredStatus.length === 0) {
      statusTable.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center;">No update status found</td>
        </tr>
      `;
      return;
    }

    statusTable.innerHTML = '';

    filteredStatus.forEach(status => {
      const row = document.createElement('tr');

      // Format dates
      const startedAt = status.started_at ? new Date(status.started_at).toLocaleString() : 'N/A';
      const finishedAt = status.finished_at ? new Date(status.finished_at).toLocaleString() : 'N/A';
      const updatedAt = status.updated_at ? new Date(status.updated_at).toLocaleString() : 'N/A';

      // Determine status
      let statusText = 'Unknown';
      let statusClass = '';

      if (status.is_finished && status.is_success) {
        statusText = 'Completed Successfully';
        statusClass = 'status-success';
      } else if (status.is_finished && !status.is_success) {
        statusText = 'Failed';
        statusClass = 'status-failed';
      } else if (status.is_running) {
        statusText = 'In Progress';
        statusClass = 'status-running';
      } else if (status.is_started) {
        statusText = 'Started';
        statusClass = 'status-started';
      }

      row.innerHTML = `
        <td>${status.device_model}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${startedAt}</td>
        <td>${finishedAt}</td>
        <td>${updatedAt}</td>
      `;

      statusTable.appendChild(row);
    });
  }

  // Handle file upload
  uploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(uploadForm);
    const fileInput = document.getElementById('otaImage');

    if (!fileInput.files.length) {
      showUploadStatus('Please select a file to upload', 'error');
      return;
    }

    // FormData 확인
    if (!formData.has('device_model') || !formData.has('img_version')) {
      showUploadStatus('Device model and image version are required', 'error');
      return;
    }

    // 파일 이름 확인
    if (formData.has('img_file')) {
      console.log("Form has img_file field");
    } else if (formData.has('otaImage')) {
      // 필드 이름이 otaImage인 경우 img_file로 변경
      const otaFile = formData.get('otaImage');
      formData.delete('otaImage');
      formData.append('img_file', otaFile);
    } else {
      console.warn("File field not found in form");
    }

    // Show progress bar
    uploadProgress.style.display = 'block';
    uploadProgress.querySelector('.progress').style.width = '0%';

    try {
      const xhr = new XMLHttpRequest();

      // API 엔드포인트 변경
      xhr.open('POST', `${API_BASE_URL}/api/imgFile`, true);

      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          uploadProgress.querySelector('.progress').style.width = percentComplete + '%';
        }
      };

      xhr.onload = function() {
        if (xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText);
            showUploadStatus(`File uploaded successfully. SHA: ${response.shaKey || 'N/A'}`, 'success');
            uploadForm.reset();
            fetchImages();
          } catch (e) {
            console.error('Error parsing response:', e);
            showUploadStatus('Upload succeeded but received invalid response', 'warning');
          }
        } else {
          let errorMsg = 'Upload failed';
          try {
            const response = JSON.parse(xhr.responseText);
            errorMsg = response.error || errorMsg;
          } catch (e) {
            console.error('Error parsing response:', e);
          }
          showUploadStatus(errorMsg, 'error');
        }
        uploadProgress.style.display = 'none';
      };

      xhr.onerror = function() {
        showUploadStatus('Upload failed. Network error.', 'error');
        uploadProgress.style.display = 'none';
      };

      xhr.send(formData);
    } catch (error) {
      console.error('Error:', error);
      showUploadStatus('Upload failed: ' + error.message, 'error');
      uploadProgress.style.display = 'none';
    }
  });

function displayUpdateStatus(statusData) {
  const selectedDeviceModel = statusDeviceFilter.value;

  const filteredStatus = selectedDeviceModel
    ? statusData.filter(status => status.device_model === selectedDeviceModel)
    : statusData;

  if (filteredStatus.length === 0) {
    statusTable.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center;">No update status found</td>
      </tr>
    `;
    return;
  }

  statusTable.innerHTML = '';

  filteredStatus.forEach(status => {
    const row = document.createElement('tr');

    // Format dates
    const startedAt = status.started_at ? new Date(status.started_at).toLocaleString() : 'N/A';
    const finishedAt = status.finished_at ? new Date(status.finished_at).toLocaleString() : 'N/A';
    const updatedAt = status.updated_at ? new Date(status.updated_at).toLocaleString() : 'N/A';

    // Determine status
    let statusText = 'Unknown';
    let statusClass = '';

    if (status.is_finished && status.is_success) {
      statusText = 'Completed Successfully';
      statusClass = 'status-success';
    } else if (status.is_finished && !status.is_success) {
      statusText = 'Failed';
      statusClass = 'status-failed';
    } else if (status.is_running) {
      statusText = 'In Progress';
      statusClass = 'status-running';
    } else if (status.is_started) {
      statusText = 'Started';
      statusClass = 'status-started';
    }

    row.innerHTML = `
      <td>${status.device_model}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>${startedAt}</td>
      <td>${finishedAt}</td>
      <td>${updatedAt}</td>
      <td>
        <button class="action-btn delete-status-btn" data-device="${status.device_model}">Delete</button>
      </td>
    `;

    statusTable.appendChild(row);
  });

  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-status-btn').forEach(button => {
    button.addEventListener('click', function() {
      const deviceModel = this.getAttribute('data-device');
      if (confirm(`Are you sure you want to delete the update status for device ${deviceModel}?`)) {
        deleteUpdateStatus(deviceModel);
      }
    });
  });
}

// Function to delete an update status
async function deleteUpdateStatus(deviceModel) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/updateStatus?device_model=${deviceModel}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete update status');
    }

    showUploadStatus('Update status deleted successfully', 'success');

    // Refresh the update status list
    fetchUpdateStatus();
  } catch (error) {
    console.error('Error:', error);
    showUploadStatus('Delete failed: ' + error.message, 'error');
  }
}
// 공통 상태 메시지 표시 함수
function showGlobalStatus(message, type) {
  // 기존 메시지 제거
  const existingStatus = document.querySelector('.global-status');
  if (existingStatus) {
    existingStatus.remove();
  }

  const statusDiv = document.createElement('div');
  statusDiv.className = `global-status ${type}`;
  statusDiv.textContent = message;
  document.body.appendChild(statusDiv);

  // 5초 후 자동으로 사라짐
  setTimeout(() => {
    statusDiv.remove();
  }, 5000);
}

  // Display upload status
function showUploadStatus(message, type) {
  uploadStatus.textContent = message;
  uploadStatus.className = type;
  uploadStatus.style.display = 'block';

  // 공통 상태 메시지도 표시
  showGlobalStatus(message, type);

  setTimeout(() => {
    uploadStatus.style.display = 'none';
  }, 5000);
}

  // 삭제 함수에서는 showGlobalStatus 직접 호출
  async function deleteUpdateStatus(deviceModel) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/updateStatus?device_model=${deviceModel}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete update status');
      }

      showGlobalStatus('Update status deleted successfully', 'success');

      // Refresh the update status list
      fetchUpdateStatus();
    } catch (error) {
      console.error('Error:', error);
      showGlobalStatus('Delete failed: ' + error.message, 'error');
    }
  }
  // Initial load
  fetchImages();
});