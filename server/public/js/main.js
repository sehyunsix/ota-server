document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const uploadForm = document.getElementById('upload-form');
  const uploadProgress = document.getElementById('upload-progress');
  const uploadStatus = document.getElementById('upload-status');
  const imagesTable = document.getElementById('images-table').querySelector('tbody');
  const loadingImages = document.getElementById('loading-images');
  const deviceFilter = document.getElementById('deviceFilter');

  // 기본 API URL 설정 (상대 경로 또는 필요시 절대 경로)
  const API_BASE_URL = window.API_BASE_URL || '';

  // Fetch all OTA images

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
        <td colspan="6" style="text-align: center;">No images found</td>
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

  // Display upload status
  function showUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = type;
    uploadStatus.style.display = 'block';

    setTimeout(() => {
      uploadStatus.style.display = 'none';
    }, 5000);
  }

  // Filter images by device model
  deviceFilter.addEventListener('change', function() {
    fetchImages();
  });

  // Initial load
  fetchImages();
});