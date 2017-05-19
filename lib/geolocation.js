const appEnv = require('./env');
const geolocationservice = appEnv.getService('geolocationservice');

const googleMapsClient = require('@google/maps').createClient({
  key: geolocationservice.credentials.key,
  Promise: Promise
});

module.exports = googleMapsClient;