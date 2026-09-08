/**
 * Netflix4U Normalized Data Models & Types
 * Defines the canonical contract for all content providers (Dotmobiz, Hicine, TMDB).
 */

/**
 * Normalized Movie Object Schema
 * @typedef {Object} NormalizedMovie
 * @property {string} id - Unique identifier (e.g. "dotmobiz-19293" or numeric id)
 * @property {string} title - Cleaned display title
 * @property {string} originalTitle - Raw full title
 * @property {string} overview - Full synopsis/description
 * @property {string} shortDescription - Truncated summary for cards
 * @property {string} poster - Poster image URL
 * @property {string} backdrop - Backdrop image URL
 * @property {number} year - Release year (e.g. 2026)
 * @property {number} rating - Average rating (0-10)
 * @property {string} voteCount - Formatted vote count (e.g. "14.2K")
 * @property {string[]} genres - Array of genre strings
 * @property {string} runtime - Duration string (e.g. "2h 10m")
 * @property {string} quality - Video quality tag (e.g. "FHD", "4K", "HD")
 * @property {string} language - Audio language
 * @property {string} country - Country of origin
 * @property {string[]} cast - Array of actor names or cast objects
 * @property {string} director - Director name
 * @property {string} trailer - YouTube trailer embed URL
 * @property {string} contentType - "movie"
 * @property {string} slug - URL friendly slug
 * @property {string} imdbId - IMDb ID (e.g. "tt34339725")
 * @property {string} provider - Source provider name ("dotmobiz" | "hicine")
 * @property {Array} downloadOptions - Array of download links with qualities and sizes
 * @property {Array} playbackSources - Array of playable server streams
 * @property {Array} screenshots - Array of screenshot image URLs
 */

/**
 * Normalized TV Series Object Schema
 * @typedef {Object} NormalizedTVSeries
 * @property {string} id - Unique identifier
 * @property {string} title - Cleaned display title
 * @property {string} originalTitle - Raw full title
 * @property {string} overview - Full synopsis
 * @property {string} shortDescription - Truncated summary
 * @property {string} poster - Poster image URL
 * @property {string} backdrop - Backdrop image URL
 * @property {number} year - Release year
 * @property {number} rating - Average rating
 * @property {string} voteCount - Formatted vote count
 * @property {string[]} genres - Array of genre strings
 * @property {string} runtime - Runtime per episode (e.g. "~45m/ep")
 * @property {string} quality - Video quality tag
 * @property {string} language - Audio language
 * @property {string} country - Country of origin
 * @property {string[]} cast - Array of actor names
 * @property {string} creator - Creator / Director name
 * @property {number} seasonsCount - Number of seasons
 * @property {Array} seasons - Array of season objects
 * @property {string} trailer - YouTube trailer embed URL
 * @property {string} contentType - "series" | "anime" | "kdrama"
 * @property {string} slug - URL slug
 * @property {string} imdbId - IMDb ID
 * @property {string} provider - Source provider name
 * @property {Array} downloadOptions - Available download packages
 * @property {Array} playbackSources - Available playback servers
 * @property {Array} screenshots - Screenshot URLs
 */

module.exports = {};
