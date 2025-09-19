export const lightTheme = {
    // Main colors
    background: '#FFFFFF',
    surface: '#F7F8FA',
    surfaceVariant: '#E9EDEF',
    primary: '#00A884', // WhatsApp green
    primaryDark: '#008F72',
    secondary: '#25D366',
    accent: '#128C7E',
    
    // Text colors
    text: '#111B21',
    textSecondary: '#667781',
    textLight: '#8696A0',
    textOnPrimary: '#FFFFFF',
    
    // Status colors
    success: '#25D366',
    error: '#E53E3E',
    warning: '#F59E0B',
    info: '#3B82F6',
    
    // Chat specific
    chatBackground: '#EFEAE2',
    chatBubbleSent: '#005C4B', // Dark green
    chatBubbleReceived: '#FFFFFF',
    chatBubbleSentText: '#FFFFFF',
    chatBubbleReceivedText: '#111B21',
    chatInputBackground: '#F0F2F5',
    
    // UI elements
    border: '#E9EDEF',
    divider: '#E9EDEF',
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadow: 'rgba(0, 0, 0, 0.1)',
    
    // Status bar
    statusBar: '#00A884',
    
    // Icons
    iconPrimary: '#54656F',
    iconSecondary: '#8696A0',
    iconSuccess: '#25D366',
  };
  
  export const darkTheme = {
    // Main colors
    background: '#0B141A', // Very dark blue-black
    surface: '#202C33', // Dark blue-gray
    surfaceVariant: '#2A3942', // Slightly lighter blue-gray
    primary: '#00A884', // Same WhatsApp green
    primaryDark: '#008F72',
    secondary: '#25D366',
    accent: '#128C7E',
    
    // Text colors
    text: '#E9EDEF',
    textSecondary: '#8696A0',
    textLight: '#667781',
    textOnPrimary: '#FFFFFF',
    
    // Status colors
    success: '#25D366',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
    
    // Chat specific
    chatBackground: '#0B141A',
    chatBubbleSent: '#005C4B', // Dark green (same as light)
    chatBubbleReceived: '#202C33',
    chatBubbleSentText: '#E9EDEF',
    chatBubbleReceivedText: '#E9EDEF',
    chatInputBackground: '#2A3942',
    
    // UI elements
    border: '#2A3942',
    divider: '#2A3942',
    overlay: 'rgba(0, 0, 0, 0.7)',
    shadow: 'rgba(0, 0, 0, 0.3)',
    
    // Status bar
    statusBar: '#202C33',
    
    // Icons
    iconPrimary: '#ADBAC7',
    iconSecondary: '#8696A0',
    iconSuccess: '#25D366',
  };
  
  export const getTheme = (isDark) => isDark ? darkTheme : lightTheme;
  