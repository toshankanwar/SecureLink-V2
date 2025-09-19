export const API_CONFIG = {
    BASE_URL: 'https://your-go-backend.onrender.com',
    WS_URL: 'wss://your-go-backend.onrender.com/ws',
    TIMEOUT: 10000,
  };
  
  export const STORAGE_KEYS = {
    USER_TOKEN: '@user_token',
    USER_ID: '@user_id',
    CONTACT_ID: '@contact_id',
    PRIVATE_KEY: '@private_key',
    PUBLIC_KEY: '@public_key',
    THEME: '@theme_preference',
  };
  
  export const ROUTES = {
    LOGIN: 'Login',
    REGISTER: 'Register',
    FORGOT_PASSWORD:'forgotpassword',
    CONTACT_ID_ENTRY: 'ContactIdEntry',
    CHAT_LIST: 'ChatList',
    CHAT_ROOM: 'ChatRoom',
    SETTINGS: 'Settings',
    PROFILE: 'Profile',
  };
  
  export const MESSAGE_TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    FILE: 'file',
    SYSTEM: 'system',
  };
  
  export const THEME_TYPES = {
    LIGHT: 'light',
    DARK: 'dark',
  };
  