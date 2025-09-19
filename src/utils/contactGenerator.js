export const generateContactId = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
  };
  
  export const validateContactId = (contactId) => {
    const regex = /^[A-Z0-9]{8}$/;
    return regex.test(contactId);
  };
  
  export const formatContactId = (contactId) => {
    return contactId.replace(/(.{4})/g, '$1 ').trim();
  };
  