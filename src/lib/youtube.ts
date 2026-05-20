// Multiple Piped API instances for reliability
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
];

const FETCH_TIMEOUT_MS = 10000;

export interface YoutubeVideo {
  title: string;
  url: string;
  thumbnail: string;
  duration: number; // seconds
  videoId: string;
}

export interface YoutubePlaylist {
  title: string;
  videos: YoutubeVideo[];
}

function extractPlaylistId(playlistUrl: string): string {
  try {
    const url = new URL(playlistUrl);
    const listId = url.searchParams.get('list');
    if (listId) return listId;
  } catch {
    // not a valid URL
  }
  // Maybe the user pasted just the ID
  if (/^PL[A-Za-z0-9_-]+$/.test(playlistUrl.trim())) {
    return playlistUrl.trim();
  }
  throw new Error('Could not find a playlist ID. Please provide a valid YouTube playlist URL.');
}

function parseVideoId(streamUrl: string): string {
  // Piped returns urls like "/watch?v=VIDEO_ID"
  if (streamUrl.includes('?v=')) {
    return streamUrl.split('?v=')[1]?.split('&')[0] || '';
  }
  // fallback: strip path prefix
  return streamUrl.replace(/^\/watch\?v=/, '');
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromInstance(
  baseUrl: string,
  playlistId: string,
  existingVideoIds: Set<string>
): Promise<YoutubePlaylist> {
  const videos: YoutubeVideo[] = [];
  let nextpage: string | null = null;
  let title = 'Imported Playlist';

  // First page
  const firstRes = await fetchWithTimeout(`${baseUrl}/playlists/${playlistId}`, FETCH_TIMEOUT_MS);
  if (!firstRes.ok) throw new Error(`API returned ${firstRes.status}`);
  const firstData = await firstRes.json();

  title = firstData.name || title;

  if (Array.isArray(firstData.relatedStreams)) {
    for (const stream of firstData.relatedStreams) {
      const vid = parseVideoId(stream.url || '');
      if (vid && !existingVideoIds.has(vid)) {
        videos.push({
          title: stream.title || 'Untitled',
          url: `https://www.youtube.com/watch?v=${vid}`,
          thumbnail: stream.thumbnail || '',
          duration: stream.duration || 0,
          videoId: vid,
        });
      }
    }
  }

  nextpage = firstData.nextpage || null;

  // Follow pagination (max 10 pages = ~300 videos)
  let pageCount = 0;
  while (nextpage && pageCount < 10) {
    pageCount++;
    const pageRes = await fetchWithTimeout(
      `${baseUrl}/nextpage/playlists/${playlistId}?nextpage=${encodeURIComponent(nextpage)}`,
      FETCH_TIMEOUT_MS
    );
    if (!pageRes.ok) break;
    const pageData = await pageRes.json();

    if (Array.isArray(pageData.relatedStreams)) {
      for (const stream of pageData.relatedStreams) {
        const vid = parseVideoId(stream.url || '');
        if (vid && !existingVideoIds.has(vid)) {
          videos.push({
            title: stream.title || 'Untitled',
            url: `https://www.youtube.com/watch?v=${vid}`,
            thumbnail: stream.thumbnail || '',
            duration: stream.duration || 0,
            videoId: vid,
          });
        }
      }
    }

    nextpage = pageData.nextpage || null;
  }

  return { title, videos };
}

/**
 * Fetch a YouTube playlist with automatic fallback across multiple Piped instances.
 * @param playlistUrl - Full YouTube playlist URL or raw playlist ID
 * @param existingVideoIds - Set of videoIds already imported (for dedup/sync)
 */
export async function fetchPlaylist(
  playlistUrl: string,
  existingVideoIds: Set<string> = new Set()
): Promise<YoutubePlaylist> {
  const playlistId = extractPlaylistId(playlistUrl);
  const errors: string[] = [];

  for (const instance of PIPED_INSTANCES) {
    try {
      return await fetchFromInstance(instance, playlistId, existingVideoIds);
    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? `${instance}: request timed out`
        : `${instance}: ${err?.message || 'unknown error'}`;
      errors.push(msg);
      // continue to next instance
    }
  }

  throw new Error(
    `All YouTube API providers failed. Please try again later.\n\nDetails:\n${errors.join('\n')}`
  );
}
