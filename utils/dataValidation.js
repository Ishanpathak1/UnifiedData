// utils/dataValidation.js
export const VALIDATION_RULES = {
    REQUIRED: 'required',
    MIN_VALUE: 'minValue',
    MAX_VALUE: 'maxValue',
    DATE_RANGE: 'dateRange',
    REGEX: 'regex',
    UNIQUE: 'unique',
    OPTIONS: 'options'
  };
  
  export function validateCell(value, rules, columnData) {
    const errors = [];
    
    if (!rules) return errors;
    
    Object.entries(rules).forEach(([rule, ruleValue]) => {
      switch(rule) {
        case VALIDATION_RULES.REQUIRED:
          if (ruleValue && (value === null || value === undefined || value === '')) {
            errors.push('This field is required');
          }
          break;
          
        case VALIDATION_RULES.MIN_VALUE:
          if (value !== '' && !isNaN(Number(value)) && Number(value) < ruleValue) {
            errors.push(`Value must be at least ${ruleValue}`);
          }
          break;
          
        case VALIDATION_RULES.MAX_VALUE:
          if (value !== '' && !isNaN(Number(value)) && Number(value) > ruleValue) {
            errors.push(`Value must be at most ${ruleValue}`);
          }
          break;
          
        case VALIDATION_RULES.DATE_RANGE:
          if (value) {
            const date = new Date(value);
            if (!isNaN(date)) {
              if (ruleValue.min && date < new Date(ruleValue.min)) {
                errors.push(`Date must be after ${ruleValue.min}`);
              }
              if (ruleValue.max && date > new Date(ruleValue.max)) {
                errors.push(`Date must be before ${ruleValue.max}`);
              }
            }
          }
          break;
          
        case VALIDATION_RULES.REGEX:
          if (value && !new RegExp(ruleValue).test(value)) {
            errors.push('Value does not match the required format');
          }
          break;
          
        case VALIDATION_RULES.UNIQUE:
          if (ruleValue && value && columnData && columnData.includes(value)) {
            errors.push('Value must be unique');
          }
          break;
          
        case VALIDATION_RULES.OPTIONS:
          if (value && ruleValue && !ruleValue.includes(value)) {
            errors.push(`Value must be one of: ${ruleValue.join(', ')}`);
          }
          break;
      }
    });
    
    return errors;
  }