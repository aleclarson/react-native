/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule TextInput
 * @flow
 */
'use strict';

var DocumentSelectionState = require('DocumentSelectionState');
var EventEmitter = require('EventEmitter');
var NativeMethodsMixin = require('NativeMethodsMixin');
var Platform = require('Platform');
var PropTypes = require('ReactPropTypes');
var React = require('React');
var ReactChildren = require('ReactChildren');
var StyleSheet = require('StyleSheet');
var Text = require('Text');
var TextInputState = require('TextInputState');
var TimerMixin = require('react-timer-mixin');
var TouchableWithoutFeedback = require('TouchableWithoutFeedback');
var UIManager = require('UIManager');
var View = require('View');

var createReactNativeComponentClass = require('createReactNativeComponentClass');
var emptyFunction = require('emptyFunction');
var invariant = require('invariant');
var requireNativeComponent = require('requireNativeComponent');

var onlyMultiline = {
  onTextInput: true, // not supported in Open Source yet
  children: true,
};

var notMultiline = {
  // nothing yet
};

if (Platform.OS === 'android') {
  var AndroidTextInput = requireNativeComponent('AndroidTextInput', null);
} else if (Platform.OS === 'ios') {
  var RCTTextView = requireNativeComponent('RCTTextView', null);
  var RCTTextField = requireNativeComponent('RCTTextField', null);
}

type Event = Object;

/**
 * A foundational component for inputting text into the app via a
 * keyboard. Props provide configurability for several features, such as
 * auto-correction, auto-capitalization, placeholder text, and different keyboard
 * types, such as a numeric keypad.
 *
 * The simplest use case is to plop down a `TextInput` and subscribe to the
 * `onChangeText` events to read the user input. There are also other events,
 * such as `onSubmitEditing` and `onFocus` that can be subscribed to. A simple
 * example:
 *
 * ```
 *   <TextInput
 *     style={{height: 40, borderColor: 'gray', borderWidth: 1}}
 *     onChangeText={(text) => this.setState({text})}
 *     value={this.state.text}
 *   />
 * ```
 *
 * Note that some props are only available with `multiline={true/false}`:
 */
var TextInput = React.createClass({
  statics: {
    /* TODO(brentvatne) docs are needed for this */
    State: TextInputState,
  },

  /**
   * `NativeMethodsMixin` will look for this when invoking `setNativeProps`. We
   * make `this` look like an actual native component class.
   */
  mixins: [NativeMethodsMixin, TimerMixin],

  viewConfig:
    ((Platform.OS === 'ios' && RCTTextField ?
      RCTTextField.viewConfig :
      (Platform.OS === 'android' && AndroidTextInput ?
        AndroidTextInput.viewConfig :
        {})) : Object),

  isFocused: function(): boolean {
    return TextInputState.currentlyFocusedField() ===
      React.findNodeHandle(this.inputRef);
  },

  contextTypes: {
    onFocusRequested: React.PropTypes.func,
    focusEmitter: React.PropTypes.instanceOf(EventEmitter),
  },

  _focusSubscription: (undefined: ?Function),

  componentDidMount: function() {
    if (!this.context.focusEmitter) {
      if (this.props.autoFocus) {
        this.requestAnimationFrame(this.focus);
      }
      return;
    }
    this._focusSubscription = this.context.focusEmitter.addListener(
      'focus',
      (el) => {
        if (this === el) {
          this.requestAnimationFrame(this.focus);
        } else if (this.isFocused()) {
          this.blur();
        }
      }
    );
    if (this.props.autoFocus) {
      this.context.onFocusRequested(this);
    }
  },

  componentWillUnmount: function() {
    this._focusSubscription && this._focusSubscription.remove();
    if (this.isFocused()) {
      this.blur();
    }
  },

  getChildContext: function(): Object {
    return {isInAParentText: true};
  },

  childContextTypes: {
    isInAParentText: React.PropTypes.bool
  },

  clear: function() {
    this.setNativeProps({text: ''});
  },

  render: function() {
    if (Platform.OS === 'ios') {
      return this._renderIOS();
    } else if (Platform.OS === 'android') {
      return this._renderAndroid();
    }
  },

  _getText: function(): ?string {
    return typeof this.props.value === 'string' ?
      this.props.value :
      this.props.defaultValue;
  },

  _renderIOS: function() {
    var textContainer;

    var onSelectionChange;
    if (this.props.selectionState || this.props.onSelectionChange) {
      onSelectionChange = (event: Event) => {
        if (this.props.selectionState) {
          var selection = event.nativeEvent.selection;
          this.props.selectionState.update(selection.start, selection.end);
        }
        this.props.onSelectionChange && this.props.onSelectionChange(event);
      };
    }

    var props = Object.assign({}, this.props);
    props.style = [styles.input, this.props.style];
    if (!props.multiline) {
      for (var propKey in onlyMultiline) {
        if (props[propKey]) {
          throw new Error(
            'TextInput prop `' + propKey + '` is only supported with multiline.'
          );
        }
      }
      textContainer =
        <RCTTextField
          {...props}
          ref={this._refInput}
          onFocus={this._onFocus}
          onBlur={this._onBlur}
          onChange={this._onChange}
          onSelectionChange={onSelectionChange}
          onSelectionChangeShouldSetResponder={emptyFunction.thatReturnsTrue}
          text={this._getText()}
        />;
    } else {
      for (var propKey in notMultiline) {
        if (props[propKey]) {
          throw new Error(
            'TextInput prop `' + propKey + '` cannot be used with multiline.'
          );
        }
      }

      var children = props.children;
      var childCount = 0;
      ReactChildren.forEach(children, () => ++childCount);
      invariant(
        !(props.value && childCount),
        'Cannot specify both value and children.'
      );
      if (childCount > 1) {
        children = <Text>{children}</Text>;
      }
      if (props.inputView) {
        children = [children, props.inputView];
      }
      textContainer =
        <RCTTextView
          {...props}
          ref={this._refInput}
          children={children}
          onFocus={this._onFocus}
          onBlur={this._onBlur}
          onChange={this._onChange}
          onSelectionChange={onSelectionChange}
          onTextInput={this._onTextInput}
          onSelectionChangeShouldSetResponder={emptyFunction.thatReturnsTrue}
          text={this._getText()}
        />;
    }

    return (
      <TouchableWithoutFeedback
        onPress={this._onPress}
        rejectResponderTermination={true}
        accessible={props.accessible}
        accessibilityLabel={props.accessibilityLabel}
        accessibilityTraits={props.accessibilityTraits}
        testID={props.testID}>
        {textContainer}
      </TouchableWithoutFeedback>
    );
  },

  _renderAndroid: function() {
    var onSelectionChange;
    if (this.props.selectionState || this.props.onSelectionChange) {
      onSelectionChange = (event: Event) => {
        if (this.props.selectionState) {
          var selection = event.nativeEvent.selection;
          this.props.selectionState.update(selection.start, selection.end);
        }
        this.props.onSelectionChange && this.props.onSelectionChange(event);
      };
    }

    var autoCapitalize =
      UIManager.AndroidTextInput.Constants.AutoCapitalizationType[this.props.autoCapitalize];
    var children = this.props.children;
    var childCount = 0;
    ReactChildren.forEach(children, () => ++childCount);
    invariant(
      !(this.props.value && childCount),
      'Cannot specify both value and children.'
    );
    if (childCount > 1) {
      children = <Text>{children}</Text>;
    }

    var textContainer =
      <AndroidTextInput
        ref={this._refInput}
        style={[this.props.style]}
        autoCapitalize={autoCapitalize}
        autoCorrect={this.props.autoCorrect}
        keyboardType={this.props.keyboardType}
        mostRecentEventCount={0}
        multiline={this.props.multiline}
        numberOfLines={this.props.numberOfLines}
        maxLength={this.props.maxLength}
        onFocus={this._onFocus}
        onBlur={this._onBlur}
        onChange={this._onChange}
        onSelectionChange={onSelectionChange}
        onTextInput={this._onTextInput}
        onEndEditing={this.props.onEndEditing}
        onSubmitEditing={this.props.onSubmitEditing}
        blurOnSubmit={this.props.blurOnSubmit}
        onLayout={this.props.onLayout}
        password={this.props.password || this.props.secureTextEntry}
        placeholder={this.props.placeholder}
        placeholderTextColor={this.props.placeholderTextColor}
        selectionColor={this.props.selectionColor}
        text={this._getText()}
        underlineColorAndroid={this.props.underlineColorAndroid}
        children={children}
        editable={this.props.editable}
      />;

    return (
      <TouchableWithoutFeedback
        onPress={this._onPress}
        accessible={this.props.accessible}
        accessibilityLabel={this.props.accessibilityLabel}
        accessibilityComponentType={this.props.accessibilityComponentType}
        testID={this.props.testID}>
        {textContainer}
      </TouchableWithoutFeedback>
    );
  },

  _refInput: function(ref) {
    this.inputRef = ref;
    this.props.ref(ref);
  },

  _onFocus: function(event: Event) {
    if (this.props.onFocus) {
      this.props.onFocus(event);
    }

    if (this.props.selectionState) {
      this.props.selectionState.focus();
    }
  },

  _onPress: function(event: Event) {
    if (this.props.editable || this.props.editable === undefined) {
      this.focus();
    }
  },

  _onChange: function(event: Event) {
    // Make sure to fire the mostRecentEventCount first so it is already set on
    // native when the text value is set.
    this.inputRef.setNativeProps({
      mostRecentEventCount: event.nativeEvent.eventCount,
    });

    var text = event.nativeEvent.text;
    this.props.onChange && this.props.onChange(event);
    this.props.onChangeText && this.props.onChangeText(text);

    if (!this.inputRef) {
      // calling `this.props.onChange` or `this.props.onChangeText`
      // may clean up the input itself. Exits here.
      return;
    }

    // This is necessary in case native updates the text and JS decides
    // that the update should be ignored and we should stick with the value
    // that we have in JS.
    if (text !== this.props.value && typeof this.props.value === 'string') {
      this.inputRef.setNativeProps({
        text: this.props.value,
      });
    }
  },

  _onBlur: function(event: Event) {
    this.blur();
    if (this.props.onBlur) {
      this.props.onBlur(event);
    }

    if (this.props.selectionState) {
      this.props.selectionState.blur();
    }
  },

  _onTextInput: function(event: Event) {
    this.props.onTextInput && this.props.onTextInput(event);
  },
});

var styles = StyleSheet.create({
  input: {
    alignSelf: 'stretch',
  },
});

module.exports = TextInput;
