/**
 * LocalizationManager
 * Loads locale JSON files and provides translate() helper with placeholders.
 */
export class LocalizationManager {
  constructor(options = {}) {
    this.defaultLocale = options.defaultLocale || 'en_US';
    this.cookieName = options.cookieName || 'blazing_sun_locale';
    this.cache = new Map();
    this.currentLocale = this.getLocaleFromCookie() || this.defaultLocale;
  }

  getLocaleFromCookie() {
    const match = document.cookie.match(new RegExp(`${this.cookieName}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  setLocale(locale) {
    if (!locale) return;
    this.currentLocale = locale;
    document.cookie = `${this.cookieName}=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax`;
    this.loadLocale(locale);
  }

  async loadLocale(locale) {
    const target = locale || this.currentLocale || this.defaultLocale;
    if (this.cache.has(target)) return this.cache.get(target);

    try {
      const response = await fetch(`/localizations/${encodeURIComponent(target)}.json`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Locale not found');
      const json = await response.json();
      this.cache.set(target, json);
      return json;
    } catch (error) {
      if (target !== this.defaultLocale) {
        return this.loadLocale(this.defaultLocale);
      }
      this.cache.set(target, {});
      return {};
    }
  }

  translate(key, argsOrForm = {}, formMaybe) {
    let args = {};
    let resolvedForm = 'singular';

    if (typeof argsOrForm === 'string') {
      resolvedForm = argsOrForm;
    } else if (typeof argsOrForm === 'object' && argsOrForm !== null) {
      args = argsOrForm;
    }

    if (typeof formMaybe === 'string') {
      resolvedForm = formMaybe;
    }

    const locale = this.currentLocale || this.defaultLocale;
    const data = this.cache.get(locale) || this.cache.get(this.defaultLocale);
    if (!data) {
      this.loadLocale(locale);
      return key;
    }

    const entry = data[key];
    if (!entry) {
      return key;
    }

    const template = resolvedForm === 'plural' ? entry.plural : entry.singular;
    return this.replaceParams(template || key, args);
  }

  replaceParams(text, args) {
    if (!text || !args) return text || '';
    return text.replace(/##(.*?)##/g, (match, param) => {
      if (Object.prototype.hasOwnProperty.call(args, param)) {
        return String(args[param]);
      }
      return match;
    });
  }
}
