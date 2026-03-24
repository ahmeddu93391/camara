const LOCATIONS = {
  '0900000001': {
    latitude: 48.8566,
    longitude: 2.3522,
    city: 'Paris',
    country: 'France',
    coherent: true
  },
  '0900000003': {
    latitude: 48.8566,
    longitude: 2.3522,
    city: 'Paris',
    country: 'France',
    coherent: true
  },
  '0900000005': {
    latitude: 48.8566,
    longitude: 2.3522,
    city: 'Paris',
    country: 'France',
    coherent: true
  },
  // Abonnés suspects position incohérente (loin de Paris)
  '0900000002': {
    latitude: 40.7128,
    longitude: -74.0060,
    city: 'New York',
    country: 'USA',
    coherent: false 
  },
  '0900000004': {
    latitude: 35.6762,
    longitude: 139.6503,
    city: 'Tokyo',
    country: 'Japan',
    coherent: false 
  }
};

module.exports = LOCATIONS;
