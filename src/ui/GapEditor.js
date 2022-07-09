// @flow

import React from 'react';

import CustomButton from './CustomButton';
import preventEventDefault from './preventEventDefault';
import uuid from './uuid';

import './czi-form.css';

const defaultAnswer = {text: '', correct: false};

class GapEditor extends React.PureComponent<any, any, any> {
  props: {
    initialValue: ?string,
    close: (json: ?string) => void,
  };

  state = {
    initialValue: this.props.initialValue,
    answers: JSON.parse(this.props.initialValue || 'null') || [
      {...defaultAnswer},
    ],
  };

  _id = uuid();
  _unmounted = false;

  render(): React.Element<any> {
    const {initialValue} = this.state;
    return (
      <div className="czi-gap-editor">
        <form className="czi-form" onSubmit={preventEventDefault}>
          <fieldset>
            <legend>Insert Gap Answers</legend>
            {this.state.answers.map((value, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  width: '500px',
                  gap: '8px',
                }}
              >
                <input
                  autoFocus={
                    index === this.state.answers.length - 1 ? true : false
                  }
                  onChange={this._setAnswer(index)}
                  onKeyUp={this._detectEnter}
                  type="text"
                  value={value.text}
                />
                <CustomButton
                  label={value.correct ? 'Correct' : 'Incorrect'}
                  onClick={this._toggleCorrect(index)}
                  style={{width: '80px', textAlign: 'center'}}
                />

                <CustomButton label="X" onClick={this._deleteAnswer(index)} />
              </div>
            ))}
            <CustomButton label="Add Answer" onClick={this._addAnswerField} />
          </fieldset>
          <div className="czi-form-buttons">
            <CustomButton label="Cancel" onClick={this._cancel} />
            <CustomButton
              active={true}
              disabled={!this.state.answers.length}
              label={initialValue ? 'Update' : 'Insert'}
              onClick={this._insert}
            />
          </div>
        </form>
      </div>
    );
  }

  _detectEnter = (event: any): void => {
    if (event.key === 'Enter') {
      this._addAnswerField();
    }
  };

  _onChange = (value: string): void => {
    this.setState({value});
  };

  _cancel = (): void => {
    this.props.close();
  };

  _insert = (): void => {
    console.log(JSON.stringify(this.state.answers));

    this.props.close(JSON.stringify(this.state.answers));
  };

  _setAnswer = (index: number): any => event => {
    const answers = [...this.state.answers];
    answers[index].text = event.target.value;
    this.setState({answers});
  };

  _toggleCorrect = (index: number): any => event => {
    const answers = [...this.state.answers];
    answers[index].correct = !answers[index].correct;
    this.setState({answers});
  };

  _deleteAnswer = (index: number): any => () => {
    const answers = [
      ...this.state.answers.slice(0, index),
      ...this.state.answers.slice(index + 1),
    ];
    this.setState({answers});
  };

  _addAnswerField = () => {
    const answers = [...this.state.answers, {...defaultAnswer}];
    this.setState({answers});
  };
}

export default GapEditor;
