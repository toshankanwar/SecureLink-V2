import React, { useState } from 'react';
import { View, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import CloudinaryService from '../../services/CloudinaryService';
import FirebaseService from '../../services/FirebaseService';
import { useAuth } from '../../context/AuthContext';

const ProfilePicture = ({ 
  contactId, 
  photoURL, 
  size = 100, 
  editable = false 
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleImagePicker = () => {
    if (!editable) return;

    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 800,
    };

    launchImageLibrary(options, async (response) => {
      if (response.assets && response.assets[0]) {
        setUploading(true);
        try {
          const imageUri = response.assets[0].uri;
          
          // Upload to Cloudinary
          const cloudinaryUrl = await CloudinaryService.uploadProfilePicture(
            imageUri, 
            contactId
          );
          
          // Update user profile in Firestore
          await FirebaseService.updateUserProfile(user.uid, {
            photoURL: cloudinaryUrl,
          });
          
          Alert.alert('Success', 'Profile picture updated successfully!');
        } catch (error) {
          Alert.alert('Error', 'Failed to upload profile picture');
          console.error('Upload error:', error);
        } finally {
          setUploading(false);
        }
      }
    });
  };

  const getImageUrl = () => {
    if (photoURL) return photoURL;
    if (contactId) return CloudinaryService.getProfilePictureUrl(contactId);
    return 'https://via.placeholder.com/400x400.png?text=No+Photo';
  };

  return (
    <TouchableOpacity 
      onPress={handleImagePicker}
      disabled={!editable || uploading}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Image
        source={{ uri: getImageUrl() }}
        style={{ width: size, height: size }}
        onError={() => console.log('Image load error')}
      />
      {uploading && (
        <View style={{
          position: 'absolute',
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <ActivityIndicator color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default ProfilePicture;
