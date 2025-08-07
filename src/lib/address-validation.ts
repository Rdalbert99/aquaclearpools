// Simple address validation without external API
// For production, you'd want to integrate with Google Places API or similar service

export interface AddressComponents {
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface ValidationResult {
  isValid: boolean;
  components?: AddressComponents;
  error?: string;
}

export const validateAddress = async (address: string): Promise<ValidationResult> => {
  // Simple regex-based validation for demonstration
  // In production, you'd use Google Places API or similar service
  
  const trimmedAddress = address.trim();
  
  if (trimmedAddress.length < 10) {
    return {
      isValid: false,
      error: "Address too short. Please provide a complete address."
    };
  }

  // Basic pattern matching for US addresses
  const patterns = {
    // Match: "123 Main St, City, State ZIP" or "123 Main St, City, State, ZIP"
    full: /^(.+),\s*([^,]+),\s*([A-Z]{2}),?\s*(\d{5}(?:-\d{4})?)$/i,
    // Match: "123 Main St, City State ZIP"
    compact: /^(.+),\s*([^,]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
  };

  let match = address.match(patterns.full) || address.match(patterns.compact);
  
  if (!match) {
    return {
      isValid: false,
      error: "Please use format: Street Address, City, State, ZIP"
    };
  }

  const [, street, city, state, zip] = match;

  // Validate state code
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  if (!validStates.includes(state.toUpperCase())) {
    return {
      isValid: false,
      error: "Please enter a valid US state abbreviation (e.g., CA, NY, TX)"
    };
  }

  // Validate ZIP code
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return {
      isValid: false,
      error: "Please enter a valid ZIP code (e.g., 12345 or 12345-6789)"
    };
  }

  return {
    isValid: true,
    components: {
      street_address: street.trim(),
      city: city.trim(),
      state: state.toUpperCase(),
      zip_code: zip,
      country: 'US'
    }
  };
};

export const formatAddress = (components: AddressComponents): string => {
  return `${components.street_address}, ${components.city}, ${components.state} ${components.zip_code}`;
};