export interface GistConfig {
  gistId: string;
  token: string;
}

const GIST_FILENAME = 'browser-nav-data.json';

export async function fetchGistData(config: GistConfig) {
  if (!config.gistId) return null;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (config.token) {
    headers['Authorization'] = `token ${config.token}`;
  }

  const response = await fetch(`https://api.github.com/gists/${config.gistId}`, { headers });
  if (!response.ok) {
    throw new Error('Failed to fetch Gist');
  }

  const data = await response.json();
  const file = data.files[GIST_FILENAME];
  if (!file) {
    // If the file doesn't exist in the Gist, maybe it's a new Gist or named differently
    // Fallback to the first file if available
    const firstFile = Object.values(data.files)[0] as any;
    if (firstFile && firstFile.content) {
      return JSON.parse(firstFile.content);
    }
    return null;
  }
  
  return JSON.parse(file.content);
}

export async function updateGistData(config: GistConfig, navData: any) {
  if (!config.gistId || !config.token) return;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${config.token}`,
    'Content-Type': 'application/json',
  };

  const payload = {
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(navData, null, 2)
      }
    }
  };

  const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to update Gist');
  }
}
