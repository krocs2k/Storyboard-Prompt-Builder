/**
 * Auto-Selection Helpers
 * Builds condensed option lists for LLM selection and maps IDs back to full objects.
 */

import { imageTypes } from './data/image-types';
import { lightingSources } from './data/lighting-sources';
import { cameraBodies } from './data/camera-bodies';
import { focalLengths } from './data/focal-lengths';
import { lensTypes } from './data/lens-types';
import { filmStocks } from './data/film-stocks';
import { aspectRatios } from './data/aspect-ratios';
import { photographerStyles } from './data/photographer-styles';
import { movieStyles } from './data/movie-styles';
import { filterEffects } from './data/filter-effects';
import { shotTypes } from './data/shot-types';

// Condensed option for LLM consumption (id + name only to minimize tokens)
type CondensedOption = { id: string; name: string };

/**
 * Build condensed option lists for each category.
 * We only send id+name to minimize token usage (hundreds of options).
 */
export function buildCondensedOptions() {
  const condense = <T extends { id: string; name: string }>(items: T[]): CondensedOption[] =>
    items.map(i => ({ id: i.id, name: i.name }));

  return {
    imageTypes: condense(imageTypes),
    lightingSources: condense(lightingSources),
    cameraBodies: condense(cameraBodies),
    focalLengths: condense(focalLengths),
    lensTypes: condense(lensTypes),
    filmStocks: condense(filmStocks),
    aspectRatios: aspectRatios.map(a => ({ id: a.id, name: a.name })),
    photographerStyles: condense(photographerStyles),
    movieStyles: condense(movieStyles),
    filterEffects: condense(filterEffects),
    shotTypes: condense(shotTypes),
  };
}

/**
 * AutoSelections shape returned by the LLM — just IDs.
 */
export interface AutoSelectionIds {
  imageType?: string;
  lighting?: string;
  camera?: string;
  focalLength?: string;
  lensType?: string;
  filmStock?: string;
  aspectRatio?: string;
  photographer?: string;
  movie?: string;
  filter?: string;
}

/**
 * Map LLM-returned IDs back to full data objects.
 * Returns a partial Selections object ready to merge into state.
 */
export function mapIdsToSelections(ids: AutoSelectionIds): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (ids.imageType) {
    const found = imageTypes.find(i => i.id === ids.imageType);
    if (found) result.imageType = found;
  }
  if (ids.lighting) {
    const found = lightingSources.find(i => i.id === ids.lighting);
    if (found) result.lighting = found;
  }
  if (ids.camera) {
    const found = cameraBodies.find(i => i.id === ids.camera);
    if (found) result.camera = found;
  }
  if (ids.focalLength) {
    const found = focalLengths.find(i => i.id === ids.focalLength);
    if (found) result.focalLength = found;
  }
  if (ids.lensType) {
    const found = lensTypes.find(i => i.id === ids.lensType);
    if (found) result.lensType = found;
  }
  if (ids.filmStock) {
    const found = filmStocks.find(i => i.id === ids.filmStock);
    if (found) result.filmStock = found;
  }
  if (ids.aspectRatio) {
    result.aspectRatio = ids.aspectRatio;
  }
  if (ids.photographer) {
    const found = photographerStyles.find(i => i.id === ids.photographer);
    if (found) result.photographer = found;
  }
  if (ids.movie) {
    const found = movieStyles.find(i => i.id === ids.movie);
    if (found) result.movie = found;
  }
  if (ids.filter) {
    const found = filterEffects.find(i => i.id === ids.filter);
    if (found) result.filter = found;
  }

  return result;
}

/**
 * Build condensed shot-level options for per-shot cinematographer decisions.
 * These are used in the prompts/storyboard APIs for Section 2 & 3 per-shot picks:
 *   Section 2: Shot types (framing)
 *   Section 3: Lighting sources (mood)
 */
export function buildShotLevelOptions() {
  return {
    shotTypes: shotTypes.map(s => ({ id: s.id, name: s.name })),
    lightingSources: lightingSources.map(l => ({ id: l.id, name: l.name, description: l.description })),
  };
}
