'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

exports.default = updateIndentLevel;

var _clamp = require('./ui/clamp');

var _clamp2 = _interopRequireDefault(_clamp);

var _compareNumber = require('./compareNumber');

var _compareNumber2 = _interopRequireDefault(_compareNumber);

var _isListNode = require('./isListNode');

var _isListNode2 = _interopRequireDefault(_isListNode);

var _nodeAt = require('./nodeAt');

var _nodeAt2 = _interopRequireDefault(_nodeAt);

var _transformAndPreserveTextSelection = require('./transformAndPreserveTextSelection');

var _transformAndPreserveTextSelection2 = _interopRequireDefault(_transformAndPreserveTextSelection);

var _prosemirrorState = require('prosemirror-state');

var _NodeNames = require('./NodeNames');

var _prosemirrorModel = require('prosemirror-model');

var _ParagraphNodeSpec = require('./ParagraphNodeSpec');

var _prosemirrorTransform = require('prosemirror-transform');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function updateIndentLevel(tr, schema, delta) {
  var _tr = tr,
      doc = _tr.doc,
      selection = _tr.selection;

  if (!doc || !selection) {
    return tr;
  }

  if (!(selection instanceof _prosemirrorState.TextSelection || selection instanceof _prosemirrorState.AllSelection)) {
    return tr;
  }

  var nodes = schema.nodes;
  var from = selection.from,
      to = selection.to;

  var listNodePoses = [];

  var blockquote = nodes[_NodeNames.BLOCKQUOTE];
  var heading = nodes[_NodeNames.HEADING];
  var paragraph = nodes[_NodeNames.PARAGRAPH];

  doc.nodesBetween(from, to, function (node, pos) {
    var nodeType = node.type;
    if (nodeType === paragraph || nodeType === heading || nodeType === blockquote) {
      tr = setNodeIndentMarkup(tr, schema, pos, delta);
      return false;
    } else if ((0, _isListNode2.default)(node)) {
      // List is tricky, we'll handle it later.
      listNodePoses.push(pos);
      return false;
    }
    return true;
  });

  if (!listNodePoses.length) {
    return tr;
  }

  tr = (0, _transformAndPreserveTextSelection2.default)(tr, schema, function (memo) {
    var schema = memo.schema;

    var tr2 = memo.tr;
    listNodePoses.sort(_compareNumber2.default).reverse().forEach(function (pos) {
      tr2 = setListNodeIndent(tr2, schema, pos, delta);
    });
    return tr2;
  });

  return tr;
}

function setListNodeIndent(tr, schema, pos, delta) {
  var listItem = schema.nodes[_NodeNames.LIST_ITEM];
  if (!listItem) {
    return tr;
  }

  var _tr2 = tr,
      doc = _tr2.doc,
      selection = _tr2.selection;

  if (!doc) {
    return tr;
  }

  var listNode = doc.nodeAt(pos);
  if (!listNode) {
    return tr;
  }

  var indentNew = (0, _clamp2.default)(_ParagraphNodeSpec.MIN_INDENT_LEVEL, listNode.attrs.indent + delta, _ParagraphNodeSpec.MAX_INDENT_LEVEL);
  if (indentNew === listNode.attrs.indent) {
    return tr;
  }

  var from = selection.from,
      to = selection.to;


  if (from <= pos && to >= pos + listNode.nodeSize) {
    return setNodeIndentMarkup(tr, schema, pos, delta);
  }

  var listNodeType = listNode.type;

  // listNode is partially selected.
  var itemsBefore = [];
  var itemsSelected = [];
  var itemsAfter = [];

  doc.nodesBetween(pos, pos + listNode.nodeSize, function (itemNode, itemPos) {
    if (itemNode.type === listNodeType) {
      return true;
    }

    if (itemNode.type === listItem) {
      var listItemNode = listItem.create(itemNode.attrs, itemNode.content, itemNode.marks);
      if (itemPos + itemNode.nodeSize <= from) {
        itemsBefore.push(listItemNode);
      } else if (itemPos > to) {
        itemsAfter.push(listItemNode);
      } else {
        itemsSelected.push(listItemNode);
      }
      return false;
    }

    return true;
  });

  tr = tr.delete(pos, pos + listNode.nodeSize);
  if (itemsAfter.length) {
    var listNodeNew = listNodeType.create(listNode.attrs, _prosemirrorModel.Fragment.from(itemsAfter));
    tr = tr.insert(pos, _prosemirrorModel.Fragment.from(listNodeNew));
  }

  if (itemsSelected.length) {
    var listNodeAttrs = (0, _extends3.default)({}, listNode.attrs, {
      indent: indentNew
    });
    var _listNodeNew = listNodeType.create(listNodeAttrs, _prosemirrorModel.Fragment.from(itemsSelected));
    tr = tr.insert(pos, _prosemirrorModel.Fragment.from(_listNodeNew));
  }

  if (itemsBefore.length) {
    var _listNodeNew2 = listNodeType.create(listNode.attrs, _prosemirrorModel.Fragment.from(itemsBefore));
    tr = tr.insert(pos, _prosemirrorModel.Fragment.from(_listNodeNew2));
  }

  return mergeListNodes(tr, schema, listNodeType, indentNew);
}

function setNodeIndentMarkup(tr, schema, pos, delta) {
  if (!tr.doc) {
    return tr;
  }
  var node = tr.doc.nodeAt(pos);
  if (!node) {
    return tr;
  }
  var indent = (0, _clamp2.default)(_ParagraphNodeSpec.MIN_INDENT_LEVEL, (node.attrs.indent || 0) + delta, _ParagraphNodeSpec.MAX_INDENT_LEVEL);
  if (indent === node.attrs.indent) {
    return tr;
  }
  var nodeAttrs = (0, _extends3.default)({}, node.attrs, {
    indent: indent
  });
  return tr.setNodeMarkup(pos, node.type, nodeAttrs, node.marks);
}

// Merge sibling list nodes that have the same list type and indent level.
function mergeListNodes(tr, schema, listNodeType, indent) {
  if (tr.getMeta('dryrun')) {
    // This transform is potentially expensive to perform, so skip it if
    // we're only doing it as "dryrun" to see whether user could update the
    // lists.
    return tr;
  }

  var working = true;

  var _loop = function _loop() {
    var from = 1;
    var to = tr.doc.nodeSize - 2;
    if (to <= from) {
      return 'break';
    }
    var mergeInfo = void 0;
    tr.doc.nodesBetween(from, to, function (node, pos) {
      if (mergeInfo) {
        // We've found the list to merge. Stop traversing deeper.
        return false;
      }
      if (!(0, _isListNode2.default)(node)) {
        // This is not a list node, keep traversing deeper until we've found
        // one.
        return true;
      }

      if (node.type !== listNodeType && node.attrs.indent !== indent) {
        // This list node does matched the spec. Stop the traversing deeper.
        return false;
      }

      var nextSiblingNodePos = pos + node.nodeSize;
      var nextSiblingNode = (0, _nodeAt2.default)(tr.doc, nextSiblingNodePos);
      if (nextSiblingNode && areListNodesMergeable(node, nextSiblingNode)) {
        // The current list node and its next sibling list node can be merged.
        mergeInfo = {
          fromNode: node,
          toNode: nextSiblingNode,
          deleteFrom: nextSiblingNodePos,
          deleteTo: nextSiblingNodePos + nextSiblingNode.nodeSize,
          insertAt: nextSiblingNodePos - 1,
          content: nextSiblingNode.content
        };
      }

      // Stop the traversing deeper inside the current list node which
      // can only contains inline nodes inside.
      return false;
    });

    if (mergeInfo) {
      // Merge list nodes.
      tr = tr.delete(mergeInfo.deleteFrom, mergeInfo.deleteTo);
      tr = tr.insert(mergeInfo.insertAt, mergeInfo.content);
      working = true;
    } else {
      working = false;
    }
  };

  while (working) {
    var _ret = _loop();

    if (_ret === 'break') break;
  }
  return tr;
}

function areListNodesMergeable(one, two) {
  return !!(one.type === two.type && one.attrs.indent === two.attrs.indent && (0, _isListNode2.default)(one) && (0, _isListNode2.default)(two));
}