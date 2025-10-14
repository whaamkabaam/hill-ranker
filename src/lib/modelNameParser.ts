export const MODEL_NAME_MAPPINGS: Record<string, string> = {
  'chatgpt4o': 'ChatGPT 4o',
  'chatgpt_4o': 'ChatGPT 4o',
  'flux11_pro_ultra': 'Flux 1.1 Pro Ultra',
  'flux_11_pro_ultra': 'Flux 1.1 Pro Ultra',
  'ideogram3_quality': 'Ideogram 3 Quality',
  'ideogram_3_quality': 'Ideogram 3 Quality',
  'imagen3': 'Imagen 3',
  'imagen_3': 'Imagen 3',
  'imagen4_ultra': 'Imagen 4 Ultra',
  'imagen_4_ultra': 'Imagen 4 Ultra',
  'midjourney_v7': 'Midjourney v7',
  'nano_banana': 'Nano Banana',
  'recraft_v3': 'Recraft v3',
  'seedream3': 'Seedream 3',
  'seedream_3': 'Seedream 3',
  'genpeach': 'GenPeach',
};

export function parseModelNameFromFile(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(webp|png|jpg|jpeg)$/i, '');
  
  // Try exact match first (case insensitive)
  const lowerName = nameWithoutExt.toLowerCase();
  if (MODEL_NAME_MAPPINGS[lowerName]) {
    return MODEL_NAME_MAPPINGS[lowerName];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(MODEL_NAME_MAPPINGS)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }
  
  // Fallback: prettify filename
  return nameWithoutExt
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
