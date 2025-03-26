curl -X POST "http://175.45.201.225:5000/api/imgFile" \
  -F "img_file=@otacodes.zip" \
  -F "device_model=SM-G980F" \
  -F "img_version=1.0.0" \
  -F "is_latest=true" \
  -H "Content-Type: multipart/form-data"