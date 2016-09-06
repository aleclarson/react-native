
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule TouchableWithoutFeedback
 * @flow
 */
'use strict';

var EdgeInsetsPropType = require('EdgeInsetsPropType');
var React = require('React');
var TimerMixin = require('react-timer-mixin');
var Touchable = require('Touchable');
var View = require('View');
var ensurePositiveDelayProps = require('ensurePositiveDelayProps');
var invariant = require('invariant');
var onlyChild = require('onlyChild');

type Event = Object;

var PRESS_RETENTION_OFFSET = {top: 20, left: 20, right: 20, bottom: 30};

/**
 * Do not use unless you have a very good reason. All the elements that
 * respond to press should have a visual feedback when touched. This is
 * one of the primary reason a "web" app doesn't feel "native".
 *
 * > **NOTE**: TouchableWithoutFeedback supports only one child
 * >
 * > If you wish to have several child components, wrap them in a View.
 */
var TouchableWithoutFeedback = React.createClass({

  displayName: 'TouchableWithoutFeedback',

  mixins: [TimerMixin, Touchable.Mixin],

  getInitialState: function() {
    return this.touchableGetInitialState();
  },

  componentDidMount: function() {
    ensurePositiveDelayProps(this.props);
  },

  componentWillReceiveProps: function(nextProps: Object) {
    ensurePositiveDelayProps(nextProps);
  },

  /**
   * `Touchable.Mixin` self callbacks. The mixin will invoke these if they are
   * defined on your component.
   */
  touchableHandlePress: function(e: Event) {
    this.props.onPress && this.props.onPress(e);
  },

  touchableHandleActivePressIn: function(e: Event) {
    this.props.onPressIn && this.props.onPressIn(e);
  },

  touchableHandleActivePressOut: function(e: Event) {
    this.props.onPressOut && this.props.onPressOut(e);
  },

  // touchableHandlePressTerminate: function(e: Event) {
  //   onPressTerminate
  // }

  touchableHandleLongPress: function(e: Event) {
    this.props.onLongPress && this.props.onLongPress(e);
  },

  touchableGetPressRectOffset: function(): typeof PRESS_RETENTION_OFFSET {
    return this.props.pressRetentionOffset || PRESS_RETENTION_OFFSET;
  },

  touchableGetHitSlop: function(): ?Object {
    return this.props.hitSlop;
  },

  touchableGetHighlightDelayMS: function(): number {
    return this.props.delayPressIn || 0;
  },

  touchableGetLongPressDelayMS: function(): number {
    return this.props.delayLongPress === 0 ? 0 :
      this.props.delayLongPress || 500;
  },

  touchableGetPressOutDelayMS: function(): number {
    return this.props.delayPressOut || 0;
  },

  render: function(): ReactElement {
    // Note(avik): remove dynamic typecast once Flow has been upgraded
    return (React: any).cloneElement(onlyChild(this.props.children), {
      accessible: this.props.accessible !== false,
      accessibilityLabel: this.props.accessibilityLabel,
      accessibilityComponentType: this.props.accessibilityComponentType,
      accessibilityTraits: this.props.accessibilityTraits,
      testID: this.props.testID,
      onLayout: this.props.onLayout,
      hitSlop: this.props.hitSlop,
      onStartShouldSetResponder: this.touchableHandleStartShouldSetResponder,
      onResponderTerminationRequest: this.touchableHandleResponderTerminationRequest,
      onResponderGrant: this.touchableHandleResponderGrant,
      onResponderMove: this.touchableHandleResponderMove,
      onResponderRelease: this.touchableHandleResponderRelease,
      onResponderTerminate: this.touchableHandleResponderTerminate
    });
  }
});

module.exports = TouchableWithoutFeedback;
