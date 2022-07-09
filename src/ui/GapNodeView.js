// @flow

import './czi-gap-view.css';
import CustomNodeView from './CustomNodeView';
import GapInlineEditor from './GapEditor';
import React from 'react';
import createPopUp from './createPopUp';
import cx from 'classnames';
import uuid from './uuid';
import {Decoration} from 'prosemirror-view';
import {Node} from 'prosemirror-model';

import type {NodeViewProps} from './CustomNodeView';

const EMPTY_SRC =
  'data:image/gif;base64,' +
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

class GapViewBody extends React.PureComponent<any, any, any> {
  props: NodeViewProps;

  state = {
    isEditing: false,
  };

  _inlineEditor = null;
  _id = uuid();
  _mounted = false;

  componentDidMount(): void {
    this._mounted = true;
    this._renderInlineEditor();
  }

  componentWillUnmount(): void {
    this._mounted = false;
  }

  componentDidUpdate(prevProps: NodeViewProps): void {
    this._renderInlineEditor();
  }

  render(): React.Element<any> {
    // TODO: Resolve `readOnly`;
    const readOnly = false;
    const {node, selected, focused} = this.props;
    const {attrs} = node;
    const {json} = attrs;
    const {isEditing} = this.state;

    const active = (focused || isEditing) && !readOnly;
    const className = cx('czi-gap-view-body', {active, selected});
    const html = '[...]';
    return (
      <span
        className={className}
        data-active={active ? 'true' : null}
        data-json={json || ''}
        id={this._id}
        title={json}
      >
        <img
          alt={json}
          className="czi-gap-view-body-img"
          src={EMPTY_SRC}
          title={json}
        />
        <span
          className="czi-gap-view-body-content"
          dangerouslySetInnerHTML={{__html: html}}
        />
      </span>
    );
  }

  _renderInlineEditor(): void {
    const el = document.getElementById(this._id);
    if (!el || el.getAttribute('data-active') !== 'true') {
      this._inlineEditor && this._inlineEditor.close();
      return;
    }
    const {node} = this.props;
    const editorProps = {
      initialValue: node.attrs.json,
    };
    if (this._inlineEditor) {
      this._inlineEditor.update(editorProps);
    } else {
      this._onEditStart();
      this._inlineEditor = createPopUp(GapInlineEditor, editorProps, {
        // anchor: el,
        // autoDismiss: false,
        modal: true,
        // container: el.closest(`.${FRAMESET_BODY_CLASSNAME}`),
        // position: atAnchorBottomCenter,
        onClose: val => {
          console.log(val);
          this._inlineEditor = null;
          this._onEditEnd();
          this._onChange({align: node.attrs.align, json: val});
        },
      });
    }
  }

  _onEditStart = (): void => {
    this.setState({isEditing: true});
  };

  _onEditEnd = (): void => {
    this.setState({isEditing: false});
  };

  _onChange = (value: ?{align: ?string, json: string}): void => {
    if (!this._mounted) {
      return;
    }

    const align = value ? value.align : null;
    const json = value ? value.json : null;

    const {getPos, node, editorView} = this.props;
    const pos = getPos();
    const attrs = {
      ...node.attrs,
      json,
      align,
    };

    let tr = editorView.state.tr;
    const {selection} = editorView.state;
    tr = tr.setNodeMarkup(pos, null, attrs);
    tr = tr.setSelection(selection);
    editorView.dispatch(tr);
  };
}

class GapNodeView extends CustomNodeView {
  // @override
  createDOMElement(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'czi-gap-view';
    this._updateDOM(el);
    return el;
  }

  // @override
  update(node: Node, decorations: Array<Decoration>): boolean {
    super.update(node, decorations);
    this._updateDOM(this.dom);
    return true;
  }

  // @override
  renderReactComponent(): React.Element<any> {
    return <GapViewBody {...this.props} />;
  }

  _updateDOM(el: HTMLElement): void {
    const {align} = this.props.node.attrs;
    let className = 'czi-gap-view';
    if (align) {
      className += ' align-' + align;
    }
    el.className = className;
  }
}

export default GapNodeView;
