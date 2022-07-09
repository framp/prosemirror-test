// @flow

import type {NodeSpec} from './Types';

function getAttrs(dom: HTMLElement) {
  let align = dom.getAttribute('data-align') || dom.getAttribute('align');
  if (align) {
    align = /(left|right|center)/.test(align) ? align : null;
  }

  return {
    align,
    json: dom.getAttribute('data-gapjson') || null,
  };
}

const GapNodeSpec: NodeSpec = {
  inline: true,
  attrs: {
    align: {default: null},
    json: {default: ''},
  },
  group: 'inline',
  draggable: true,
  parseDOM: [
    {tag: 'gap[data-gapjson]', getAttrs},
    {tag: 'span[data-gapjson]', getAttrs},
  ],
  toDOM(node) {
    // Normally, the DOM structure of the math node is rendered by
    // `GapNodeView`. This method is only called when user selects a
    // math node and copies it, which triggers the "serialize to HTML" flow that
    // calles this method.
    const {align, json} = node.attrs;
    const domAttrs = {};
    if (align) {
      domAttrs.align = align;
    }
    if (json) {
      domAttrs['data-gapjson'] = json;
    }
    return ['span', domAttrs];
  },
};

export default GapNodeSpec;
