/**
 * Simple logging service for the application
 */
export const loggingService = {
  debug: (message: string) => {
    console.debug(message);
  },
  
  info: (message: string) => {
    console.info(message);
  },
  
  warning: (message: string) => {
    console.warn(message);
  },
  
  error: (message: string) => {
    console.error(message);
  }
};