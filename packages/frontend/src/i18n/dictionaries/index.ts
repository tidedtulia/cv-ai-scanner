import type { Locale } from '../config';
import { en, type Dictionary } from './en';
import { vi } from './vi';

export const dictionaries: Record<Locale, Dictionary> = { vi, en };

export type { Dictionary };
