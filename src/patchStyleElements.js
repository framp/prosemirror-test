// @flow

import stable from 'stable';

import toHexColor from './ui/toHexColor';

const LIST_ITEM_PSEUDO_ELEMENT_BEFORE = /li:+before/;
const NODE_NAME_SELECTOR = /^[a-zA-Z]+\d*$/;
const PSEUDO_ELEMENT_ANY = /:+[a-z]+/;

type SelectorTextToCSSText = {
  afterContent: ?string,
  beforeContent: ?string,
  cssText: string,
  selectorText: string,
};

export const ATTRIBUTE_CSS_BEFORE_CONTENT = 'data-attribute-css-before-content';

// Node name only selector has less priority, we'll handle it
// separately

export default function patchStyleElements(doc: Document): void {
  const els = Array.from(doc.querySelectorAll('style'));
  if (!els.length) {
    return;
  }

  const selectorTextToCSSTexts = [];

  els.forEach((styleEl: any) => {
    const sheet = styleEl.sheet;
    if (!sheet) {
      // TODO: Find out why the browser does not support this.
      console.error('styleEl.sheet undefined', styleEl);
      return;
    }
    const cssRules = sheet.cssRules;
    if (!cssRules) {
      // TODO: Find out why the browser does not support this.
      console.error('sheet.cssRules undefined', sheet);
      return;
    }

    Array.from(cssRules).forEach((rule, cssRuleIndex) => {
      const selectorText = String(rule.selectorText || '');
      if (!selectorText) {
        // This could be `CSSImportRule.` created by @import().
        // ignore it.
        return;
      }

      if (!rule.styleMap) {
        // TODO: Find out why the browser does not support this.
        console.error('rule.styleMap undefined', rule);
        return;
      }
      let cssText = '';
      rule.styleMap.forEach((cssStyleValue, key) => {
        // e.g. rules['color'] = 'red'.
        if (key === 'color') {
          const color = toHexColor(String(cssStyleValue));
          if (!color) {
            return;
          }
        } else if (key === 'background-color') {
          const color = toHexColor(String(cssStyleValue));
          if (!color) {
            return;
          }
        }
        cssText += `${key}: ${cssStyleValue};`;
      });
      if (selectorText.indexOf(',') > -1) {
        selectorText.split(/\s*,\s*/).forEach(st => {
          buildSelectorTextToCSSText(selectorTextToCSSTexts, st, cssText);
        });
      } else {
        buildSelectorTextToCSSText(
          selectorTextToCSSTexts,
          selectorText,
          cssText,
        );
      }
    });
  });

  // Sort selector by
  stable(selectorTextToCSSTexts, sortBySpecificity).
    reduce(buildElementToCSSTexts.bind(null, doc), new Map()).
    forEach(applyInlineStyleSheetCSSTexts);
}

function buildElementToCSSTexts(
  doc: Document,
  elementToCSSTexts: Map<HTMLElement, Array<string>>,
  bag: SelectorTextToCSSText,
): Map<HTMLElement, Array<string>> {
  const {selectorText, cssText, beforeContent} = bag;
  const els = Array.from(doc.querySelectorAll(selectorText));

  els.forEach(el => {
    const style = el.style;
    if (!style || !(el instanceof HTMLElement)) {
      return;
    }
    if (cssText) {
      const cssTexts = elementToCSSTexts.get(el) || [];
      cssTexts.push(cssText);
      elementToCSSTexts.set(el, cssTexts);
    }
    if (beforeContent) {
      // This simply adds the custom attribute 'data-before-content' to element,
      // developer must handle his attribute via NodeSpec separately if needed.
      el.setAttribute(ATTRIBUTE_CSS_BEFORE_CONTENT, beforeContent);
    }
  });
  return elementToCSSTexts;
};

function sortBySpecificity(
  one: SelectorTextToCSSText,
  two: SelectorTextToCSSText,
): boolean {
  // This is just the naive implementation of sorting selectors by css
  // specificity.
  // 1. NodeName selectors has less priority.
  const aa = NODE_NAME_SELECTOR.test(one.selectorText);
  const bb = NODE_NAME_SELECTOR.test(two.selectorText);
  if (!aa && bb) {
    return true;
  }
  return false;
}

function buildSelectorTextToCSSText(
  result: Array<SelectorTextToCSSText>,
  selectorText: string,
  cssText: string,
): void {
  let afterContent;
  let beforeContent;

  if (LIST_ITEM_PSEUDO_ELEMENT_BEFORE.test(selectorText)) {
    // Workaround to extract the list style content from HTML generated by
    // Google.
    // This converts `content:"\0025a0  "` to `\0025a0`
    beforeContent = cssText.
      replace(/^content:\s*"\s*/, '').
      replace(/";*$/, '');
    selectorText = selectorText.replace(/:+before/, '');
    cssText = '';
  } else if (PSEUDO_ELEMENT_ANY.test(selectorText)) {
    // TODO: Handle this later.
    return;
  }

  result.push({
    selectorText,
    cssText,
    afterContent,
    beforeContent,
  });
}

function applyInlineStyleSheetCSSTexts(
  cssTexts: Array<string>,
  el: HTMLElement,
): void {
  if (cssTexts.length) {
    el.style.cssText = cssTexts.join(';') + ';' + el.style.cssText;
  }
}
