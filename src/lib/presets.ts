import presetsJson from '@/config/rpg-presets.json';
import type { RpgPresets } from './types';

const PRESETS: RpgPresets = presetsJson as RpgPresets;

export const getPresets = (): RpgPresets => PRESETS;
