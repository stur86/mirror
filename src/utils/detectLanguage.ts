import { franc } from 'franc';
import type { LanguageCode } from '../constants/languages';

/**
 * Mapping from ISO 639-3 (franc output) to ISO 639-1 (app language codes).
 * Only includes languages present in the app's LANGUAGES list.
 */
const ISO639_3_TO_1: Record<string, LanguageCode> = {
  abk: 'ab', aar: 'aa', afr: 'af', aka: 'ak', sqi: 'sq', amh: 'am',
  ara: 'ar', arg: 'an', hye: 'hy', asm: 'as', aze: 'az', bam: 'bm',
  bak: 'ba', eus: 'eu', bel: 'be', ben: 'bn', bos: 'bs', bre: 'br',
  bul: 'bg', mya: 'my', cat: 'ca', khm: 'km', che: 'ce', nya: 'ny',
  zho: 'zh', chv: 'cv', cor: 'kw', cos: 'co', hrv: 'hr', ces: 'cs',
  dan: 'da', div: 'dv', nld: 'nl', dzo: 'dz', eng: 'en', epo: 'eo',
  est: 'et', ewe: 'ee', fao: 'fo', fil: 'fil', fin: 'fi', fra: 'fr',
  ful: 'ff', glg: 'gl', lug: 'lg', kat: 'ka', deu: 'de', ell: 'el',
  grn: 'gn', guj: 'gu', hat: 'ht', hau: 'ha', heb: 'he', hin: 'hi',
  hun: 'hu', isl: 'is', ido: 'io', ibo: 'ig', ind: 'id', ina: 'ia',
  ile: 'ie', iku: 'iu', ipk: 'ik', gle: 'ga', ita: 'it', jpn: 'ja',
  jav: 'jv', kal: 'kl', kan: 'kn', kas: 'ks', kaz: 'kk', kik: 'ki',
  kin: 'rw', kor: 'ko', kur: 'ku', kir: 'ky', lao: 'lo', lat: 'la',
  lav: 'lv', lin: 'ln', lit: 'lt', lub: 'lu', ltz: 'lb', mkd: 'mk',
  mlg: 'mg', msa: 'ms', mal: 'ml', mlt: 'mt', glv: 'gv', mri: 'mi',
  mar: 'mr', mon: 'mn', nav: 'nv', nep: 'ne', nde: 'nd', sme: 'se',
  nor: 'no', nob: 'nb', nno: 'nn', oci: 'oc', ori: 'or', orm: 'om',
  oss: 'os', pus: 'ps', fas: 'fa', pol: 'pl', por: 'pt', pan: 'pa',
  que: 'qu', ron: 'ro', roh: 'rm', run: 'rn', rus: 'ru', sag: 'sg',
  san: 'sa', srd: 'sc', gla: 'gd', srp: 'sr', sna: 'sn', iii: 'ii',
  snd: 'sd', sin: 'si', slk: 'sk', slv: 'sl', som: 'so', nbl: 'nr',
  sot: 'st', spa: 'es', sun: 'su', swa: 'sw', ssw: 'ss', swe: 'sv',
  tgl: 'tl', tgk: 'tg', tam: 'ta', tat: 'tt', tel: 'te', tha: 'th',
  bod: 'bo', tir: 'ti', ton: 'to', tso: 'ts', tsn: 'tn', tur: 'tr',
  tuk: 'tk', ukr: 'uk', urd: 'ur', uig: 'ug', uzb: 'uz', ven: 've',
  vie: 'vi', vol: 'vo', wln: 'wa', cym: 'cy', fry: 'fy', wol: 'wo',
  xho: 'xh', yid: 'yi', yor: 'yo', zha: 'za', zul: 'zu',
};

/**
 * Detect the language of a text string.
 * Returns an ISO 639-1 LanguageCode if detection succeeds and the language
 * is in the app's supported list, or null otherwise.
 */
export function detectLanguage(text: string): LanguageCode | null {
  if (!text.trim()) return null;
  const iso3 = franc(text);
  if (iso3 === 'und') return null;
  return ISO639_3_TO_1[iso3] ?? null;
}
