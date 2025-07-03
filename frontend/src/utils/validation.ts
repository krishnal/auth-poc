export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  export const validatePassword = (password: string): {
    isValid: boolean;
    errors: string[];
  } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  };
  
  export const validateForm = (data: Record<string, any>, rules: Record<string, any>): {
    isValid: boolean;
    errors: Record<string, string>;
  } => {
    const errors: Record<string, string> = {};
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      
      if (rule.required && (!value || value.trim() === '')) {
        errors[field] = `${field} is required`;
        continue;
      }
      
      if (rule.email && value && !validateEmail(value)) {
        errors[field] = 'Please enter a valid email address';
        continue;
      }
      
      if (rule.minLength && value && value.length < rule.minLength) {
        errors[field] = `${field} must be at least ${rule.minLength} characters long`;
        continue;
      }
      
      if (rule.match && value !== data[rule.match]) {
        errors[field] = `${field} must match ${rule.match}`;
        continue;
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };
  