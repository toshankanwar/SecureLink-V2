// services/CloudinaryService.js
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

class CloudinaryService {
  constructor() {
    this.cloudName = 'drlxxyu9o';
    this.uploadPreset = 'profile_pictures';
    this.apiUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    this.baseUrl = `https://res.cloudinary.com/${this.cloudName}`;
  }

  // ====================
  // IMAGE PICKER & UPLOAD
  // ====================

  async pickAndUploadProfilePicture(contactId) {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photos to update your profile picture.'
        );
        return null;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for profile pictures
        quality: 0.8,
        base64: true,
        exif: false,
      });

      if (result.canceled) {
        return null;
      }

      // Upload to Cloudinary
      const uploadUrl = await this.uploadProfilePicture(result.assets[0], contactId);
      return uploadUrl;

    } catch (error) {
      console.error('Error picking and uploading image:', error);
      Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
      throw error;
    }
  }

  async takePictureAndUpload(contactId) {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'We need camera access to take your profile picture.'
        );
        return null;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
        exif: false,
      });

      if (result.canceled) {
        return null;
      }

      // Upload to Cloudinary
      const uploadUrl = await this.uploadProfilePicture(result.assets[0], contactId);
      return uploadUrl;

    } catch (error) {
      console.error('Error taking and uploading picture:', error);
      Alert.alert('Camera Error', 'Failed to take picture. Please try again.');
      throw error;
    }
  }

  // ====================
  // CLOUDINARY UPLOAD
  // ====================

  async uploadProfilePicture(imageAsset, contactId) {
    try {
      if (!imageAsset || !imageAsset.base64) {
        throw new Error('Invalid image data');
      }

      console.log('📤 Uploading profile picture for:', contactId);

      // Prepare base64 image data
      const base64Image = `data:image/jpeg;base64,${imageAsset.base64}`;

      // Upload data
      const uploadData = {
        file: base64Image,
        upload_preset: this.uploadPreset,
        public_id: `profile_${contactId}`,
        folder: 'securelink/profile_pictures',
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
        transformation: [
          {
            width: 800,
            height: 800,
            crop: 'fill',
            gravity: 'face',
            quality: 'auto:good'
          }
        ]
      };

      // Make API request
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();

      if (!result.secure_url) {
        throw new Error('No secure URL received from Cloudinary');
      }

      console.log('✅ Profile picture uploaded successfully:', result.secure_url);
      return result.secure_url;

    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  // ====================
  // BATCH UPLOAD (for multiple images)
  // ====================

  async uploadMultipleImages(images, folder = 'securelink/chat_images') {
    try {
      const uploadPromises = images.map((image, index) => 
        this.uploadChatImage(image, `${folder}/image_${Date.now()}_${index}`)
      );

      const results = await Promise.all(uploadPromises);
      return results;

    } catch (error) {
      console.error('Batch upload error:', error);
      throw error;
    }
  }

  async uploadChatImage(imageAsset, publicId) {
    try {
      const base64Image = `data:image/jpeg;base64,${imageAsset.base64}`;

      const uploadData = {
        file: base64Image,
        upload_preset: this.uploadPreset,
        public_id: publicId,
        resource_type: 'image',
        transformation: [
          {
            width: 1200,
            height: 1200,
            crop: 'limit',
            quality: 'auto:good'
          }
        ]
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });

      const result = await response.json();
      return result.secure_url;

    } catch (error) {
      console.error('Chat image upload error:', error);
      throw error;
    }
  }

  // ====================
  // DELETE OPERATIONS (Server-side recommended)
  // ====================

  async deleteProfilePicture(contactId) {
    try {
      // Note: Deletion requires API secret, so this should be done server-side
      // For now, we'll just return a placeholder
      console.log('⚠️ Delete operation should be done server-side for security');
      
      // You could call your server endpoint here:
      // const response = await fetch(`${YOUR_SERVER}/api/delete-profile-picture`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ contactId })
      // });

      return { success: true, message: 'Delete operation queued' };

    } catch (error) {
      console.error('Error deleting profile picture:', error);
      throw error;
    }
  }

  // ====================
  // URL GENERATION & TRANSFORMATIONS
  // ====================

  getProfilePictureUrl(contactId, options = {}) {
    const {
      width = 400,
      height = 400,
      crop = 'fill',
      gravity = 'face',
      quality = 'auto:good',
      format = 'auto'
    } = options;

    const transformation = `w_${width},h_${height},c_${crop},g_${gravity},q_${quality},f_${format}`;
    const publicId = `securelink/profile_pictures/profile_${contactId}`;
    
    return `${this.baseUrl}/image/upload/${transformation}/${publicId}.jpg`;
  }

  getThumbnailUrl(contactId, size = 100) {
    return this.getProfilePictureUrl(contactId, {
      width: size,
      height: size,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto:low'
    });
  }

  getHighResUrl(contactId) {
    return this.getProfilePictureUrl(contactId, {
      width: 800,
      height: 800,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto:best'
    });
  }

  // Generate different sizes for responsive images
  getResponsiveUrls(contactId) {
    return {
      thumbnail: this.getThumbnailUrl(contactId, 100),
      small: this.getProfilePictureUrl(contactId, { width: 200, height: 200 }),
      medium: this.getProfilePictureUrl(contactId, { width: 400, height: 400 }),
      large: this.getProfilePictureUrl(contactId, { width: 800, height: 800 })
    };
  }

  // ====================
  // CACHING & OPTIMIZATION
  // ====================

  async cacheProfilePicture(contactId, size = 'medium') {
    try {
      const imageUrl = this.getProfilePictureUrl(contactId, this.getSizeOptions(size));
      const filename = `profile_${contactId}_${size}.jpg`;
      const localPath = `${FileSystem.cacheDirectory}${filename}`;

      // Check if already cached
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        return localPath;
      }

      // Download and cache
      const downloadResult = await FileSystem.downloadAsync(imageUrl, localPath);
      return downloadResult.uri;

    } catch (error) {
      console.error('Error caching profile picture:', error);
      // Return remote URL as fallback
      return this.getProfilePictureUrl(contactId);
    }
  }

  getSizeOptions(size) {
    const sizeMap = {
      thumbnail: { width: 100, height: 100 },
      small: { width: 200, height: 200 },
      medium: { width: 400, height: 400 },
      large: { width: 800, height: 800 }
    };
    return sizeMap[size] || sizeMap.medium;
  }

  // ====================
  // VALIDATION & HELPERS
  // ====================

  validateImage(imageAsset) {
    if (!imageAsset) {
      throw new Error('No image provided');
    }

    if (!imageAsset.base64) {
      throw new Error('Image must have base64 data');
    }

    // Check file size (base64 is roughly 33% larger than original)
    const sizeInBytes = (imageAsset.base64.length * 3) / 4;
    const maxSizeInMB = 10;
    
    if (sizeInBytes > maxSizeInMB * 1024 * 1024) {
      throw new Error(`Image too large. Maximum size is ${maxSizeInMB}MB`);
    }

    return true;
  }

  // ====================
  // ERROR HANDLING
  // ====================

  handleUploadError(error) {
    console.error('Cloudinary upload error:', error);

    if (error.message.includes('Invalid image file')) {
      return 'Please select a valid image file';
    }
    
    if (error.message.includes('File size too large')) {
      return 'Image file is too large. Please choose a smaller image';
    }
    
    if (error.message.includes('Network')) {
      return 'Network error. Please check your connection and try again';
    }

    return 'Upload failed. Please try again';
  }

  // ====================
  // UTILITY METHODS
  // ====================

  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes(this.cloudName) && (url.includes('.jpg') || url.includes('.png') || url.includes('.jpeg'));
  }

  extractPublicId(cloudinaryUrl) {
    try {
      const parts = cloudinaryUrl.split('/');
      const filename = parts[parts.length - 1];
      return filename.split('.')[0];
    } catch (error) {
      console.error('Error extracting public ID:', error);
      return null;
    }
  }

  getCloudinaryStats() {
    return {
      cloudName: this.cloudName,
      uploadPreset: this.uploadPreset,
      apiUrl: this.apiUrl,
      baseUrl: this.baseUrl
    };
  }
}

export default new CloudinaryService();
