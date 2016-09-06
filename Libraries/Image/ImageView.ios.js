/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ImageView
 * @flow
 */
'use strict';

var EdgeInsetsPropType = require('EdgeInsetsPropType');
var ImageResizeMode = require('ImageResizeMode');
var ImageStylePropTypes = require('ImageStylePropTypes');
var NativeMethodsMixin = require('NativeMethodsMixin');
var PropTypes = require('ReactPropTypes');
var React = require('React');
var ReactNativeViewAttributes = require('ReactNativeViewAttributes');
var View = require('View');
var StyleSheet = require('StyleSheet');
var StyleSheetPropType = require('StyleSheetPropType');

var flattenStyle = require('flattenStyle');
var invariant = require('invariant');
var requireNativeComponent = require('requireNativeComponent');
var resolveAssetSource = require('resolveAssetSource');
var warning = require('warning');

var {
  ImageViewManager,
  NetworkImageViewManager,
} = require('NativeModules');

var {
  ImageViewManager,
  NetworkImageViewManager,
} = require('NativeModules');

/**
 * A React component for displaying different types of images,
 * including network images, static resources, temporary local images, and
 * images from local disk, such as the camera roll.
 *
 * Example usage:
 *
 * ```
 * renderImages: function() {
 *   return (
 *     <View>
 *       <ImageView
 *         style={styles.icon}
 *         source={require('./myIcon.png')}
 *       />
 *       <ImageView
 *         style={styles.logo}
 *         source={{uri: 'http://facebook.github.io/react/img/logo_og.png'}}
 *       />
 *     </View>
 *   );
 * },
 * ```
 */
var ImageView = React.createClass({
  statics: {
    resizeMode: ImageResizeMode,
    /**
     * Retrieve the width and height (in pixels) of an image prior to displaying it.
     * This method can fail if the image cannot be found, or fails to download.
     *
     * In order to retrieve the image dimensions, the image may first need to be
     * loaded or downloaded, after which it will be cached. This means that in
     * principle you could use this method to preload images, however it is not
     * optimized for that purpose, and may in future be implemented in a way that
     * does not fully load/download the image data. A proper, supported way to
     * preload images will be provided as a separate API.
     *
     * @platform ios
     */
    getSize: function(
      uri: string,
      success: (width: number, height: number) => void,
      failure: (error: any) => void,
    ) {
      ImageViewManager.getSize(uri, success, failure || function() {
        console.warn('Failed to get size for image: ' + uri);
      });
    }
  },

  mixins: [NativeMethodsMixin],

  /**
   * `NativeMethodsMixin` will look for this when invoking `setNativeProps`. We
   * make `this` look like an actual native component class.
   */
  viewConfig: {
    uiViewClassName: 'UIView',
    validAttributes: ReactNativeViewAttributes.UIView
  },

  contextTypes: {
    isInAParentText: React.PropTypes.bool
  },

  render: function() {
    var source = resolveAssetSource(this.props.source) || {};
    var {width, height, uri} = source;
    var style = flattenStyle([{width, height}, styles.base, this.props.style]) || {};

    var isNetwork = uri && uri.match(/^https?:/);
    var RawImage = isNetwork ? RCTNetworkImageView : RCTImageView;
    var resizeMode = this.props.resizeMode || (style || {}).resizeMode || 'cover'; // Workaround for flow bug t7737108
    var tintColor = (style || {}).tintColor; // Workaround for flow bug t7737108

    // This is a workaround for #8243665. RCTNetworkImageView does not support tintColor
    // TODO: Remove this hack once we have one image implementation #8389274
    if (isNetwork && tintColor) {
      RawImage = RCTImageView;
    }

    if (this.props.src) {
      console.warn('The <ImageView> component requires a `source` property rather than `src`.');
    }

    if (this.context.isInAParentText) {
      RawImage = RCTVirtualImage;
      if (!width || !height) {
        console.warn('You must specify a width and height for the image %s', uri);
      }
    }

    return (
      <RawImage
        {...this.props}
        style={style}
        resizeMode={resizeMode}
        tintColor={tintColor}
        source={source}
      />
    );
  },
});

var styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

var RCTImageView = requireNativeComponent('RCTImageView', ImageView);
var RCTNetworkImageView = NetworkImageViewManager ? requireNativeComponent('RCTNetworkImageView', ImageView) : RCTImageView;
var RCTVirtualImage = requireNativeComponent('RCTVirtualImage', ImageView);


module.exports = ImageView;
