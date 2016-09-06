/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule View
 * @flow
 */
'use strict';

const NativeMethodsMixin = require('NativeMethodsMixin');
const React = require('React');
const ReactNativeStyleAttributes = require('ReactNativeStyleAttributes');
const ReactNativeViewAttributes = require('ReactNativeViewAttributes');
const UIManager = require('UIManager');

const requireNativeComponent = require('requireNativeComponent');

const AccessibilityTraits = [
  'none',
  'button',
  'link',
  'header',
  'search',
  'image',
  'selected',
  'plays',
  'key',
  'text',
  'summary',
  'disabled',
  'frequentUpdates',
  'startsMedia',
  'adjustable',
  'allowsDirectInteraction',
  'pageTurn',
];

const AccessibilityComponentType = [
  'none',
  'button',
  'radiobutton_checked',
  'radiobutton_unchecked',
];

const forceTouchAvailable = (UIManager.RCTView.Constants &&
  UIManager.RCTView.Constants.forceTouchAvailable) || false;

const statics = {
  AccessibilityTraits,
  AccessibilityComponentType,
  /**
   * Is 3D Touch / Force Touch available (i.e. will touch events include `force`)
   * @platform ios
   */
  forceTouchAvailable,
};

/**
 * The most fundamental component for building UI, `View` is a
 * container that supports layout with flexbox, style, some touch handling, and
 * accessibility controls, and is designed to be nested inside other views and
 * to have 0 to many children of any type. `View` maps directly to the native
 * view equivalent on whatever platform React is running on, whether that is a
 * `UIView`, `<div>`, `android.view`, etc.  This example creates a `View` that
 * wraps two colored boxes and custom component in a row with padding.
 *
 * ```
 * <View style={{flexDirection: 'row', height: 100, padding: 20}}>
 *   <View style={{backgroundColor: 'blue', flex: 0.3}} />
 *   <View style={{backgroundColor: 'red', flex: 0.5}} />
 *   <MyCustomComponent {...customProps} />
 * </View>
 * ```
 *
 * `View`s are designed to be used with `StyleSheet`s for clarity and
 * performance, although inline styles are also supported.
 */
const View = React.createClass({
  mixins: [NativeMethodsMixin],

  /**
   * `NativeMethodsMixin` will look for this when invoking `setNativeProps`. We
   * make `this` look like an actual native component class.
   */
  viewConfig: {
    uiViewClassName: 'RCTView',
    validAttributes: ReactNativeViewAttributes.RCTView
  },

  statics: {
    ...statics,
  },

  render: function() {
    // WARNING: This method will not be used in production mode as in that mode we
    // replace wrapper component View with generated native wrapper RCTView. Avoid
    // adding functionality this component that you'd want to be available in both
    // dev and prod modes.
    return <RCTView {...this.props} />;
  },
});

const RCTView = requireNativeComponent('RCTView', View, {
  nativeOnly: {
    nativeBackgroundAndroid: true,
  }
});

// if (__DEV__) {
//   const viewConfig = UIManager.viewConfigs && UIManager.viewConfigs.RCTView || {};
//   for (const prop in viewConfig.nativeProps) {
//     const viewAny: any = View; // Appease flow
//     if (!viewAny.propTypes[prop] && !ReactNativeStyleAttributes[prop]) {
//       throw new Error(
//         'View is missing propType for native prop `' + prop + '`'
//       );
//     }
//   }
// }

let ViewToExport = RCTView;
if (__DEV__) {
  ViewToExport = View;
} else {
  Object.assign(RCTView, statics);
}

module.exports = ViewToExport;
