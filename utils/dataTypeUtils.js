// utils/dataTypeUtils.js
export const DATA_TYPES = {
    NUMBER: 'number',
    TEXT: 'text',
    DATE: 'date',
    BOOLEAN: 'boolean',
    EMPTY: 'empty'
  };
  
  export function detectDataType(value) {
    if (value === null || value === undefined || value === '') {
      return DATA_TYPES.EMPTY;
    }
    
    // Check if boolean
    if (value === true || value === false || 
        value === 'true' || value === 'false' || 
        value === 'TRUE' || value === 'FALSE' ||
        value === 'yes' || value === 'no' ||
        value === 'YES' || value === 'NO') {
      return DATA_TYPES.BOOLEAN;
    }
    
    // Check if number
    // First remove commas from string numbers
    let numValue = value;
    if (typeof value === 'string') {
      numValue = value.replace(/,/g, '');
    }
    
    if (!isNaN(Number(numValue)) && typeof value !== 'boolean') {
      return DATA_TYPES.NUMBER;
    }
    
    // Check if date
    const dateValue = new Date(value);
    if (
      !isNaN(dateValue.getTime()) &&
      (typeof value === 'string' && 
        (value.includes('-') || value.includes('/') || value.includes('.')))
    ) {
      return DATA_TYPES.DATE;
    }
    
    // Default to text
    return DATA_TYPES.TEXT;
  }