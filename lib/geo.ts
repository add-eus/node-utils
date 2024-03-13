const NodeGeocoder = require("node-geocoder");
const geohash = require("ngeohash");

/**
 * Calculates the distance, in kilometers, between two locations, via the
 * Haversine formula. Note that this is approximate due to the fact that
 * the Earth's radius varies between 6356.752 km and 6378.137 km.
 *
 * @param {Object} location1 The first location given as .latitude and .longitude
 * @param {Object} location2 The second location given as .latitude and .longitude
 * @return {number} The distance, in kilometers, between the inputted locations.
 */
export function distance(location1: any, location2: any) {
    const radius = 6371; // Earth's radius in kilometers
    const latDelta = module.exports.degreesToRadians(
        location2.latitude - location1.latitude
    );
    const lonDelta = module.exports.degreesToRadians(
        location2.longitude - location1.longitude
    );

    const a =
        Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
        Math.cos(module.exports.degreesToRadians(location1.latitude)) *
            Math.cos(module.exports.degreesToRadians(location2.latitude)) *
            Math.sin(lonDelta / 2) *
            Math.sin(lonDelta / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return radius * c;
}

/**
 * Calculates the SW and NE corners of a bounding box around a center point for a given radius;
 *
 * @param {Object} center The center given as .latitude and .longitude
 * @param {number} radius The radius of the box (in kilometers)
 * @return {Object} The SW and NE corners given as .swCorner and .neCorner
 */
export function boundingBoxCoordinates(center: any, radius: any) {
    const KM_PER_DEGREE_LATITUDE = 110.574;
    const latDegrees = radius / KM_PER_DEGREE_LATITUDE;
    const latitudeNorth = Math.min(90, center.latitude + latDegrees);
    const latitudeSouth = Math.max(-90, center.latitude - latDegrees);
    // calculate longitude based on current latitude
    const longDegsNorth = module.exports.metersToLongitudeDegrees(radius, latitudeNorth);
    const longDegsSouth = module.exports.metersToLongitudeDegrees(radius, latitudeSouth);
    const longDegs = Math.max(longDegsNorth, longDegsSouth);
    return {
        swCorner: {
            // bottom-left (SW corner)
            latitude: latitudeSouth,
            longitude: module.exports.wrapLongitude(center.longitude - longDegs),
        },
        neCorner: {
            // top-right (NE corner)
            latitude: latitudeNorth,
            longitude: module.exports.wrapLongitude(center.longitude + longDegs),
        },
    };
}

/**
 * Calculates the number of degrees a given distance is at a given latitude.
 *
 * @param {number} distance The distance to convert.
 * @param {number} latitude The latitude at which to calculate.
 * @return {number} The number of degrees the distance corresponds to.
 */
export function metersToLongitudeDegrees(distance: any, latitude: any) {
    const EARTH_EQ_RADIUS = 6378137.0;
    // this is a super, fancy magic number that the GeoFire lib can explain (maybe)
    const E2 = 0.00669447819799;
    const EPSILON = 1e-12;
    const radians = module.exports.degreesToRadians(latitude);
    const num = (Math.cos(radians) * EARTH_EQ_RADIUS * Math.PI) / 180;
    const denom = 1 / Math.sqrt(1 - E2 * Math.sin(radians) * Math.sin(radians));
    const deltaDeg = num * denom;
    if (deltaDeg < EPSILON) {
        return distance > 0 ? 360 : 0;
    }
    // else
    return Math.min(360, distance / deltaDeg);
}

/**
 * Wraps the longitude to [-180,180].
 *
 * @param {number} longitude The longitude to wrap.
 * @return {number} longitude The resulting longitude.
 */
export function wrapLongitude(longitude: any) {
    if (longitude <= 180 && longitude >= -180) {
        return longitude;
    }
    const adjusted = longitude + 180;
    if (adjusted > 0) {
        return (adjusted % 360) - 180;
    }
    // else
    return 180 - (-adjusted % 360);
}

export function degreesToRadians(degrees: any) {
    return (degrees * Math.PI) / 180;
}

export async function getGeoPointFromLocation(location: any) {
    const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || "{}");

    const options = {
        provider: "google",
        // clientId: googleCredentials.client_id,
        apiKey: firebaseConfig.apiKey,
        formatter: null, // 'gpx', 'string', ...
    };

    const geocoder = NodeGeocoder(options);

    // Using callback
    const result = await geocoder.geocode(location);
    return [result[0].latitude, result[0].longitude];
}

export function getGeoHashFromGeoPoint(geoPoint: any) {
    return geohash.encode(...geoPoint);
}
