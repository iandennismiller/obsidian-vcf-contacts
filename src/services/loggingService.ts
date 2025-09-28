/**
 * Simple logging service for the VCF Contacts plugin
 */
export const loggingService = {
  info: (message: string) => {
    console.log(`[VCF-Contacts] ${message}`);
  },
  
  warning: (message: string) => {
    console.warn(`[VCF-Contacts] ${message}`);
  },
  
  error: (message: string) => {
    console.error(`[VCF-Contacts] ${message}`);
  },
  
  debug: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[VCF-Contacts-DEBUG] ${message}`);
    }
  }
};