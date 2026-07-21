export interface AddressComponents {
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface AddressSuggestion {
  formatted_address: string;
  components: AddressComponents;
  place_id?: string;
}

export interface ValidationResult {
  isValid: boolean;
  components?: AddressComponents;
  error?: string;
}

const VALID_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

function cleanAddressText(value: string): string {
  return value
    .replace(/\bUnited States(?: of America)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/,+\s*$/g, '')
    .trim();
}

function stateCodeFromNominatim(address: Record<string, string | undefined>): string {
  const iso = address['ISO3166-2-lvl4'] || address['ISO3166-2-lvl6'];
  if (iso?.startsWith('US-')) return iso.slice(3).toUpperCase();
  const raw = (address.state_code || address.state || '').trim();
  return raw.length === 2 ? raw.toUpperCase() : raw;
}

function componentsFromNominatim(item: any): AddressComponents | null {
  const address = item?.address || {};
  const house = address.house_number || '';
  const road = address.road || address.pedestrian || address.footway || address.path || '';
  const street = cleanAddressText([house, road].filter(Boolean).join(' '));
  const city = cleanAddressText(address.city || address.town || address.village || address.hamlet || address.county || '');
  const state = stateCodeFromNominatim(address);
  const zip = cleanAddressText(address.postcode || '').match(/\d{5}(?:-\d{4})?/)?.[0] || '';

  if (!street || !city || !state || !zip) return null;

  return {
    street_address: street,
    city,
    state: state.toUpperCase(),
    zip_code: zip,
    country: 'US',
  };
}

export const parseAddressComponents = (address: string): AddressComponents | null => {
  const trimmedAddress = cleanAddressText(address);
  if (!trimmedAddress) return null;

  const patterns = [
    /^(.+),\s*([^,]+),\s*([A-Z]{2}),?\s*(\d{5}(?:-\d{4})?)$/i,
    /^(.+),\s*([^,]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
    /^(.+?)\s+([^,]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmedAddress.match(pattern);
    if (!match) continue;
    const [, street, city, state, zip] = match;
    const stateCode = state.toUpperCase();
    if (!VALID_STATES.includes(stateCode) || !/^\d{5}(-\d{4})?$/.test(zip)) continue;
    return {
      street_address: cleanAddressText(street),
      city: cleanAddressText(city),
      state: stateCode,
      zip_code: zip,
      country: 'US',
    };
  }

  return null;
};

export const normalizeAddressInput = (address: string): string => {
  const parsed = parseAddressComponents(address);
  return parsed ? formatAddress(parsed) : cleanAddressText(address);
};

export const validateAddress = async (address: string): Promise<ValidationResult> => {
  const trimmedAddress = cleanAddressText(address);
  
  if (trimmedAddress.length < 10) {
    return {
      isValid: false,
      error: "Address too short. Please provide a complete address."
    };
  }

  const components = parseAddressComponents(trimmedAddress);
  if (!components) {
    return {
      isValid: false,
      error: "Please use format: Street Address, City, State, ZIP"
    };
  }

  return {
    isValid: true,
    components
  };
};

export const formatAddress = (components: AddressComponents): string => {
  return `${components.street_address}, ${components.city}, ${components.state} ${components.zip_code}`;
};

export const getAddressSuggestions = async (input: string): Promise<AddressSuggestion[]> => {
  const query = cleanAddressText(input);
  if (query.length < 3) return [];

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    const suggestions = (Array.isArray(data) ? data : [])
      .map((item) => componentsFromNominatim(item))
      .filter(Boolean)
      .map((components: AddressComponents) => ({
        formatted_address: formatAddress(components),
        components,
      }));

    const typedComponents = parseAddressComponents(query);
    if (typedComponents && !suggestions.some(s => s.formatted_address === formatAddress(typedComponents))) {
      suggestions.unshift({ formatted_address: formatAddress(typedComponents), components: typedComponents });
    }

    return suggestions.slice(0, 5);
  } catch {
    const components = parseAddressComponents(query);
    return components ? [{ formatted_address: formatAddress(components), components }] : [];
  }
};