export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  export const validatePassword = (password) => {
    return password.length >= 6;
  };
  
  export const validateDisplayName = (name) => {
    return name.trim().length >= 2;
  };
  
  export const validateContactId = (contactId) => {
    const regex = /^[A-Z0-9]{8,12}$/;
    return regex.test(contactId);
  };
  