/**
 * SchemaDefinitions - Comprehensive Schema.org type definitions for structured data
 * Contains 50+ schema types with field metadata for dynamic form generation
 */

/**
 * Field types for schema properties
 * @typedef {'text' | 'textarea' | 'url' | 'email' | 'tel' | 'number' | 'date' | 'datetime' | 'duration' | 'select' | 'boolean' | 'array' | 'nested' | 'hidden'} FieldType
 */

/**
 * Schema field definition
 * @typedef {Object} SchemaField
 * @property {string} name - Property name (e.g., 'name', '@type')
 * @property {FieldType} type - Field input type
 * @property {string} label - Human-readable label
 * @property {boolean} [required] - Whether field is required
 * @property {string} [placeholder] - Input placeholder text
 * @property {string} [help] - Help text for the field
 * @property {string} [value] - Default/fixed value (for hidden fields)
 * @property {Array<{value: string, label: string}>} [options] - Options for select fields
 * @property {string} [schema] - Schema type for nested fields
 * @property {string} [itemType] - Item type for array fields
 */

/**
 * Schema type definition
 * @typedef {Object} SchemaType
 * @property {string} type - Schema.org @type value
 * @property {string} label - Human-readable label
 * @property {string} description - Brief description
 * @property {string} category - Category grouping
 * @property {Array<SchemaField>} fields - Field definitions
 */

// ============================================
// Schema Categories
// ============================================

export const SCHEMA_CATEGORIES = {
  organization: {
    label: 'Organizations',
    icon: 'building',
    description: 'Businesses, companies, NGOs, and other organizations'
  },
  person: {
    label: 'People',
    icon: 'user',
    description: 'Individual people and profiles'
  },
  web: {
    label: 'Web Pages',
    icon: 'globe',
    description: 'Websites, web pages, and navigation'
  },
  content: {
    label: 'Content',
    icon: 'file-text',
    description: 'Articles, blog posts, and written content'
  },
  commerce: {
    label: 'Commerce',
    icon: 'shopping-cart',
    description: 'Products, offers, and e-commerce'
  },
  event: {
    label: 'Events',
    icon: 'calendar',
    description: 'Events, conferences, and gatherings'
  },
  service: {
    label: 'Services',
    icon: 'briefcase',
    description: 'Professional and business services'
  },
  navigation: {
    label: 'Navigation',
    icon: 'menu',
    description: 'Breadcrumbs, lists, and navigation elements'
  },
  howto: {
    label: 'How-To & Recipes',
    icon: 'list',
    description: 'Instructions, guides, and recipes'
  },
  media: {
    label: 'Media',
    icon: 'video',
    description: 'Videos, images, and audio content'
  },
  software: {
    label: 'Software',
    icon: 'code',
    description: 'Applications and software products'
  },
  education: {
    label: 'Education',
    icon: 'book',
    description: 'Courses, learning resources, and educational content'
  },
  jobs: {
    label: 'Jobs',
    icon: 'clipboard',
    description: 'Job postings and occupations'
  },
  place: {
    label: 'Places',
    icon: 'map-pin',
    description: 'Locations, addresses, and venues'
  },
  creative: {
    label: 'Creative Works',
    icon: 'film',
    description: 'Books, movies, music, and other creative works'
  },
  faq: {
    label: 'FAQ',
    icon: 'help-circle',
    description: 'Frequently asked questions'
  }
};

// ============================================
// Common Nested Schema Definitions
// ============================================

const postalAddressFields = [
  { name: '@type', type: 'hidden', value: 'PostalAddress' },
  { name: 'streetAddress', type: 'text', label: 'Street Address', placeholder: '123 Main Street' },
  { name: 'addressLocality', type: 'text', label: 'City', placeholder: 'San Francisco' },
  { name: 'addressRegion', type: 'text', label: 'State/Region', placeholder: 'CA' },
  { name: 'postalCode', type: 'text', label: 'Postal Code', placeholder: '94102' },
  { name: 'addressCountry', type: 'text', label: 'Country', placeholder: 'US' }
];

const geoCoordinatesFields = [
  { name: '@type', type: 'hidden', value: 'GeoCoordinates' },
  { name: 'latitude', type: 'number', label: 'Latitude', placeholder: '37.7749' },
  { name: 'longitude', type: 'number', label: 'Longitude', placeholder: '-122.4194' }
];

const openingHoursFields = [
  { name: '@type', type: 'hidden', value: 'OpeningHoursSpecification' },
  { name: 'dayOfWeek', type: 'select', label: 'Day', options: [
    { value: 'Monday', label: 'Monday' },
    { value: 'Tuesday', label: 'Tuesday' },
    { value: 'Wednesday', label: 'Wednesday' },
    { value: 'Thursday', label: 'Thursday' },
    { value: 'Friday', label: 'Friday' },
    { value: 'Saturday', label: 'Saturday' },
    { value: 'Sunday', label: 'Sunday' }
  ]},
  { name: 'opens', type: 'text', label: 'Opens', placeholder: '09:00' },
  { name: 'closes', type: 'text', label: 'Closes', placeholder: '17:00' }
];

const monetaryAmountFields = [
  { name: '@type', type: 'hidden', value: 'MonetaryAmount' },
  { name: 'currency', type: 'text', label: 'Currency', placeholder: 'USD' },
  { name: 'value', type: 'number', label: 'Value', placeholder: '99.99' }
];

const ratingFields = [
  { name: '@type', type: 'hidden', value: 'AggregateRating' },
  { name: 'ratingValue', type: 'number', label: 'Rating Value', placeholder: '4.5' },
  { name: 'bestRating', type: 'number', label: 'Best Rating', placeholder: '5' },
  { name: 'worstRating', type: 'number', label: 'Worst Rating', placeholder: '1' },
  { name: 'ratingCount', type: 'number', label: 'Rating Count', placeholder: '100' }
];

// ============================================
// Schema Type Definitions
// ============================================

/** @type {Array<SchemaType>} */
export const SCHEMA_TYPES = [
  // ============================================
  // Organizations
  // ============================================
  {
    type: 'Organization',
    label: 'Organization',
    description: 'A general organization (company, NGO, club, etc.)',
    category: 'organization',
    fields: [
      { name: '@type', type: 'hidden', value: 'Organization' },
      { name: 'name', type: 'text', label: 'Organization Name', required: true, placeholder: 'Acme Corporation' },
      { name: 'url', type: 'url', label: 'Website URL', placeholder: 'https://example.com' },
      { name: 'logo', type: 'url', label: 'Logo URL', placeholder: 'https://example.com/logo.png' },
      { name: 'description', type: 'textarea', label: 'Description', placeholder: 'A brief description of the organization' },
      { name: 'email', type: 'email', label: 'Email', placeholder: 'contact@example.com' },
      { name: 'telephone', type: 'tel', label: 'Phone', placeholder: '+1-555-123-4567' },
      { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields },
      { name: 'sameAs', type: 'array', label: 'Social Profiles', itemType: 'url', help: 'URLs to social media profiles' }
    ]
  },
  {
    type: 'LocalBusiness',
    label: 'Local Business',
    description: 'A local business with physical location',
    category: 'organization',
    fields: [
      { name: '@type', type: 'hidden', value: 'LocalBusiness' },
      { name: 'name', type: 'text', label: 'Business Name', required: true, placeholder: 'Joe\'s Coffee Shop' },
      { name: 'url', type: 'url', label: 'Website URL', placeholder: 'https://joescoffee.com' },
      { name: 'image', type: 'url', label: 'Image URL', placeholder: 'https://example.com/storefront.jpg' },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'telephone', type: 'tel', label: 'Phone', placeholder: '+1-555-123-4567' },
      { name: 'priceRange', type: 'text', label: 'Price Range', placeholder: '$$', help: 'e.g., $, $$, $$$' },
      { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields },
      { name: 'geo', type: 'nested', label: 'Coordinates', schema: 'GeoCoordinates', fields: geoCoordinatesFields },
      { name: 'openingHoursSpecification', type: 'array', label: 'Opening Hours', itemType: 'nested', schema: 'OpeningHoursSpecification', fields: openingHoursFields }
    ]
  },
  {
    type: 'Restaurant',
    label: 'Restaurant',
    description: 'A restaurant or food establishment',
    category: 'organization',
    fields: [
      { name: '@type', type: 'hidden', value: 'Restaurant' },
      { name: 'name', type: 'text', label: 'Restaurant Name', required: true },
      { name: 'url', type: 'url', label: 'Website URL' },
      { name: 'image', type: 'url', label: 'Image URL' },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'telephone', type: 'tel', label: 'Phone' },
      { name: 'servesCuisine', type: 'text', label: 'Cuisine Type', placeholder: 'Italian, Mexican, Chinese' },
      { name: 'priceRange', type: 'text', label: 'Price Range', placeholder: '$$' },
      { name: 'acceptsReservations', type: 'boolean', label: 'Accepts Reservations' },
      { name: 'menu', type: 'url', label: 'Menu URL' },
      { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields },
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },
  {
    type: 'Corporation',
    label: 'Corporation',
    description: 'A business corporation',
    category: 'organization',
    fields: [
      { name: '@type', type: 'hidden', value: 'Corporation' },
      { name: 'name', type: 'text', label: 'Corporation Name', required: true },
      { name: 'legalName', type: 'text', label: 'Legal Name' },
      { name: 'url', type: 'url', label: 'Website URL' },
      { name: 'logo', type: 'url', label: 'Logo URL' },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'foundingDate', type: 'date', label: 'Founding Date' },
      { name: 'tickerSymbol', type: 'text', label: 'Stock Ticker', placeholder: 'NASDAQ: ACME' },
      { name: 'address', type: 'nested', label: 'Headquarters', schema: 'PostalAddress', fields: postalAddressFields },
      { name: 'sameAs', type: 'array', label: 'Social Profiles', itemType: 'url' }
    ]
  },
  {
    type: 'NGO',
    label: 'NGO / Non-Profit',
    description: 'A non-governmental organization',
    category: 'organization',
    fields: [
      { name: '@type', type: 'hidden', value: 'NGO' },
      { name: 'name', type: 'text', label: 'Organization Name', required: true },
      { name: 'url', type: 'url', label: 'Website URL' },
      { name: 'logo', type: 'url', label: 'Logo URL' },
      { name: 'description', type: 'textarea', label: 'Mission Statement' },
      { name: 'foundingDate', type: 'date', label: 'Founded' },
      { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields }
    ]
  },

  // ============================================
  // People
  // ============================================
  {
    type: 'Person',
    label: 'Person',
    description: 'An individual person',
    category: 'person',
    fields: [
      { name: '@type', type: 'hidden', value: 'Person' },
      { name: 'name', type: 'text', label: 'Full Name', required: true },
      { name: 'givenName', type: 'text', label: 'First Name' },
      { name: 'familyName', type: 'text', label: 'Last Name' },
      { name: 'jobTitle', type: 'text', label: 'Job Title' },
      { name: 'url', type: 'url', label: 'Website/Profile URL' },
      { name: 'image', type: 'url', label: 'Photo URL' },
      { name: 'email', type: 'email', label: 'Email' },
      { name: 'telephone', type: 'tel', label: 'Phone' },
      { name: 'description', type: 'textarea', label: 'Bio' },
      { name: 'sameAs', type: 'array', label: 'Social Profiles', itemType: 'url' }
    ]
  },
  {
    type: 'ProfilePage',
    label: 'Profile Page',
    description: 'A page representing a person\'s profile',
    category: 'person',
    fields: [
      { name: '@type', type: 'hidden', value: 'ProfilePage' },
      { name: 'name', type: 'text', label: 'Page Title', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'mainEntity', type: 'nested', label: 'Person', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'jobTitle', type: 'text', label: 'Job Title' },
        { name: 'image', type: 'url', label: 'Photo URL' }
      ]}
    ]
  },

  // ============================================
  // Web Pages
  // ============================================
  {
    type: 'WebSite',
    label: 'Website',
    description: 'A complete website',
    category: 'web',
    fields: [
      { name: '@type', type: 'hidden', value: 'WebSite' },
      { name: 'name', type: 'text', label: 'Site Name', required: true },
      { name: 'url', type: 'url', label: 'Site URL', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'inLanguage', type: 'text', label: 'Language', placeholder: 'en-US' },
      { name: 'potentialAction', type: 'nested', label: 'Search Action', schema: 'SearchAction', fields: [
        { name: '@type', type: 'hidden', value: 'SearchAction' },
        { name: 'target', type: 'url', label: 'Search URL Template', placeholder: 'https://example.com/search?q={search_term_string}', help: 'Use {search_term_string} as placeholder' },
        { name: 'query-input', type: 'text', label: 'Query Input', value: 'required name=search_term_string' }
      ]}
    ]
  },
  {
    type: 'WebPage',
    label: 'Web Page',
    description: 'A single web page',
    category: 'web',
    fields: [
      { name: '@type', type: 'hidden', value: 'WebPage' },
      { name: 'name', type: 'text', label: 'Page Title', required: true },
      { name: 'url', type: 'url', label: 'Page URL' },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'datePublished', type: 'date', label: 'Date Published' },
      { name: 'dateModified', type: 'date', label: 'Date Modified' },
      { name: 'inLanguage', type: 'text', label: 'Language', placeholder: 'en-US' }
    ]
  },
  {
    type: 'AboutPage',
    label: 'About Page',
    description: 'An about page',
    category: 'web',
    fields: [
      { name: '@type', type: 'hidden', value: 'AboutPage' },
      { name: 'name', type: 'text', label: 'Page Title', required: true },
      { name: 'url', type: 'url', label: 'Page URL' },
      { name: 'description', type: 'textarea', label: 'Description' }
    ]
  },
  {
    type: 'ContactPage',
    label: 'Contact Page',
    description: 'A contact page',
    category: 'web',
    fields: [
      { name: '@type', type: 'hidden', value: 'ContactPage' },
      { name: 'name', type: 'text', label: 'Page Title', required: true },
      { name: 'url', type: 'url', label: 'Page URL' },
      { name: 'description', type: 'textarea', label: 'Description' }
    ]
  },

  // ============================================
  // Content / Articles
  // ============================================
  {
    type: 'Article',
    label: 'Article',
    description: 'A general article',
    category: 'content',
    fields: [
      { name: '@type', type: 'hidden', value: 'Article' },
      { name: 'headline', type: 'text', label: 'Headline', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Featured Image URL' },
      { name: 'datePublished', type: 'datetime', label: 'Date Published' },
      { name: 'dateModified', type: 'datetime', label: 'Date Modified' },
      { name: 'author', type: 'nested', label: 'Author', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Author Name', required: true },
        { name: 'url', type: 'url', label: 'Author URL' }
      ]},
      { name: 'publisher', type: 'nested', label: 'Publisher', schema: 'Organization', fields: [
        { name: '@type', type: 'hidden', value: 'Organization' },
        { name: 'name', type: 'text', label: 'Publisher Name', required: true },
        { name: 'logo', type: 'url', label: 'Logo URL' }
      ]}
    ]
  },
  {
    type: 'NewsArticle',
    label: 'News Article',
    description: 'A news article',
    category: 'content',
    fields: [
      { name: '@type', type: 'hidden', value: 'NewsArticle' },
      { name: 'headline', type: 'text', label: 'Headline', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Featured Image URL' },
      { name: 'datePublished', type: 'datetime', label: 'Date Published' },
      { name: 'dateModified', type: 'datetime', label: 'Date Modified' },
      { name: 'dateline', type: 'text', label: 'Dateline', placeholder: 'NEW YORK' },
      { name: 'author', type: 'nested', label: 'Author', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Author Name', required: true }
      ]},
      { name: 'publisher', type: 'nested', label: 'Publisher', schema: 'Organization', fields: [
        { name: '@type', type: 'hidden', value: 'Organization' },
        { name: 'name', type: 'text', label: 'Publisher Name', required: true },
        { name: 'logo', type: 'url', label: 'Logo URL' }
      ]}
    ]
  },
  {
    type: 'BlogPosting',
    label: 'Blog Post',
    description: 'A blog post or blog article',
    category: 'content',
    fields: [
      { name: '@type', type: 'hidden', value: 'BlogPosting' },
      { name: 'headline', type: 'text', label: 'Title', required: true },
      { name: 'description', type: 'textarea', label: 'Excerpt' },
      { name: 'image', type: 'url', label: 'Featured Image URL' },
      { name: 'datePublished', type: 'datetime', label: 'Date Published' },
      { name: 'dateModified', type: 'datetime', label: 'Date Modified' },
      { name: 'wordCount', type: 'number', label: 'Word Count' },
      { name: 'author', type: 'nested', label: 'Author', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Author Name', required: true },
        { name: 'url', type: 'url', label: 'Author URL' }
      ]}
    ]
  },
  {
    type: 'TechArticle',
    label: 'Technical Article',
    description: 'A technical or how-to article',
    category: 'content',
    fields: [
      { name: '@type', type: 'hidden', value: 'TechArticle' },
      { name: 'headline', type: 'text', label: 'Title', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'proficiencyLevel', type: 'select', label: 'Difficulty Level', options: [
        { value: 'Beginner', label: 'Beginner' },
        { value: 'Intermediate', label: 'Intermediate' },
        { value: 'Expert', label: 'Expert' }
      ]},
      { name: 'datePublished', type: 'datetime', label: 'Date Published' },
      { name: 'author', type: 'nested', label: 'Author', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Author Name', required: true }
      ]}
    ]
  },

  // ============================================
  // Commerce
  // ============================================
  {
    type: 'Product',
    label: 'Product',
    description: 'A product for sale',
    category: 'commerce',
    fields: [
      { name: '@type', type: 'hidden', value: 'Product' },
      { name: 'name', type: 'text', label: 'Product Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Product Image URL' },
      { name: 'sku', type: 'text', label: 'SKU' },
      { name: 'mpn', type: 'text', label: 'MPN (Manufacturer Part Number)' },
      { name: 'gtin', type: 'text', label: 'GTIN/UPC/EAN' },
      { name: 'brand', type: 'nested', label: 'Brand', schema: 'Brand', fields: [
        { name: '@type', type: 'hidden', value: 'Brand' },
        { name: 'name', type: 'text', label: 'Brand Name', required: true }
      ]},
      { name: 'offers', type: 'nested', label: 'Offer', schema: 'Offer', fields: [
        { name: '@type', type: 'hidden', value: 'Offer' },
        { name: 'price', type: 'number', label: 'Price', required: true },
        { name: 'priceCurrency', type: 'text', label: 'Currency', placeholder: 'USD' },
        { name: 'availability', type: 'select', label: 'Availability', options: [
          { value: 'https://schema.org/InStock', label: 'In Stock' },
          { value: 'https://schema.org/OutOfStock', label: 'Out of Stock' },
          { value: 'https://schema.org/PreOrder', label: 'Pre-Order' },
          { value: 'https://schema.org/LimitedAvailability', label: 'Limited Availability' }
        ]},
        { name: 'url', type: 'url', label: 'Product URL' },
        { name: 'priceValidUntil', type: 'date', label: 'Price Valid Until' }
      ]},
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },
  {
    type: 'Review',
    label: 'Review',
    description: 'A review of an item',
    category: 'commerce',
    fields: [
      { name: '@type', type: 'hidden', value: 'Review' },
      { name: 'name', type: 'text', label: 'Review Title' },
      { name: 'reviewBody', type: 'textarea', label: 'Review Text', required: true },
      { name: 'datePublished', type: 'date', label: 'Date Published' },
      { name: 'author', type: 'nested', label: 'Reviewer', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Reviewer Name', required: true }
      ]},
      { name: 'reviewRating', type: 'nested', label: 'Rating', schema: 'Rating', fields: [
        { name: '@type', type: 'hidden', value: 'Rating' },
        { name: 'ratingValue', type: 'number', label: 'Rating', required: true },
        { name: 'bestRating', type: 'number', label: 'Best Rating', value: '5' },
        { name: 'worstRating', type: 'number', label: 'Worst Rating', value: '1' }
      ]}
    ]
  },

  // ============================================
  // Events
  // ============================================
  {
    type: 'Event',
    label: 'Event',
    description: 'A general event',
    category: 'event',
    fields: [
      { name: '@type', type: 'hidden', value: 'Event' },
      { name: 'name', type: 'text', label: 'Event Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Event Image URL' },
      { name: 'startDate', type: 'datetime', label: 'Start Date/Time', required: true },
      { name: 'endDate', type: 'datetime', label: 'End Date/Time' },
      { name: 'eventStatus', type: 'select', label: 'Status', options: [
        { value: 'https://schema.org/EventScheduled', label: 'Scheduled' },
        { value: 'https://schema.org/EventCancelled', label: 'Cancelled' },
        { value: 'https://schema.org/EventPostponed', label: 'Postponed' },
        { value: 'https://schema.org/EventRescheduled', label: 'Rescheduled' }
      ]},
      { name: 'eventAttendanceMode', type: 'select', label: 'Attendance Mode', options: [
        { value: 'https://schema.org/OfflineEventAttendanceMode', label: 'In-Person' },
        { value: 'https://schema.org/OnlineEventAttendanceMode', label: 'Online' },
        { value: 'https://schema.org/MixedEventAttendanceMode', label: 'Hybrid' }
      ]},
      { name: 'location', type: 'nested', label: 'Location', schema: 'Place', fields: [
        { name: '@type', type: 'hidden', value: 'Place' },
        { name: 'name', type: 'text', label: 'Venue Name' },
        { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields }
      ]},
      { name: 'organizer', type: 'nested', label: 'Organizer', schema: 'Organization', fields: [
        { name: '@type', type: 'hidden', value: 'Organization' },
        { name: 'name', type: 'text', label: 'Organizer Name' },
        { name: 'url', type: 'url', label: 'Organizer URL' }
      ]},
      { name: 'offers', type: 'nested', label: 'Tickets', schema: 'Offer', fields: [
        { name: '@type', type: 'hidden', value: 'Offer' },
        { name: 'price', type: 'number', label: 'Price' },
        { name: 'priceCurrency', type: 'text', label: 'Currency', placeholder: 'USD' },
        { name: 'url', type: 'url', label: 'Ticket URL' },
        { name: 'availability', type: 'select', label: 'Availability', options: [
          { value: 'https://schema.org/InStock', label: 'Available' },
          { value: 'https://schema.org/SoldOut', label: 'Sold Out' },
          { value: 'https://schema.org/PreOrder', label: 'Pre-Sale' }
        ]}
      ]}
    ]
  },
  {
    type: 'BusinessEvent',
    label: 'Business Event',
    description: 'A business event like a conference',
    category: 'event',
    fields: [
      { name: '@type', type: 'hidden', value: 'BusinessEvent' },
      { name: 'name', type: 'text', label: 'Event Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'startDate', type: 'datetime', label: 'Start Date/Time', required: true },
      { name: 'endDate', type: 'datetime', label: 'End Date/Time' },
      { name: 'location', type: 'nested', label: 'Location', schema: 'Place', fields: [
        { name: '@type', type: 'hidden', value: 'Place' },
        { name: 'name', type: 'text', label: 'Venue Name' },
        { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields }
      ]}
    ]
  },

  // ============================================
  // Services
  // ============================================
  {
    type: 'Service',
    label: 'Service',
    description: 'A service offered by a business',
    category: 'service',
    fields: [
      { name: '@type', type: 'hidden', value: 'Service' },
      { name: 'name', type: 'text', label: 'Service Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'serviceType', type: 'text', label: 'Service Type' },
      { name: 'provider', type: 'nested', label: 'Provider', schema: 'Organization', fields: [
        { name: '@type', type: 'hidden', value: 'Organization' },
        { name: 'name', type: 'text', label: 'Provider Name', required: true }
      ]},
      { name: 'areaServed', type: 'text', label: 'Area Served', placeholder: 'San Francisco Bay Area' },
      { name: 'offers', type: 'nested', label: 'Pricing', schema: 'Offer', fields: [
        { name: '@type', type: 'hidden', value: 'Offer' },
        { name: 'price', type: 'number', label: 'Starting Price' },
        { name: 'priceCurrency', type: 'text', label: 'Currency', placeholder: 'USD' }
      ]}
    ]
  },
  {
    type: 'ProfessionalService',
    label: 'Professional Service',
    description: 'A professional service (lawyer, accountant, etc.)',
    category: 'service',
    fields: [
      { name: '@type', type: 'hidden', value: 'ProfessionalService' },
      { name: 'name', type: 'text', label: 'Business Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'url', type: 'url', label: 'Website URL' },
      { name: 'telephone', type: 'tel', label: 'Phone' },
      { name: 'priceRange', type: 'text', label: 'Price Range', placeholder: '$$$' },
      { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields }
    ]
  },

  // ============================================
  // Navigation
  // ============================================
  {
    type: 'BreadcrumbList',
    label: 'Breadcrumb',
    description: 'Navigation breadcrumbs',
    category: 'navigation',
    fields: [
      { name: '@type', type: 'hidden', value: 'BreadcrumbList' },
      { name: 'itemListElement', type: 'array', label: 'Breadcrumb Items', itemType: 'nested', schema: 'ListItem', fields: [
        { name: '@type', type: 'hidden', value: 'ListItem' },
        { name: 'position', type: 'number', label: 'Position', required: true },
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'item', type: 'url', label: 'URL' }
      ]}
    ]
  },
  {
    type: 'ItemList',
    label: 'Item List',
    description: 'A list of items (e.g., top 10 list)',
    category: 'navigation',
    fields: [
      { name: '@type', type: 'hidden', value: 'ItemList' },
      { name: 'name', type: 'text', label: 'List Name' },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'numberOfItems', type: 'number', label: 'Number of Items' },
      { name: 'itemListOrder', type: 'select', label: 'Order', options: [
        { value: 'https://schema.org/ItemListOrderAscending', label: 'Ascending' },
        { value: 'https://schema.org/ItemListOrderDescending', label: 'Descending' },
        { value: 'https://schema.org/ItemListUnordered', label: 'Unordered' }
      ]}
    ]
  },
  {
    type: 'SiteNavigationElement',
    label: 'Site Navigation',
    description: 'Website navigation element',
    category: 'navigation',
    fields: [
      { name: '@type', type: 'hidden', value: 'SiteNavigationElement' },
      { name: 'name', type: 'text', label: 'Navigation Name', required: true },
      { name: 'url', type: 'url', label: 'URL' }
    ]
  },

  // ============================================
  // How-To & Recipes
  // ============================================
  {
    type: 'HowTo',
    label: 'How-To Guide',
    description: 'Step-by-step instructions',
    category: 'howto',
    fields: [
      { name: '@type', type: 'hidden', value: 'HowTo' },
      { name: 'name', type: 'text', label: 'Title', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Image URL' },
      { name: 'totalTime', type: 'text', label: 'Total Time', placeholder: 'PT30M (30 minutes)' },
      { name: 'estimatedCost', type: 'nested', label: 'Estimated Cost', schema: 'MonetaryAmount', fields: monetaryAmountFields },
      { name: 'step', type: 'array', label: 'Steps', itemType: 'nested', schema: 'HowToStep', fields: [
        { name: '@type', type: 'hidden', value: 'HowToStep' },
        { name: 'name', type: 'text', label: 'Step Title' },
        { name: 'text', type: 'textarea', label: 'Instructions', required: true },
        { name: 'image', type: 'url', label: 'Step Image URL' }
      ]}
    ]
  },
  {
    type: 'Recipe',
    label: 'Recipe',
    description: 'A cooking recipe',
    category: 'howto',
    fields: [
      { name: '@type', type: 'hidden', value: 'Recipe' },
      { name: 'name', type: 'text', label: 'Recipe Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Recipe Image URL' },
      { name: 'prepTime', type: 'text', label: 'Prep Time', placeholder: 'PT15M' },
      { name: 'cookTime', type: 'text', label: 'Cook Time', placeholder: 'PT30M' },
      { name: 'totalTime', type: 'text', label: 'Total Time', placeholder: 'PT45M' },
      { name: 'recipeYield', type: 'text', label: 'Yield', placeholder: '4 servings' },
      { name: 'recipeCategory', type: 'text', label: 'Category', placeholder: 'Dinner, Dessert' },
      { name: 'recipeCuisine', type: 'text', label: 'Cuisine', placeholder: 'Italian' },
      { name: 'recipeIngredient', type: 'array', label: 'Ingredients', itemType: 'text' },
      { name: 'recipeInstructions', type: 'array', label: 'Instructions', itemType: 'nested', schema: 'HowToStep', fields: [
        { name: '@type', type: 'hidden', value: 'HowToStep' },
        { name: 'text', type: 'textarea', label: 'Step', required: true }
      ]},
      { name: 'nutrition', type: 'nested', label: 'Nutrition', schema: 'NutritionInformation', fields: [
        { name: '@type', type: 'hidden', value: 'NutritionInformation' },
        { name: 'calories', type: 'text', label: 'Calories', placeholder: '250 calories' },
        { name: 'servingSize', type: 'text', label: 'Serving Size', placeholder: '1 cup' }
      ]},
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },

  // ============================================
  // Media
  // ============================================
  {
    type: 'VideoObject',
    label: 'Video',
    description: 'A video file',
    category: 'media',
    fields: [
      { name: '@type', type: 'hidden', value: 'VideoObject' },
      { name: 'name', type: 'text', label: 'Video Title', required: true },
      { name: 'description', type: 'textarea', label: 'Description', required: true },
      { name: 'thumbnailUrl', type: 'url', label: 'Thumbnail URL', required: true },
      { name: 'uploadDate', type: 'date', label: 'Upload Date', required: true },
      { name: 'duration', type: 'text', label: 'Duration', placeholder: 'PT1H30M (1 hour 30 min)' },
      { name: 'contentUrl', type: 'url', label: 'Video URL' },
      { name: 'embedUrl', type: 'url', label: 'Embed URL' }
    ]
  },
  {
    type: 'ImageObject',
    label: 'Image',
    description: 'An image file',
    category: 'media',
    fields: [
      { name: '@type', type: 'hidden', value: 'ImageObject' },
      { name: 'name', type: 'text', label: 'Image Name' },
      { name: 'contentUrl', type: 'url', label: 'Image URL', required: true },
      { name: 'caption', type: 'text', label: 'Caption' },
      { name: 'width', type: 'number', label: 'Width (px)' },
      { name: 'height', type: 'number', label: 'Height (px)' },
      { name: 'author', type: 'text', label: 'Photographer/Author' }
    ]
  },

  // ============================================
  // Software
  // ============================================
  {
    type: 'SoftwareApplication',
    label: 'Software Application',
    description: 'A software application',
    category: 'software',
    fields: [
      { name: '@type', type: 'hidden', value: 'SoftwareApplication' },
      { name: 'name', type: 'text', label: 'App Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'applicationCategory', type: 'select', label: 'Category', options: [
        { value: 'BusinessApplication', label: 'Business' },
        { value: 'GameApplication', label: 'Game' },
        { value: 'LifestyleApplication', label: 'Lifestyle' },
        { value: 'MultimediaApplication', label: 'Multimedia' },
        { value: 'SocialNetworkingApplication', label: 'Social' },
        { value: 'UtilitiesApplication', label: 'Utilities' }
      ]},
      { name: 'operatingSystem', type: 'text', label: 'Operating System', placeholder: 'Windows, macOS, iOS' },
      { name: 'softwareVersion', type: 'text', label: 'Version' },
      { name: 'offers', type: 'nested', label: 'Pricing', schema: 'Offer', fields: [
        { name: '@type', type: 'hidden', value: 'Offer' },
        { name: 'price', type: 'number', label: 'Price' },
        { name: 'priceCurrency', type: 'text', label: 'Currency', placeholder: 'USD' }
      ]},
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },
  {
    type: 'MobileApplication',
    label: 'Mobile App',
    description: 'A mobile application',
    category: 'software',
    fields: [
      { name: '@type', type: 'hidden', value: 'MobileApplication' },
      { name: 'name', type: 'text', label: 'App Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'operatingSystem', type: 'text', label: 'Platform', placeholder: 'iOS, Android' },
      { name: 'softwareVersion', type: 'text', label: 'Version' },
      { name: 'downloadUrl', type: 'url', label: 'Download URL' },
      { name: 'installUrl', type: 'url', label: 'Install URL (App Store)' },
      { name: 'screenshot', type: 'url', label: 'Screenshot URL' },
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },

  // ============================================
  // Education
  // ============================================
  {
    type: 'Course',
    label: 'Course',
    description: 'An educational course',
    category: 'education',
    fields: [
      { name: '@type', type: 'hidden', value: 'Course' },
      { name: 'name', type: 'text', label: 'Course Title', required: true },
      { name: 'description', type: 'textarea', label: 'Description', required: true },
      { name: 'provider', type: 'nested', label: 'Provider', schema: 'Organization', fields: [
        { name: '@type', type: 'hidden', value: 'Organization' },
        { name: 'name', type: 'text', label: 'Provider Name', required: true },
        { name: 'url', type: 'url', label: 'Provider URL' }
      ]},
      { name: 'hasCourseInstance', type: 'nested', label: 'Course Instance', schema: 'CourseInstance', fields: [
        { name: '@type', type: 'hidden', value: 'CourseInstance' },
        { name: 'courseMode', type: 'select', label: 'Mode', options: [
          { value: 'online', label: 'Online' },
          { value: 'onsite', label: 'On-site' },
          { value: 'blended', label: 'Blended' }
        ]},
        { name: 'startDate', type: 'date', label: 'Start Date' },
        { name: 'endDate', type: 'date', label: 'End Date' }
      ]},
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },

  // ============================================
  // Jobs
  // ============================================
  {
    type: 'JobPosting',
    label: 'Job Posting',
    description: 'A job listing',
    category: 'jobs',
    fields: [
      { name: '@type', type: 'hidden', value: 'JobPosting' },
      { name: 'title', type: 'text', label: 'Job Title', required: true },
      { name: 'description', type: 'textarea', label: 'Job Description', required: true },
      { name: 'datePosted', type: 'date', label: 'Date Posted', required: true },
      { name: 'validThrough', type: 'date', label: 'Valid Through' },
      { name: 'employmentType', type: 'select', label: 'Employment Type', options: [
        { value: 'FULL_TIME', label: 'Full-time' },
        { value: 'PART_TIME', label: 'Part-time' },
        { value: 'CONTRACT', label: 'Contract' },
        { value: 'TEMPORARY', label: 'Temporary' },
        { value: 'INTERN', label: 'Internship' }
      ]},
      { name: 'hiringOrganization', type: 'nested', label: 'Company', schema: 'Organization', fields: [
        { name: '@type', type: 'hidden', value: 'Organization' },
        { name: 'name', type: 'text', label: 'Company Name', required: true },
        { name: 'url', type: 'url', label: 'Company Website' },
        { name: 'logo', type: 'url', label: 'Logo URL' }
      ]},
      { name: 'jobLocation', type: 'nested', label: 'Location', schema: 'Place', fields: [
        { name: '@type', type: 'hidden', value: 'Place' },
        { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields }
      ]},
      { name: 'baseSalary', type: 'nested', label: 'Salary', schema: 'MonetaryAmount', fields: [
        { name: '@type', type: 'hidden', value: 'MonetaryAmount' },
        { name: 'currency', type: 'text', label: 'Currency', placeholder: 'USD' },
        { name: 'value', type: 'nested', label: 'Value', schema: 'QuantitativeValue', fields: [
          { name: '@type', type: 'hidden', value: 'QuantitativeValue' },
          { name: 'minValue', type: 'number', label: 'Min Salary' },
          { name: 'maxValue', type: 'number', label: 'Max Salary' },
          { name: 'unitText', type: 'select', label: 'Period', options: [
            { value: 'YEAR', label: 'Per Year' },
            { value: 'MONTH', label: 'Per Month' },
            { value: 'HOUR', label: 'Per Hour' }
          ]}
        ]}
      ]}
    ]
  },

  // ============================================
  // Places
  // ============================================
  {
    type: 'Place',
    label: 'Place',
    description: 'A physical location',
    category: 'place',
    fields: [
      { name: '@type', type: 'hidden', value: 'Place' },
      { name: 'name', type: 'text', label: 'Place Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Image URL' },
      { name: 'telephone', type: 'tel', label: 'Phone' },
      { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields },
      { name: 'geo', type: 'nested', label: 'Coordinates', schema: 'GeoCoordinates', fields: geoCoordinatesFields }
    ]
  },
  {
    type: 'Hotel',
    label: 'Hotel',
    description: 'A hotel or accommodation',
    category: 'place',
    fields: [
      { name: '@type', type: 'hidden', value: 'Hotel' },
      { name: 'name', type: 'text', label: 'Hotel Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Image URL' },
      { name: 'starRating', type: 'number', label: 'Star Rating', placeholder: '1-5' },
      { name: 'priceRange', type: 'text', label: 'Price Range', placeholder: '$$$' },
      { name: 'telephone', type: 'tel', label: 'Phone' },
      { name: 'address', type: 'nested', label: 'Address', schema: 'PostalAddress', fields: postalAddressFields },
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },

  // ============================================
  // Creative Works
  // ============================================
  {
    type: 'Book',
    label: 'Book',
    description: 'A book publication',
    category: 'creative',
    fields: [
      { name: '@type', type: 'hidden', value: 'Book' },
      { name: 'name', type: 'text', label: 'Book Title', required: true },
      { name: 'author', type: 'nested', label: 'Author', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Author Name', required: true }
      ]},
      { name: 'isbn', type: 'text', label: 'ISBN' },
      { name: 'datePublished', type: 'date', label: 'Publication Date' },
      { name: 'numberOfPages', type: 'number', label: 'Number of Pages' },
      { name: 'bookFormat', type: 'select', label: 'Format', options: [
        { value: 'https://schema.org/Hardcover', label: 'Hardcover' },
        { value: 'https://schema.org/Paperback', label: 'Paperback' },
        { value: 'https://schema.org/EBook', label: 'E-Book' },
        { value: 'https://schema.org/AudiobookFormat', label: 'Audiobook' }
      ]},
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },
  {
    type: 'Movie',
    label: 'Movie',
    description: 'A movie or film',
    category: 'creative',
    fields: [
      { name: '@type', type: 'hidden', value: 'Movie' },
      { name: 'name', type: 'text', label: 'Movie Title', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Poster URL' },
      { name: 'datePublished', type: 'date', label: 'Release Date' },
      { name: 'duration', type: 'text', label: 'Duration', placeholder: 'PT2H30M' },
      { name: 'director', type: 'nested', label: 'Director', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Director Name', required: true }
      ]},
      { name: 'aggregateRating', type: 'nested', label: 'Rating', schema: 'AggregateRating', fields: ratingFields }
    ]
  },
  {
    type: 'Podcast',
    label: 'Podcast',
    description: 'A podcast series',
    category: 'creative',
    fields: [
      { name: '@type', type: 'hidden', value: 'PodcastSeries' },
      { name: 'name', type: 'text', label: 'Podcast Name', required: true },
      { name: 'description', type: 'textarea', label: 'Description' },
      { name: 'image', type: 'url', label: 'Cover Art URL' },
      { name: 'url', type: 'url', label: 'Podcast URL' },
      { name: 'author', type: 'nested', label: 'Host', schema: 'Person', fields: [
        { name: '@type', type: 'hidden', value: 'Person' },
        { name: 'name', type: 'text', label: 'Host Name', required: true }
      ]}
    ]
  },

  // ============================================
  // FAQ
  // ============================================
  {
    type: 'FAQPage',
    label: 'FAQ Page',
    description: 'A page of frequently asked questions',
    category: 'faq',
    fields: [
      { name: '@type', type: 'hidden', value: 'FAQPage' },
      { name: 'mainEntity', type: 'array', label: 'Questions', itemType: 'nested', schema: 'Question', fields: [
        { name: '@type', type: 'hidden', value: 'Question' },
        { name: 'name', type: 'text', label: 'Question', required: true },
        { name: 'acceptedAnswer', type: 'nested', label: 'Answer', schema: 'Answer', fields: [
          { name: '@type', type: 'hidden', value: 'Answer' },
          { name: 'text', type: 'textarea', label: 'Answer Text', required: true }
        ]}
      ]}
    ]
  }
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get schema types grouped by category
 * @returns {Object} Schema types grouped by category
 */
export function getSchemasByCategory() {
  const grouped = {};

  SCHEMA_TYPES.forEach(schema => {
    if (!grouped[schema.category]) {
      grouped[schema.category] = [];
    }
    grouped[schema.category].push(schema);
  });

  return grouped;
}

/**
 * Get a specific schema type definition
 * @param {string} type - Schema.org @type value
 * @returns {SchemaType|undefined} The schema definition or undefined
 */
export function getSchemaType(type) {
  return SCHEMA_TYPES.find(s => s.type === type);
}

/**
 * Get all schema type names for a category
 * @param {string} category - Category name
 * @returns {Array<string>} Array of schema type names
 */
export function getSchemasForCategory(category) {
  return SCHEMA_TYPES
    .filter(s => s.category === category)
    .map(s => s.type);
}

/**
 * Build JSON-LD output from schema data
 * @param {string} type - Schema.org @type
 * @param {Object} data - Field values
 * @returns {Object} JSON-LD object
 */
export function buildJsonLd(type, data) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data
  };

  // Clean up empty values
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === '' || jsonLd[key] === null || jsonLd[key] === undefined) {
      delete jsonLd[key];
    }
    if (Array.isArray(jsonLd[key]) && jsonLd[key].length === 0) {
      delete jsonLd[key];
    }
  });

  return jsonLd;
}

export default {
  SCHEMA_CATEGORIES,
  SCHEMA_TYPES,
  getSchemasByCategory,
  getSchemaType,
  getSchemasForCategory,
  buildJsonLd
};
