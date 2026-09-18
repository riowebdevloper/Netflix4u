/**
 * Netflix4U Universal Multi-Server Streaming Architecture
 * Normalized Player & Provider Type Definitions
 */

export type ContentType = 'movie' | 'tv';

export interface PlaybackInput {
  canonicalId: string;
  contentType: ContentType;
  tmdbId?: number | string;
  imdbId?: string;
  season?: number;
  episode?: number;
}

export interface MoviePlaybackInput {
  canonicalId: string;
  tmdbId?: number | string;
  imdbId?: string;
}

export interface TvPlaybackInput {
  canonicalId: string;
  tmdbId?: number | string;
  imdbId?: string;
  season: number;
  episode: number;
}

export interface PlaybackValidationResult {
  valid: boolean;
  error?: string;
}

export interface BuildUrlOptions {
  lang?: string;
  autoPlay?: boolean;
  theme?: string;
  accent?: string;
  domain?: string;
}

export interface PlayerProvider {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  priority: number;
  enabled: boolean;
  providerGroup?: string;
  supportedTypes: ContentType[];
  requiredIdentifier: 'tmdb' | 'imdb' | 'either';
  supportsMovie: boolean;
  supportsTV: boolean;
  notes?: string;

  buildMovieUrl(input: MoviePlaybackInput, options?: BuildUrlOptions): string | null;
  buildTvUrl(input: TvPlaybackInput, options?: BuildUrlOptions): string | null;
  validateInput(input: PlaybackInput): PlaybackValidationResult;
}

export interface ProviderHealthRecord {
  providerId: string;
  lastChecked: number;
  statusCode?: number;
  isHealthy: boolean;
  consecutiveFailures: number;
  lastError?: string;
}
