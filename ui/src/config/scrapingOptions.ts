/**
 * Scraping Options Configuration
 * 新しいオプションを追加する場合は、このファイルにのみ追加してください
 */

export interface OptionDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'textarea';
  default: any;
  placeholder?: string;
  options?: Array<{ value: any; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

export const SCRAPING_OPTIONS: OptionDefinition[] = [
  // User Agent
  {
    key: 'userAgent',
    label: 'UA',
    type: 'select',
    default: undefined,
    options: [], // Populated at runtime from API
  },
  // Language
  {
    key: 'language',
    label: 'Lang',
    type: 'select',
    default: 'ja',
    options: [
      { value: 'ja', label: 'ja' },
      { value: 'en', label: 'en' },
      { value: 'zh', label: 'zh' },
    ],
  },
  // Referrer
  {
    key: 'referrer',
    label: 'Referrer',
    type: 'text',
    default: undefined,
    placeholder: 'https://...',
  },
  // Proxy
  {
    key: 'proxy',
    label: 'Proxy',
    type: 'text',
    default: undefined,
    placeholder: 'ip:port',
  },
  // Timeout
  {
    key: 'timeout',
    label: 'Timeout (s)',
    type: 'number',
    default: 30,
    min: 30,
    max: 300,
    step: 30,
  },
  // Delay
  {
    key: 'delay',
    label: 'Delay (s)',
    type: 'number',
    default: 5,
    min: 0,
    max: 60,
    step: 5,
  },
  // Actions
  {
    key: 'actions',
    label: 'Actions',
    type: 'textarea',
    default: undefined,
    placeholder: 'click>#id',
  },
  // Extra Headers
  {
    key: 'extraHeaders',
    label: 'Extra Headers',
    type: 'textarea',
    default: undefined,
    placeholder: 'Header: Value',
  },
  // Disable Script
  {
    key: 'disableScript',
    label: 'Disable Script',
    type: 'checkbox',
    default: false,
  },
  // Save HAR File
  {
    key: 'recordHar',
    label: 'Save harfile',
    type: 'checkbox',
    default: false,
  },
  // Xvfb Screenshot
  {
    key: 'scrot',
    label: 'Xvfb Screenshot',
    type: 'checkbox',
    default: false,
  },
  // Disable Enrichment
  {
    key: 'noenrich',
    label: 'Disable Enrichment',
    type: 'checkbox',
    default: false,
  },
  // Disable Enrichment
  {
    key: 'pageonly',
    label: 'Save Webpage Only',
    type: 'checkbox',
    default: false,
  },
  {
    key: 'keeps3',
    label: 'Keep S3 files',
    type: 'checkbox',
    default: false,
  },
];
