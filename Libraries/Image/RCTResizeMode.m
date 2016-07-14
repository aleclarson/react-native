/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

#import "RCTResizeMode.h"

@implementation RCTConvert(RCTResizeMode)

RCT_ENUM_CONVERTER(RCTResizeMode, (@{
  @"cover": @(RCTResizeModeCover),
  @"contain": @(RCTResizeModeContain),
  @"stretch": @(RCTResizeModeStretch),
  @"center": @(RCTResizeModeCenter),
}), RCTResizeModeStretch, integerValue)

@end
