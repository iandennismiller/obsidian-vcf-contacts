import { describe, it, expect, vi } from 'vitest';
import { generateRevTimestamp } from 'src/contacts/contactNote';

describe('REV field demonstration', () => {
  it('should demonstrate REV timestamp format', () => {
    // Mock a specific date for consistent testing
    const mockDate = new Date('2025-09-23T23:19:28.000Z');
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
    
    const revTimestamp = generateRevTimestamp();
    
    console.log('Generated REV timestamp:', revTimestamp);
    console.log('Format breakdown:');
    console.log('  YYYY:', revTimestamp.substring(0, 4));
    console.log('  MM:', revTimestamp.substring(4, 6));
    console.log('  DD:', revTimestamp.substring(6, 8));
    console.log('  T:', revTimestamp.substring(8, 9));
    console.log('  HH:', revTimestamp.substring(9, 11));
    console.log('  MM:', revTimestamp.substring(11, 13));
    console.log('  SS:', revTimestamp.substring(13, 15));
    console.log('  Z:', revTimestamp.substring(15, 16));
    
    expect(revTimestamp).toBe('20250923T231928Z');
    expect(revTimestamp).toMatch(/^\d{8}T\d{6}Z$/);
  });
  
  it('should demonstrate REV format specification', () => {
    const timestamp = generateRevTimestamp();
    
    // Verify format: YYYYMMDDTHHMMSSZ
    expect(timestamp).toHaveLength(16);
    expect(timestamp.charAt(8)).toBe('T');
    expect(timestamp.charAt(15)).toBe('Z');
    expect(timestamp.substring(0, 8)).toMatch(/^\d{8}$/); // YYYYMMDD
    expect(timestamp.substring(9, 15)).toMatch(/^\d{6}$/); // HHMMSS
    
    console.log('✅ REV format validation passed:', timestamp);
  });
});